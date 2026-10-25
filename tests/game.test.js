import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, actions, applyXp, heal, rollDamage, totalAttack, canTravel, journal, grantItem } from '../js/engine.js';
import { serialize, deserialize, loadGame, saveGame, SAVE_KEY, readSettings } from '../js/save.js';
import { ENEMIES, WAVES } from '../js/data.js';
import { STORY } from '../js/story.js';
const go = (s, id, rng = () => .5) => dispatch(s, id, rng);
function advance(s) { for (let i = 0; i < 100 && s.view === 'story'; i++) s = go(s, actions(s)[0].id); return s; }
function win(s) {
  for (let i = 0; i < 100 && s.view === 'combat'; i++) s = go(s, 'attack', () => 0);
  assert.notEqual(s.view, 'defeat'); return s;
}
function defended() {
  let s = advance(createGame()); s = go(s, 'travel:gate'); s = win(go(s, 'tutorial')); return advance(s);
}
function campReady() { let s = defended(); s = go(s, 'travel:forest'); s = go(s, 'travel:camp'); return advance(go(s, 'campIntro')); }
function campCleared() { let s = campReady(); for (let i = 0; i < 3; i++) s = advance(win(go(s, 'wave'))); return s; }
function bossReady() { let s = campCleared(); s = advance(go(s, 'rescue')); s = go(s, 'travel:ruins'); s = advance(go(s, 'gallery')); return s; }

