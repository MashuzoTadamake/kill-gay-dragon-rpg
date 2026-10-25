// Optional dependency-free UI smoke test. Start a static server on :8000 and
// an isolated Chromium/Brave browser with --headless --remote-debugging-port=9222.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const gameUrl = process.argv[2] ?? 'http://127.0.0.1:8000/';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find(t => t.type === 'page');
assert.ok(target, 'A test browser page is required');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true}); });
let seq = 0; const pending = new Map(), errors = [];
ws.addEventListener('message', ({data}) => {
  const m=JSON.parse(data);
  if(m.id) { const p=pending.get(m.id); pending.delete(m.id); m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result); }
  else if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description??''));
});
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function evaluate(expression, userGesture = false) { const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; }
async function waitFor(expression) { for(let i=0;i<100;i++) { if(await evaluate(expression)) return; await new Promise(r=>setTimeout(r,50)); } throw new Error(`Timed out: ${expression}`); }
const text = () => evaluate('document.body.innerText');
const saved = () => evaluate("JSON.parse(localStorage.getItem('kgd.chapter1.save'))");
async function checkViewport() {
  const bounds=await evaluate(`({width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,x:scrollX,y:scrollY})`);
  assert.ok(bounds.pageWidth<=bounds.width && bounds.pageHeight<=bounds.height+1 && bounds.x===0 && bounds.y===0,`Page stays inside viewport: ${JSON.stringify(bounds)}`);
  const controls=await evaluate(`document.querySelector('#modal').open ? [] : [...document.querySelectorAll('#controls button')].map(b=>({action:b.dataset.action,top:b.getBoundingClientRect().top,bottom:b.getBoundingClientRect().bottom}))`);
  assert.ok(controls.every(b=>b.top>=0 && b.bottom<=bounds.height),`All choices visible: ${JSON.stringify(controls)}`);
}
async function click(id) { await checkViewport(); await evaluate(`(()=>{const b=document.querySelector('button[data-action="${id}"]');if(!b||b.disabled)throw Error('Unavailable action: ${id}');b.focus();b.click();})()`, true); }
async function story() { for(let i=0;i<1000;i++) { const s=await saved(); if(s.view!=='story')return; const first=await evaluate("document.querySelector('#controls button').dataset.action"); await click(s.scene==='confrontation' && first.startsWith('choice:') ? 'choice:1' : first); } throw new Error('Story did not finish'); }
async function reachScene(id) { for(let i=0;i<500;i++){if((await saved()).scene===id)return;await click(await evaluate("document.querySelector('#controls button').dataset.action"));}throw new Error(`Scene not reached: ${id}`); }
async function finishMessages() { while (await evaluate("document.querySelector('#controls button')?.dataset.action === 'continue'")) { const before=(await saved()).scene; await click('continue'); if((await saved()).scene!==before)throw new Error('Expected choices before another scene'); } }
async function checkConversation() {
  const geometry=await evaluate(`(()=>{const c=document.querySelector('#conversation');const h=c.querySelector('.message--hero'),n=c.querySelector('.message--npc'),r=c.querySelector('.message--narrator');return {hero:getComputedStyle(h).alignSelf,npc:getComputedStyle(n).alignSelf,narrator:getComputedStyle(r).textAlign,right:h.getBoundingClientRect().right>n.getBoundingClientRect().right,contained:[...c.children].every(x=>x.getBoundingClientRect().left>=c.getBoundingClientRect().left&&x.getBoundingClientRect().right<=c.getBoundingClientRect().right)}})()`);
  assert.deepEqual(geometry,{hero:'flex-end',npc:'flex-start',narrator:'center',right:true,contained:true});
}
async function fight() { for(let i=0;i<60;i++){ const s=await saved(); if(s.view!=='combat'){assert.notEqual(s.view,'defeat','Combat should be survivable');return;}await click('attack');}throw new Error('Battle did not finish'); }
async function travel(id) { await click('map'); await click(`travel:${id}`); assert.equal(await evaluate("document.querySelector('#modal').open"),false); }
async function screenshot(name,width=1280,height=1000) {
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await new Promise(r=>setTimeout(r,100));
  await checkViewport();
  if (await evaluate("!!document.querySelector('#conversation')")) assert.ok(await evaluate("document.querySelector('#conversation').clientHeight>=80"),`${name}: enough room to read dialogue`);
  const dimensions=await evaluate('({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dimensions.scroll<=dimensions.width,`${name}: no horizontal overflow`);
  await evaluate("document.querySelector('#toast').classList.remove('visible')");
  const metrics=await cdp('Page.getLayoutMetrics');
  const img=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.max(height,metrics.cssContentSize.height),scale:1}});
  await writeFile(`/tmp/kgd-screenshots/${name}.png`,Buffer.from(img.data,'base64'));
}
try {
  await mkdir('/tmp/kgd-screenshots',{recursive:true});
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:gameUrl});
  await waitFor("!!document.querySelector('[data-action=new]')");
  await evaluate('localStorage.clear()');await cdp('Page.reload');await waitFor("!!document.querySelector('[data-action=new]')");
  await screenshot('01-menu-desktop');await screenshot('02-menu-mobile',390,844);await screenshot('12-menu-small-mobile',320,740);await screenshot('13-menu-tablet',768,1024);assert.doesNotMatch(await text(),/SHAMEPUR CHRONICLES/i);
  assert.match(await text(),/Begin your story/);await click('new');assert.equal((await saved()).scene,'prologue');
  await screenshot('03-prologue-mobile',390,844);await screenshot('04-prologue-desktop');
  await click('quests');const openingJournal=await evaluate("document.querySelector('#modalBody').innerText");assert.match(openingJournal,/Your Story Begins/);assert.doesNotMatch(openingJournal,/Charukola|Kashit|Pillars|Bring Him Home|Missing Supplies|Goblin Menace/);await screenshot('14-fresh-journal-mobile',390,844);await clickClose();
  await click('map'); assert.match(await text(),/Travel is paused/);assert.doesNotMatch(await evaluate("document.querySelector('#modalBody').innerText"),/Goblin Camp|Ancient Ruins|Whispering Forest|Eastern Gate/);await clickClose();
  await reachScene('breakfast');await finishMessages();await click('choice:1');assert.equal((await saved()).history.at(-2).role,'hero');assert.equal((await saved()).history.at(-1).speakerId,'friend');
  await screenshot('15-conversation-desktop');await checkConversation();await screenshot('16-conversation-mobile',390,844);await checkConversation();await screenshot('17-conversation-small-mobile',320,740);await checkConversation();await screenshot('19-conversation-short-mobile',320,568);await checkConversation();await screenshot('20-conversation-landscape',844,390);await checkConversation();
  await click('settings');await evaluate("document.querySelector('#theme').value='dark';document.querySelector('#theme').dispatchEvent(new Event('input',{bubbles:true}))");await clickClose();await screenshot('18-conversation-dark-mobile',390,844);await checkConversation();
  await click('settings');await evaluate("document.querySelector('#theme').value='classic';document.querySelector('#theme').dispatchEvent(new Event('input',{bubbles:true}))");await clickClose();
  await reachScene('chiefIntro');await evaluate("document.querySelector('#conversation').scrollTop=0");await click('continue');assert.ok(await evaluate("document.querySelector('#conversation').scrollTop<5"));assert.ok(await evaluate("!document.querySelector('.conversation-latest').hidden"));await click('latest');assert.ok(await evaluate("document.querySelector('#conversation').scrollHeight-document.querySelector('#conversation').scrollTop-document.querySelector('#conversation').clientHeight<5"));
  await evaluate("Promise.all([document.fonts.load('18px Alegreya'),document.fonts.load('18px Cinzel'),document.fonts.load('18px \"Cinzel Decorative\"')])");assert.ok(await evaluate("document.fonts.check('18px Alegreya') && document.fonts.check('18px Cinzel') && document.fonts.check('18px \"Cinzel Decorative\"')"));
  const checkpoint=await saved();await cdp('Page.reload');await waitFor("!!document.querySelector('[data-action=load]')");await click('load');assert.equal((await saved()).dialogue.cursor,checkpoint.dialogue.cursor);assert.equal((await saved()).history.length,checkpoint.history.length);
  await story();assert.ok((await saved()).flags.armed);await screenshot('25-village-short-mobile',320,568);await travel('gate');await click('tutorial');
  await screenshot('05-combat-desktop');await fight();await story();assert.ok((await saved()).flags.scout);await click('quests');assert.doesNotMatch(await evaluate("document.querySelector('#modalBody').innerText"),/Bring Him Home|Slay the Four Pillars|Defeat Charukola|Make your vow/);await clickClose();
  await click('smith');await click('metalQuest');await story();await click('merchant');await click('suppliesQuest');await story();
  await travel('forest');await click('search');await story();await travel('village');
  await click('smith');await click('returnMetal');await click('upgrade');assert.equal((await saved()).player.gold,32);await click('back');
  await click('merchant');await click('returnSupplies');await click('buyPotion');await click('back');
  assert.equal((await saved()).inventory.potion,2);await click('inventory');await click('equip:rusty');await click('equip:sharpened');await clickClose();
  await travel('forest');await click('hunt');await fight();await travel('camp');await click('campIntro');await story();
  await click('wave');await fight();await story();assert.equal((await saved()).waves,1);
  await travel('forest');await travel('village');assert.doesNotMatch(await evaluate("document.querySelector('#controls').innerText"),/Childhood Friend/);
  await cdp('Page.reload');await waitFor("!!document.querySelector('[data-action=load]')");await click('load');assert.equal((await saved()).waves,1);
  await travel('forest');await travel('camp');for(let i=0;i<2;i++){await click('wave');await fight();await story();}
  await click('treasure');await story();await click('inventory');await click('equip:bonking');await clickClose();
  await click('rescue');await story();assert.equal((await saved()).player.level,5);
  await screenshot('06-camp-desktop');await click('quests');await screenshot('07-journal-mobile',390,844);await clickClose();
  await click('settings');await evaluate("document.querySelector('#theme').value='dark';document.querySelector('#theme').dispatchEvent(new Event('input',{bubbles:true}))");await clickClose();
  await screenshot('08-dark-mobile',390,844);await screenshot('09-dark-desktop');
  await click('music');await waitFor("!document.querySelector('#music').paused");assert.ok(await evaluate("document.querySelector('#music').volume<=.3"));await click('music');assert.ok(await evaluate("document.querySelector('#music').paused"));
  await click('settings');await evaluate("document.querySelector('#muted').checked=true;document.querySelector('#muted').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#reducedMotion').checked=true;document.querySelector('#reducedMotion').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.ok(await evaluate("document.querySelector('#music').muted"));await clickClose();
  await travel('ruins');await click('gallery');await story();await click('boss');await fight();await story();assert.ok((await saved()).flags.boss);
  await click('reunion');await reachScene('confrontation');await finishMessages();
  await screenshot('21-four-choices-short-mobile',320,568);await screenshot('22-four-choices-landscape',844,390);await screenshot('23-four-choices-laptop',1366,640);await screenshot('24-four-choices-small-phone',320,480);
  const beforeScroll=await evaluate("({x:scrollX,y:scrollY})");await evaluate("document.querySelector('#conversation').scrollTop=0");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34});assert.deepEqual(await evaluate("({x:scrollX,y:scrollY})"),beforeScroll);await checkViewport();
  await click('choice:1');await story();assert.equal((await saved()).view,'complete');await screenshot('10-ending-desktop');await screenshot('11-ending-mobile',390,844);
  await click('history');assert.match(await text(),/THE HOMOSEXUAL EMPEROR/);await clickClose();await click('save');await click('menu');await click('load');assert.equal((await saved()).view,'complete');
  await cdp('Page.reload');await waitFor("!!document.querySelector('[data-action=load]')");await click('load');assert.match(await text(),/CHAPTER 1 COMPLETE/);assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
  await click('menu');await click('new');assert.match(await text(),/replaces the existing adventure/);await click('cancel');assert.equal((await saved()).view,'complete');await click('new');await click('confirmNew');assert.equal((await saved()).player.level,1);assert.equal((await saved()).waves,0);assert.equal((await saved()).scene,'prologue');
  await click('menu');await evaluate("fetch('/tests/fixtures/legacy-v1.json').then(r=>r.json()).then(v=>localStorage.setItem('kgd.chapter1.save',JSON.stringify(v.breakfast)))");await click('load');assert.match(await text(),/spoon to your forehead/);await click('continue');assert.ok((await saved()).dialogue);assert.equal((await saved()).flags.breakfast,'teasing');
  await click('menu');await evaluate("fetch('/tests/fixtures/legacy-v1.json').then(r=>r.json()).then(v=>localStorage.setItem('kgd.chapter1.save',JSON.stringify(v.complete)))");await click('load');assert.match(await text(),/CHAPTER 1 COMPLETE/);
  assert.deepEqual(errors,[],'No uncaught browser exceptions');
  console.log('PASS: full Chapter I via UI, optional quests, forest combat, wave persistence after reload, shops, equipment, treasure, rescue, boss, finale, history, new-game confirmation, dark theme, music play/pause/mute, mobile overflow, explicit message alignment, accumulated replies, scroll preservation, spoiler-free fresh panels, local fonts, legacy saves, viewport bounds and accessible choices after every action, short portrait/landscape screens, 25 screenshots.');
} finally { ws.close(); }
async function clickClose(){await evaluate("document.querySelector('#closeModal').click()");}