test('new game preserves original starting stats and has one authoritative inventory', () => {
  const s = createGame(); assert.deepEqual(s.player, {level:1,xp:0,hp:100,maxHp:100,attack:10,gold:50});
  assert.equal(s.scene,'prologue'); assert.deepEqual(s.inventory,{rusty:1,potion:0}); assert.deepEqual(s.unlocked,['village']);
});
test('XP thresholds, surplus, level healing, and level cap', () => {
  const p=createGame().player;
  assert.equal(applyXp(p,29).level,1); assert.equal(applyXp(p,30).level,2); assert.equal(applyXp(p,45).xp,15);
  assert.equal(applyXp(p,239).level,4); const max=applyXp({...p,hp:1},240);
  assert.deepEqual(max,{level:5,xp:0,hp:180,maxHp:180,attack:22,gold:50});
  assert.equal(applyXp(max,10000).xp,0); assert.equal(applyXp(max,10000).maxHp,180);
});
test('enemy damage bounds inclusive; attack is fixed and a killing blow has no counter', () => {
  assert.equal(rollDamage([4,8],()=>0),4); assert.equal(rollDamage([4,8],()=>.99999),8); assert.equal(rollDamage([4,8],()=>1),8);
  let s=advance(createGame()); s=go(go(s,'travel:gate'),'tutorial'); const hp=s.player.hp;
  s=go(s,'attack',()=>0); assert.equal(s.combat.hp,25); assert.equal(s.player.hp,hp-4);
  s.combat.hp=10; const before=s.player.hp; s=go(s,'attack',()=>1); assert.equal(s.player.hp,before); assert.ok(s.flags.tutorial);
});
test('defend reduces the next enemy hit by half rounded up, and only that hit', () => {
  let s=go(go(advance(createGame()),'travel:gate'),'tutorial'); s=go(s,'defend',()=>.25);
  assert.equal(s.player.hp,97); assert.equal(s.combat.hp,35); s=go(s,'attack',()=>.25); assert.equal(s.player.hp,92);
});
test('healing caps at maximum and potions use a turn only in battle', () => {
  assert.equal(heal({...createGame().player,hp:80},50).hp,100); assert.equal(heal(createGame().player,-999).hp,0);
  let s=defended(); s.inventory.potion=2; s.player.hp=90; s=go(s,'drink'); assert.equal(s.player.hp,100); assert.equal(s.inventory.potion,1);
  s=go(go(s,'travel:forest'),'hunt',()=>1); s.player.hp=60; s=go(s,'potion',()=>0); assert.equal(s.player.hp,96); assert.equal(s.inventory.potion,0);
  assert.equal(go(s,'potion'),s);
});
test('shops cannot overdraw gold, resting is rounded and free at full HP', () => {
  let s=go(defended(),'merchant'); s.player.gold=19; assert.equal(go(s,'buyPotion'),s); s.player.gold=20; s=go(s,'buyPotion'); assert.equal(s.player.gold,0); assert.equal(s.inventory.potion,1);
  s=go(go(s,'back'),'inn'); s.player.gold=10; s.player.hp=1; s=go(s,'rest'); assert.equal(s.player.hp,41); assert.equal(s.player.gold,0);
  s.player.hp=s.player.maxHp; s.player.gold=10; assert.equal(go(s,'rest'),s);
});
test('equipment bonuses never stack, rare weapons survive standard upgrades, unique rewards cannot duplicate', () => {
  let s=defended(); grantItem(s,'bonking'); grantItem(s,'bonking'); assert.equal(s.inventory.bonking,1);
  s=go(s,'equip:bonking'); assert.equal(totalAttack(s),30); s.player.gold=500;
  s=go(s,'smith'); s=go(s,'upgrade'); s=go(s,'upgrade'); assert.equal(s.equipped,'bonking'); assert.equal(totalAttack(s),30); assert.equal(s.player.attack,10);
  s=go(s,'back'); s=go(s,'equip:reinforced'); assert.equal(totalAttack(s),26); s=go(s,'equip:rusty'); assert.equal(totalAttack(s),10); assert.equal(go(s,'equip:fake'),s);
});
test('map connections and quest flags control progression, even at level 5', () => {
  let s=advance(createGame()); s.player=applyXp(s.player,240); assert.equal(canTravel(s,'forest'),false); assert.equal(go(s,'travel:ruins'),s);
  assert.equal(canTravel(s,'gate'),true); s=go(s,'travel:gate'); assert.equal(go(s,'travel:forest'),s);
  s=win(go(s,'tutorial')); assert.equal(go(s,'travel:village'),s); s=advance(s); assert.ok(s.unlocked.includes('forest')); assert.ok(!s.unlocked.includes('ruins'));
  assert.equal(journal(s).find(q=>q.name==='Defend Shamepur').status,'completed');
});
test('wave rewards are atomic; fleeing or dying on guard two cannot farm guard one', () => {
  let s=go(campReady(),'wave'); s=go(go(go(go(s,'attack'),'attack'),'attack'),'attack');
  assert.equal(s.combat.index,1); assert.equal(s.player.xp,20); assert.equal(s.player.gold,62);
  s=go(s,'flee'); assert.equal(s.waves,0); s=go(s,'wave'); assert.equal(s.combat.index,0);
  s=advance(win(s)); assert.equal(s.waves,1); assert.equal(s.player.gold,86); assert.equal(s.player.level,2); assert.equal(s.player.xp,30);
  s=go(s,'travel:forest'); s=go(s,'travel:village'); s=deserialize(serialize(s)); s=go(go(s,'travel:forest'),'travel:camp'); assert.equal(s.waves,1);
});
test('defeat offers retry and safe return without clearing previous waves', () => {
  let s=advance(win(go(campReady(),'wave'))); s=go(s,'wave'); s.player.hp=1; const gold=s.player.gold; s=go(s,'defend',()=>1); assert.equal(s.view,'defeat');
  const saved=deserialize(serialize(s)); s=go(saved,'retry'); assert.equal(s.player.hp,s.player.maxHp); assert.equal(s.waves,1); assert.equal(s.player.gold,gold); assert.equal(s.combat.index,0);
  s.player.hp=1; s=go(s,'defend',()=>1); s=go(s,'safe'); assert.equal(s.location,'village'); assert.equal(s.waves,1); assert.ok(s.player.hp>0);
});
test('chief emergency recovery prevents HP/gold softlocks and is limited', () => {
  let s=defended(); s.player.gold=0; s.player.hp=1; s=go(s,'chief'); s=go(s,'emergency'); assert.equal(s.player.hp,40); assert.equal(go(s,'emergency'),s);
});
test('prisoners and treasure award once; guaranteed main story reaches level 5', () => {
  let s=campCleared(); assert.equal(s.waves,3); assert.equal(s.player.level,4); assert.equal(s.player.xp,35);
  assert.equal(s.inventory.key,1); s=advance(go(s,'rescue')); assert.equal(s.player.level,5); assert.equal(s.player.xp,0); assert.ok(s.unlocked.includes('ruins')); assert.equal(go(s,'rescue'),s);
  s=advance(go(s,'treasure')); assert.equal(s.inventory.bonking,1); assert.equal(go(s,'treasure'),s);
});
test('Charukola is gated at level 5 and never repeats after victory', () => {
  let s=bossReady(); const p=s.player; s.player={...p,level:4}; assert.equal(go(s,'boss'),s); s.player=p;
  s=advance(win(go(s,'boss'))); assert.ok(s.flags.boss); assert.equal(go(s,'boss'),s); assert.ok(actions(s).some(a=>a.id==='reunion'));
});
test('both optional quests require acceptance, search, and one-time turn-in', () => {
  let s=defended(); s=go(s,'smith'); s=advance(go(s,'metalQuest')); s=go(s,'merchant'); s=advance(go(s,'suppliesQuest'));
  s=go(s,'travel:forest'); s=advance(go(s,'search')); assert.equal(s.inventory.metal,1); assert.equal(s.inventory.supplies,1);
  s=go(s,'travel:village'); s=go(s,'smith'); s=go(s,'returnMetal'); const xp=s.player.xp; assert.equal(go(s,'returnMetal'),s); assert.equal(s.quests.metal,'completed'); assert.equal(s.inventory.metal,undefined);
  const g=s.player.gold; s=go(s,'upgrade'); assert.equal(s.player.gold,g-30); assert.equal(s.player.xp,xp);
  s=go(go(s,'back'),'merchant'); s=go(s,'returnSupplies'); assert.equal(s.inventory.potion,1); assert.equal(go(s,'returnSupplies'),s);
});
test('friend disappears from village after capture and story choices persist', () => {
  let s=campReady(); s=go(go(s,'travel:forest'),'travel:village'); assert.ok(!actions(s).some(a=>a.id==='friend'));
  assert.equal(deserialize(serialize(s)).flags.breakfast,'grateful');
});
test('Kashit has only cinematic choices: all branches reach kidnapping and completion without consuming inventory', () => {
  const base=bossReady();
  for(let branch=0;branch<4;branch++) {
    let s=advance(win(go(base,'boss'))); s.inventory.potion=3; s=go(s,'reunion');
    while(s.scene!=='confrontation') s=go(s,actions(s)[0].id);
    while(s.dialogue.cursor < STORY[s.scene].messages.length) s=go(s,'continue');
    assert.equal(go(s,'travel:camp'),s); assert.equal(go(s,'attack'),s); assert.equal(go(s,'drink'),s);
    s=go(s,`choice:${branch}`); s=advance(s); assert.equal(s.view,'complete'); assert.ok(s.flags.complete); assert.equal(s.inventory.potion,3);
    s=deserialize(serialize(s)); assert.equal(s.view,'complete'); assert.ok(s.flags.complete); assert.equal(go(s,'travel:forest'),s);
  }
});
test('every dialogue transition resolves; completed and fresh games are independent', () => {
  for(const n of Object.values(STORY)) for(const next of [n.next,...(n.choices??[]).map(c=>c.next)].filter(Boolean)) assert.ok(STORY[next] || ['explore','complete'].includes(next),next);
  const a=createGame(), b=createGame(); a.flags.complete=true; a.inventory.potion=55; assert.equal(b.flags.complete,undefined); assert.equal(b.inventory.potion,0);
});
test('save/load restores mid-battle, dialogue, quests, and all inventory fields', () => {
  const map=new Map(), storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  let s=go(campReady(),'wave'); s=go(s,'attack'); saveGame(s,storage); assert.deepEqual(loadGame(storage),s);
  assert.equal(loadGame({getItem:()=>null}),null); map.set(SAVE_KEY,'bad JSON'); assert.throws(()=>loadGame(storage));
});
test('corrupt and incompatible saves are rejected gracefully', () => {
  const original=createGame();
  for (const mutate of [s=>s.version=999,s=>s.player.gold=-1,s=>s.player.hp=101,s=>s.equipped='missing',s=>s.waves=4,s=>s.scene='unknown',s=>s.inventory.bonking=2,s=>s.unlocked=['unknown'],s=>s.history=[{}],s=>s.flags.rescued=true]) {
    const s=structuredClone(original); mutate(s); assert.throws(()=>deserialize(JSON.stringify(s)));
  }
  assert.equal(readSettings({getItem:()=>'{'}).volume,.25);
});
test('complete main path survives a reload after every action without optional purchases or grinding', () => {
  let s=createGame(), steps=0;
  const take=id=>{s=deserialize(serialize(go(s,id,()=>.5))); assert.ok(++steps<400);};
  const talk=()=>{while(s.view==='story')take(actions(s)[0].id);};
  const battle=()=>{while(s.view==='combat')take('attack');assert.notEqual(s.view,'defeat');talk();};
  talk(); take('travel:gate');take('tutorial');battle();take('travel:forest');take('travel:camp');take('campIntro');talk();
  for(let i=0;i<3;i++){take('wave');battle();}
  take('rescue');talk();take('travel:ruins');take('gallery');talk();take('boss');battle();take('reunion');talk();
  assert.equal(s.view,'complete'); assert.equal(s.player.level,5); console.log(`Main path: ${steps} validated actions, level ${s.player.level}, ${s.player.hp} HP.`);
});

test('fresh journals and maps expose only the opening objective and home', async () => {
  const { visibleLocations } = await import('../js/engine.js');
  const s = createGame();
  assert.deepEqual(journal(s).map(q => q.id), ['opening']);
  assert.deepEqual(visibleLocations(s).map(([id]) => id), ['village']);
  assert.doesNotMatch(JSON.stringify(journal(s)), /Charukola|Kashit|kidnap|Pillars|Bring Him Home|Missing Supplies|Goblin Menace/);
  assert.deepEqual(journal(deserialize(serialize(s))), journal(s));
});
test('quest visibility follows defense, scout, prisoner, boss, and conclusion milestones', () => {
  let s = advance(createGame());
  assert.deepEqual(journal(s).map(q => q.id), ['opening', 'defend']);
  s = win(go(go(s, 'travel:gate'), 'tutorial'));
  while (s.scene !== 'scout') s = go(s, actions(s)[0].id);
  assert.ok(!journal(s).some(q => q.id === 'camp'));
  s = go(s, 'continue');
  assert.equal(journal(s).find(q => q.id === 'camp').status, 'available');
  s = advance(s); assert.equal(journal(s).find(q => q.id === 'camp').status, 'active');
  assert.ok(!journal(s).some(q => q.id === 'friend'));
  s = campCleared(); s = go(s, 'rescue');
  assert.ok(!journal(s).some(q => q.id === 'friend'));
  s = advance(s); assert.ok(journal(s).some(q => q.id === 'friend'));
  assert.doesNotMatch(JSON.stringify(journal(s)), /Defeat Charukola|Make your vow|Slay the Four Pillars/);
  s = go(s, 'travel:ruins'); s = advance(go(s, 'gallery'));
  assert.match(JSON.stringify(journal(s)), /Defeat Charukola/);
  s = advance(win(go(s, 'boss'))); s = go(s, 'reunion');
  while (s.scene !== 'vow') s = go(s, actions(s)[0].id);
  assert.ok(!journal(s).some(q => q.id === 'pillars'));
  s = advance(s); assert.ok(journal(s).some(q => q.id === 'pillars'));
});
test('side quests are hidden until their relevant NPC has been met', () => {
  let s = defended(); assert.ok(!journal(s).some(q => q.kind === 'side'));
  s = go(s, 'smith'); assert.equal(journal(s).find(q => q.id === 'metal').status, 'available');
  assert.ok(!journal(s).some(q => q.id === 'supplies'));
  s = go(go(s, 'back'), 'merchant'); assert.equal(journal(s).find(q => q.id === 'supplies').status, 'available');
  assert.deepEqual(journal(deserialize(serialize(s))), journal(s));
});
test('each dialogue step reveals one authored message and history contains no future prose', () => {
  let s = createGame(); assert.equal(s.history.length, 1); assert.equal(s.history[0].role, 'narrator');
  assert.doesNotMatch(s.history[0].text, /Kashit|centuries of slumber/);
  const first = s.history[0]; s = go(s, 'continue'); assert.equal(s.scene, 'prologue'); assert.equal(s.history.length, 2); assert.deepEqual(s.history[0], first);
  assert.equal(deserialize(serialize(s)).dialogue.cursor, 2);
});
test('all story messages and choices declare explicit speaker metadata', async () => {
  const { SPEAKERS } = await import('../js/story.js');
  for (const [id, n] of Object.entries(STORY)) {
    assert.ok(n.messages.length, id); assert.ok(n.conversation); assert.ok(n.title);
    for (const m of n.messages) { assert.ok(SPEAKERS[m.speakerId], id); assert.equal(m.role, SPEAKERS[m.speakerId].role); assert.equal(m.speaker, SPEAKERS[m.speakerId].name); }
    for (const c of n.choices ?? []) assert.equal(c.speakerId, 'hero');
  }
});
test('selected replies accumulate on the Hero side before the NPC answer', async () => {
  const { currentConversation } = await import('../js/dialogue.js');
  let s = createGame(); while (s.scene !== 'breakfast') s = go(s, actions(s)[0].id);
  while (s.dialogue.cursor < STORY.breakfast.messages.length) { assert.equal(actions(s)[0].id, 'continue'); s = go(s, 'continue'); }
  const length = currentConversation(s).length, selected = STORY.breakfast.choices[1].label;
  s = go(s, 'choice:1'); const messages = currentConversation(s);
  assert.equal(messages.length, length + 2); assert.equal(messages.at(-2).role, 'hero'); assert.equal(messages.at(-2).text, selected); assert.equal(messages.at(-1).speakerId, 'friend');
  assert.equal(s.flags.breakfast, 'teasing'); assert.ok(!messages.some(m => m.text.includes('Everyone likes it')));
});
test('message renderer uses metadata, separates all four roles, and escapes prose', async () => {
  const { renderMessages } = await import('../js/dialogue.js');
  const { message } = await import('../js/story.js');
  const html = renderMessages([message('hero', 'A dragon says “I am the hero.” <script>'), message('friend', 'You are an idiot.'), message('n', 'The world turns.'), message('s', 'Achievement earned.')]);
  for (const role of ['hero', 'npc', 'narrator', 'system']) assert.match(html, new RegExp(`message--${role}`));
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /data-speaker="hero"/);
});
test('conversations have boundaries while history keeps earlier exchanges', async () => {
  const { currentConversation, historyConversations } = await import('../js/dialogue.js');
  let s = createGame(); while (s.scene !== 'breakfast') s = go(s, actions(s)[0].id);
  assert.ok(!currentConversation(s).some(m => m.scene === 'prologue'));
  assert.ok(historyConversations(s).some(g => g.messages.some(m => m.scene === 'prologue')));
});
test('legacy V1 saves migrate dialogue without resetting stats, flags, waves, or equipment', async () => {
  const { readFile } = await import('node:fs/promises');
  const snapshots = JSON.parse(await readFile(new URL('./fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  for (const old of Object.values(snapshots)) {
    const s = deserialize(JSON.stringify(old));
    for (const key of ['player', 'inventory', 'equipped', 'tier', 'location', 'waves', 'quests', 'flags', 'view', 'scene']) assert.deepEqual(s[key], old[key], key);
    assert.ok(s.history.every(m => ['hero','npc','narrator','system'].includes(m.role)));
    assert.deepEqual(deserialize(serialize(s)), s);
  }
  const opening = deserialize(JSON.stringify(snapshots.opening)); assert.doesNotMatch(JSON.stringify(journal(opening)), /Charukola|Pillars|kidnap/);
  let breakfast = deserialize(JSON.stringify(snapshots.breakfast)); assert.equal(breakfast.dialogue.cursor, STORY[breakfast.scene].messages.length);
  assert.ok(breakfast.history.some(m => m.choice && m.role === 'hero')); breakfast = advance(breakfast); assert.ok(breakfast.flags.armed);
  assert.equal(deserialize(JSON.stringify(snapshots.complete)).view, 'complete');
});
test('corrupt dialogue metadata and cursors are rejected', () => {
  let s=createGame(); s.dialogue.cursor=999; assert.throws(()=>deserialize(JSON.stringify(s)));
  s=createGame(); s.history[0].role='hero'; assert.throws(()=>deserialize(JSON.stringify(s)));
});

test('the secretary stays unidentified and the Childhood Friend label stays consistent', async () => {
  const { SPEAKERS } = await import('../js/story.js');
  assert.equal(SPEAKERS.friend.name, 'Childhood Friend');
  for (const n of Object.values(STORY)) for (const m of n.messages) {
    if (m.speakerId === 'friend') assert.equal(m.speaker, 'Childhood Friend');
    assert.doesNotMatch(m.text, /goblin secretary/i);
  }
  const secretary = STORY.plan.messages.find(m => m.text.includes('secretary'));
  assert.match(secretary.text, /mysterious, hooded secretary/);
  assert.match(secretary.text, /not covered by dental/);
  assert.doesNotMatch(secretary.text, /goblin|Pillars|species/i);
});
test('the hero assumes a gender while the Childhood Friend objects without confirming it', () => {
  assert.equal(STORY.dragonThreat.messages.length, 10, 'Existing message slots stay compatible');
  const assumption = STORY.dragonThreat.messages.find(m => m.text.includes('He’s a guy'));
  assert.equal(assumption.speakerId, 'hero');
  const objection = STORY.dragonThreat.messages.find(m => m.text.includes('ANSWER FOR ME'));
  assert.equal(objection.speakerId, 'friend');
  assert.ok(STORY.dragonThreat.messages.some(m => m.speakerId === 'dragon' && m.text.includes('VERY interesting')));
  for (const id of ['breakfast','breakfastWarm','breakfastTease','worried','worriedTease','farewell','reunion','reunionQuiet','reunionDinner','friendVisit','recognition']) {
    for (const m of STORY[id].messages) if (m.role === 'narrator') assert.doesNotMatch(m.text, /\b(he|him|his|boy|male|lad)\b/i, id);
  }
  for (const n of Object.values(STORY)) for (const m of n.messages) if (m.speakerId === 'friend') assert.doesNotMatch(m.text, /I[’']M A GUY|I am (a man|male|a boy)/i);
});
test('older message saves refresh edited prose without changing the cursor or progression', () => {
  let s=createGame(); while(s.scene!=='plan') s=go(s,actions(s)[0].id); s=go(s,'continue');
  s.history.at(-1).text='His goblin secretary raised a finger.';
  const restored=deserialize(JSON.stringify(s));
  assert.equal(restored.dialogue.cursor,s.dialogue.cursor); assert.deepEqual(restored.player,s.player); assert.deepEqual(restored.flags,s.flags);
  assert.match(restored.history.at(-1).text,/mysterious, hooded/); assert.doesNotMatch(restored.history.at(-1).text,/goblin secretary/);
  assert.equal(restored.history.length,s.history.length);
});
