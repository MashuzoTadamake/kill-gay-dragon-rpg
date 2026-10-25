import { createGame, dispatch, actions, journal, totalAttack, xpNeeded, canTravel, locationStatus, visibleLocations } from './js/engine.js';
import { STORY } from './js/story.js';
import { currentConversation, renderMessages, historyConversations } from './js/dialogue.js';
import { ITEMS, LOCATIONS, ENEMIES } from './js/data.js';
import { saveGame, loadGame, hasSave, readSettings, SETTINGS_KEY } from './js/save.js';

const app = document.querySelector('#app'), modal = document.querySelector('#modal'), modalBody = document.querySelector('#modalBody'), audio = document.querySelector('#music');
let state = null, menu = true, settings = readSettings(), toastTimer, lastFocus, conversationPinned = true;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paragraphs = text => text.split('\n\n').map(p => `<p>${escape(p).replaceAll('\n', '<br>')}</p>`).join('');
const button = (id, label, reason = '', cls = '') => `<button type="button" data-action="${escape(id)}" class="${cls}" ${reason ? `disabled title="${escape(reason)}"` : ''}>${escape(label)}${reason ? `<small>${escape(reason)}</small>` : ''}</button>`;
function toast(message) {
  if (!message) return;
  const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 6000);
}
function save(silent = false) {
  try { if (state) { saveGame(state); if (!silent) toast('Progress saved in this browser.'); } }
  catch { toast('Saving is unavailable. Keep this tab open; browser storage may be blocked or full.'); }
}
function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  audio.volume = settings.volume; audio.muted = settings.muted;
}
function persistSettings() { applySettings(); try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { toast('Settings could not be stored.'); } }
async function playMusic() {
  if (!settings.music) { audio.pause(); return; }
  try { await audio.play(); } catch { toast('Music is paused. Use the music button to try again. The game works without audio.'); }
}
function renderMenu() {
  app.innerHTML = `<section class="cover"><div class="eyebrow">A TEXT RPG WITH QUESTIONABLE HEROICS</div><div class="cover-mark" aria-hidden="true">⚔</div><h1>KILL THE<br><span>GAY DRAGON</span><em>RPG</em></h1><div class="ornament">◆ ━━━━━ ✦ ━━━━━ ◆</div><p class="chapter-label">CHAPTER I</p><h2>The Rise of the Chad</h2><p class="cover-copy">One rusty sword. One dear friend.<br>One dragon with a catastrophically bad plan.</p><div class="menu-actions">${button('new', 'Begin your story', '', 'primary')}${button('load', 'Continue adventure', hasSave() ? '' : 'No saved adventure yet')}${button('settings', 'Settings', '', 'quiet')}${button('credits', 'Credits', '', 'quiet')}</div><p class="fineprint">A fantasy comedy about friendship, courage, and refusing to read the villain’s manifesto.<br>Contains fantasy combat, peril, and absurd adult humor. Progress saves automatically.</p></section>`;
}
function objective() { return journal(state).find(q => q.status === 'active' && q.kind === 'main')?.description ?? (state.flags.complete ? 'A promise made. A journey yet to come.' : 'Follow the story. Your village needs you.'); }
function bars(hp, max, cls = '') { return `<div class="health-track ${cls}" role="progressbar" aria-label="Health" aria-valuenow="${hp}" aria-valuemax="${max}" aria-valuemin="0"><span style="width:${hp / max * 100}%"></span></div>`; }
function content() {
  const s = state, loc = LOCATIONS[s.location];
  if (s.view === 'story') {
    const n = STORY[s.scene];
    return `<div class="eyebrow">${escape(n.chapter ?? 'Chapter I · The Rise of the Chad')}</div><h2 id="sceneTitle" tabindex="-1">${escape(n.title)}</h2><div id="conversation" class="conversation ${n.fade ? 'fade-scene' : ''}" data-thread="${s.dialogue.conversation}" role="log" aria-label="Current conversation" aria-live="polite" aria-relevant="additions" tabindex="0">${renderMessages(currentConversation(s))}</div><button type="button" data-action="latest" class="quiet conversation-latest" hidden>↓ New messages · return to the latest</button>`;
  }
  if (s.view === 'complete') return `<div class="ending"><div class="eyebrow">CHAPTER 1 COMPLETE</div><div class="cover-mark">✦</div><h2 id="sceneTitle" tabindex="-1">The Rise of the Chad</h2><p>You survived the beginning.<br>You have a promise to keep.</p><div class="ornament">◆ ━━━━━ ✦ ━━━━━ ◆</div><h3>Main Quest Unlocked</h3><p class="quest-unlocked">SLAY THE FOUR PILLARS</p><p>“Save your friend. Defeat Kashit. Save heterosexuality. Maybe get a girlfriend.”</p><p class="eyebrow">TO BE CONTINUED — CHAPTER 2</p><p class="muted">This is the end of the playable chapter. Your journey is saved.</p>${button('menu', 'Return to main menu')}</div>`;
  if (s.view === 'combat' || s.view === 'defeat') {
    const c = s.combat, e = ENEMIES[c.kinds[c.index]];
    return `<div class="eyebrow">${c.kind === 'wave' ? `CAMP WAVE ${s.waves + 1} · GUARD ${c.index + 1} OF ${c.kinds.length}` : 'STEEL YOUR NERVES'}</div><h2 id="sceneTitle" tabindex="-1">${s.view === 'defeat' ? 'A setback. Not the end.' : e.name}</h2><div id="monsterStats"><div class="enemy-line"><strong>${escape(e.name)}</strong><span>${c.hp} / ${e.hp} HP</span></div>${bars(c.hp, e.hp, 'enemy')}<p class="enemy-quip">${escape(e.quip)}</p></div><div class="combat-log" role="log" aria-label="Combat log">${s.log.map(x => `<p>${escape(x)}</p>`).join('')}</div>${s.view === 'defeat' ? '<p>Your campaign is safe. Retry restores your HP and restarts this encounter. No rewards were awarded for the unfinished wave.</p>' : '<p class="muted">Attack and potions use a turn. Defend halves the next hit, rounded up. Fleeing always succeeds.</p>'}`;
  }
  const shopText = {
    smith: ['The Blacksmith', `“A sword should have an edge. Yours currently has a personality.”\n\nStandard sword tier: ${s.tier} / 2. Sharpened Sword: +8 ATK. Reinforced Sword: +16 ATK. You keep every weapon and may switch in your inventory. Bonuses never stack.${s.quests.metal === 'completed' ? '\n\n“Thanks for the iron. First upgrade is 30 gold for you.”' : ''}`],
    merchant: ['The Merchant', `“Welcome! All prices are final unless a dragon is standing behind you.”\n\nHealing potions cost 20 gold and restore 50 HP. In combat, drinking one gives the enemy a turn. Outside combat, use them freely from your inventory.\n\nYour purse: ${s.player.gold} gold.`],
    inn: ['The Leaf & Ladle', '“A bed, a bowl, and no goblins asking personal questions. Ten gold.”\n\nRest restores 40% of maximum HP, rounded up. You pay nothing when already fully healed. You may rest again if you need more recovery.'],
    chief: ['The Chief’s House', 'A map, a kettle, and an emergency cabbage cot. The chief has somehow made all three look worried.\n\nIf you have fewer than 10 gold and less than 40% HP, the free cot brings you back to 40% HP. It takes a long, uncomfortable afternoon; paying the inn restores more.']
  };
  if (shopText[s.view]) return `<div class="eyebrow">SHAMEPUR · ${s.player.gold} GOLD</div><h2 id="sceneTitle" tabindex="-1">${shopText[s.view][0]}</h2><div class="story-copy">${paragraphs(shopText[s.view][1])}</div>`;
  let extra = '';
  if (s.location === 'gate' && s.flags.tutorial) extra = 'The palisade is patched. The goblins have gone. Your first victory lives here now, and does not need to be fought again.';
  if (s.location === 'camp') extra = `Guard posts secured: ${s.waves} / 3. ${s.flags.rescued ? 'The cages stand open; the rescued villagers are safe.' : 'The prisoners are still waiting.'} ${s.flags.treasure ? 'The hidden chest is empty.' : ''}`;
  if (s.location === 'ruins') extra = s.flags.boss ? 'Charukola is permanently defeated. Your friend is behind the prison door. Opening it starts the final sequence and ends free exploration.' : `Charukola requires level 5. You are level ${s.player.level}. ${s.player.level < 5 ? 'You may retreat and prepare at any time.' : 'You are ready to challenge him. Bring a good weapon or healing supplies.'}`;
  if (s.location === 'village' && s.flags.friendGone) extra = 'Your friend’s usual place by the well is empty. Nobody has seen him return from the forest.';
  return `<div class="eyebrow">${escape(loc.subtitle)}</div><h2 id="sceneTitle" tabindex="-1">${escape(loc.name)}</h2><div class="story-copy"><p>${escape(loc.description)}</p>${extra ? `<p class="location-note">${escape(extra)}</p>` : ''}</div><div class="section-label">${s.location === 'village' ? 'PEOPLE & PLACES' : 'WHAT WILL YOU DO?'}</div>`;
}
function sidebar() {
  const s = state;
  if (s.view === 'story' || s.view === 'complete') return '';
  const c = s.combat, enemy = c ? ENEMIES[c.kinds[c.index]] : null;
  const context = enemy ? `<div class="eyebrow">ENEMY DOSSIER</div><p><strong>${enemy.name}</strong><br>${c.hp} / ${enemy.hp} HP<br>${enemy.damage[0]}–${enemy.damage[1]} damage per hit</p>`
    : s.location === 'village' ? `<div class="eyebrow">IN THE VILLAGE</div><p>Chief · Blacksmith · Merchant · Inn${!s.flags.friendGone ? '<br>Your Childhood Friend is here.' : '<br>Your friend’s place is empty.'}</p>`
    : s.location === 'forest' ? '<div class="eyebrow">OFF THE ROAD</div><p>Patrols are optional. Follow the stream for lost supplies. The road home is always open.</p>'
    : s.location === 'camp' ? `<div class="eyebrow">CAMP PROGRESS</div><p>${s.waves} / 3 waves secured.<br>${s.flags.rescued ? 'Prisoners freed.' : 'Prisoners awaiting rescue.'}</p>`
    : '<div class="eyebrow">TRAVELER’S NOTES</div><p>You can return to town before beginning the final prison sequence.</p>';
  return `<aside><div class="compass" aria-hidden="true">✥</div><section class="whereabouts"><div class="eyebrow">YOUR WHEREABOUTS</div><h3>${LOCATIONS[s.location].name}</h3></section><div class="side-divider"></div><section class="objective-block"><div class="eyebrow">CURRENT OBJECTIVE</div><p>${escape(objective())}</p></section><div class="side-divider"></div><section class="notes-block">${context}<dl><dt>Weapon</dt><dd>${ITEMS[s.equipped].name}</dd><dt>Potions</dt><dd>${s.inventory.potion ?? 0}</dd></dl></section>${s.flags.title ? '<p class="title-badge">✦ CHAD MALE<br><small>Defender of Shamepur</small></p>' : ''}</aside>`;
}
function render(focus = false) {
  const focusedAction = document.activeElement?.dataset.action;
  const previous = document.querySelector('#conversation');
  const scroll = previous ? { thread: previous.dataset.thread, top: previous.scrollTop, nearBottom: previous.scrollHeight - previous.scrollTop - previous.clientHeight < 48 } : null;
  app.dataset.view = menu ? 'menu' : state.view;
  app.dataset.location = state?.location ?? '';
  if (menu) { renderMenu(); return; }
  const p = state.player;
  app.innerHTML = `<div class="game-heading"><div><div class="eyebrow">CHAPTER I · THE RISE OF THE CHAD</div><h1>Kill The Gay Dragon <span>RPG</span></h1></div><span class="chapter-seal">I</span></div><section id="stats" aria-label="Player statistics"><span class="level-medallion">LV <strong id="levelText">${p.level}</strong></span><div class="hp-stat"><span>HP <strong id="healthText">${p.hp} / ${p.maxHp}</strong></span>${bars(p.hp, p.maxHp)}</div><span>XP <strong id="xpText">${p.level === 5 ? 'MAX' : `${p.xp} / ${xpNeeded(p.level)}`}</strong></span><span>ATK <strong>${totalAttack(state)}</strong></span><span class="gold-stat">◈ <strong id="goldText">${p.gold}</strong> GOLD</span></section><nav aria-label="Adventure panels">${[['map','♧','Map'],['inventory','⚔','Inventory'],['quests','☷','Quests'],['history','☰','History'],['settings','⚙','Settings']].map(([id,icon,label]) => `<button type="button" data-action="${id}" class="nav-button"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')}</nav><div class="book-layout ${['story','complete'].includes(state.view) ? 'cinematic' : ''}"><section class="page" aria-label="Story"><div id="text">${content()}</div><div id="controls" class="choices" aria-label="Game actions">${[...actions(state), ...(state.view === 'explore' ? [{ id: 'map', label: 'Travel · open world map' }] : [])].map(a => button(a.id, a.label, a.reason)).join('')}</div></section>${sidebar()}</div><div class="game-bottom">${button('music', settings.music ? '♫ Pause music' : '♫ Play music', '', 'quiet')}${button('save', 'Save', '', 'quiet')}${button('load', 'Load', '', 'quiet')}${button('menu', 'Main menu', '', 'quiet')}<span class="autosave">● AUTOSAVE ON</span></div>`;
  const conversation = document.querySelector('#conversation');
  if (conversation) {
    conversation.scrollTop = scroll?.thread === conversation.dataset.thread && !scroll.nearBottom ? scroll.top : conversation.scrollHeight;
    updateLatestButton();
  }
  if (focus) {
    const heading = document.querySelector('#sceneTitle');
    heading?.focus({ preventScroll: true });
  } else if (focusedAction) {
    [...app.querySelectorAll('button')].find(b => b.dataset.action === focusedAction && !b.disabled)?.focus({ preventScroll: true });
  }
}
function openPanel(title, html) {
  if (!modal.open) lastFocus = document.activeElement;
  document.querySelector('#modalTitle').textContent = title; modalBody.innerHTML = html;
  if (!modal.open) modal.showModal();
}
function mapPanel() {
  const can = state.view === 'explore';
  const known = visibleLocations(state);
  const roads = known.flatMap(([id, l], index) => l.links.filter(to => known.some(([other], i) => other === to && i > index)).map(to => `${l.name} ↔ ${LOCATIONS[to].name}`));
  openPanel('The roads of Shamepur', `<p class="muted">Your map records places you have discovered. Travel along connected roads; journeys never trigger mandatory random battles.</p>${!can ? '<p class="location-note">Travel is paused during dialogue or combat. Finish the current scene first.</p>' : ''}${roads.length ? `<div class="map-path-label">${roads.map(escape).join('<br>')}</div>` : ''}<div class="world-map">${known.map(([id,l]) => {
    const status = locationStatus(state,id);
    const reason = status === 'current' ? 'You are here' : !can ? 'Travel paused' : !canTravel(state,id) ? 'Travel through a connected location first' : '';
    return `<article class="map-node ${status}"><span class="map-icon">${l.icon}</span><div><h3>${escape(l.name)}</h3><p>${status.toUpperCase()}</p>${button(`travel:${id}`, status === 'current' ? 'Current location' : `Travel to ${l.name}`,reason)}</div></article>`;
  }).join('')}</div>`);
}
function inventoryPanel() {
  openPanel('Your traveling pack', `<p>Base ATK ${state.player.attack} + weapon ${ITEMS[state.equipped].bonus} = <strong>${totalAttack(state)} ATK</strong>. Only one weapon bonus applies.</p>${['weapon','consumable','quest'].map(category => `<h3 class="section-label">${{weapon:'WEAPONS',consumable:'CONSUMABLES',quest:'QUEST ITEMS'}[category]}</h3><div class="item-list">${Object.entries(state.inventory).filter(([id,q])=>q>0 && ITEMS[id].category===category).map(([id,q])=>{ const i=ITEMS[id]; return `<article class="item"><div><span class="rarity ${i.rarity.toLowerCase()}">${i.rarity}</span><h3 class="${i.rarity === 'Rare' ? 'gilded' : ''}">${i.name}${category==='consumable'?` ×${q}`:''}</h3><p>${i.description}</p>${category==='weapon'?`<strong>+${i.bonus} ATK</strong>`:''}</div>${category==='weapon'?button(`equip:${id}`,state.equipped===id?'Equipped':'Equip',state.equipped===id?'Currently equipped':state.view!=='explore'?'Equip between encounters':''):category==='consumable'?button('drink','Drink potion',state.view!=='explore'?'Use the combat action during battle':state.player.hp===state.player.maxHp?'HP already full':''):''}</article>`; }).join('') || '<p class="muted">Nothing here yet.</p>'}</div>`).join('')}`);
}
function questsPanel() {
  const known = journal(state);
  const sections = [
    ['Main quests', known.filter(q => q.kind === 'main' && q.status !== 'completed')],
    ['Village errands', known.filter(q => q.kind === 'side' && q.status !== 'completed')],
    ['Completed quests', known.filter(q => q.status === 'completed')]
  ];
  openPanel('The quest journal', sections.filter(([, quests]) => quests.length).map(([label, quests]) => `<section class="quest-section"><h3 class="section-label">${label}</h3>${quests.map(q => `<article class="quest ${q.status === 'completed' ? 'quest--completed' : ''}"><span class="quest-status">${q.status}</span><h3>${escape(q.name)}</h3><p>${escape(q.description)}</p><ul>${q.steps.map(([text,done]) => `<li class="${done ? 'done' : ''}">${done ? '✓' : '○'} ${escape(text)}</li>`).join('')}</ul></article>`).join('')}</section>`).join(''));
}
function settingsPanel() { openPanel('A few creature comforts', `<div class="settings-grid"><label for="theme">Parchment theme</label><select id="theme"><option value="classic" ${settings.theme==='classic'?'selected':''}>Classic Parchment</option><option value="dark" ${settings.theme==='dark'?'selected':''}>Dark Parchment</option></select><label for="volume">Music volume <output id="volumeOutput">${Math.round(settings.volume*100)}%</output></label><input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><label class="check"><input id="muted" type="checkbox" ${settings.muted?'checked':''}> Mute audio</label><label class="check"><input id="reducedMotion" type="checkbox" ${settings.reducedMotion?'checked':''}> Reduce motion (freeze the forest background)</label>${button('music',settings.music?'Pause background music':'Play background music')}</div><p class="muted">Dialogue advances at your pace. Audio begins only after an interaction. Settings stay in this browser.</p>`); }
function creditsPanel() { openPanel('The people behind the nonsense', '<div class="story-copy"><p><strong>Original game: sanbi / sanbisensei.</strong><br><a href="https://github.com/sanbisensei/kill-gay-dragon-rpg" target="_blank" rel="noopener">Original project</a></p><p><strong>Fork and development: MashuzoTadamake.</strong><br><a href="https://github.com/MashuzoTadamake/kill-gay-dragon-rpg" target="_blank" rel="noopener">This project on GitHub</a></p><p>Caffeine Code branding, the autumn background (<code>bg.gif</code>), music (<code>bgm.mp3</code>), and original image assets are preserved from the supplied repository. No separate asset author or license information was supplied; ownership remains with the respective creators.</p><p>Typography: Cinzel and Cinzel Decorative by Natanael Gama / the Cinzel Project Authors; Alegreya by the Alegreya Project Authors. Local font files and SIL Open Font License notices are bundled in <code>assets/fonts</code>.</p><p>Chapter I expands the original vanilla JavaScript text RPG. No external services or accounts required.</p></div>'); }
function closePanel() {
  modal.close();
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  else app.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}
function confirmPanel(title, text, action, label) { openPanel(title, `<p>${text}</p><div class="choices">${button(action,label)}${button('cancel','Cancel','','quiet')}</div>`); }
function startNew() { state = createGame(); menu = false; closePanel(); save(true); render(true); playMusic(); }
function doLoad() {
  try { const loaded = loadGame(); if (!loaded) { toast('No saved adventure found.'); return; } state = loaded; menu = false; closePanel(); render(true); toast('Adventure restored.'); playMusic(); }
  catch (e) { openPanel('The save could not be read', `<p>${escape(e.message)} Your existing save has not been overwritten. You may return to the menu or explicitly begin a new game.</p>`); }
}
function updateLatestButton() {
  const conversation = document.querySelector('#conversation');
  const latest = document.querySelector('.conversation-latest');
  if (conversation && latest) {
    conversationPinned = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 48;
    latest.hidden = conversationPinned;
  }
}
window.addEventListener('resize', () => {
  const conversation = document.querySelector('#conversation');
  if (conversation && conversationPinned) conversation.scrollTop = conversation.scrollHeight;
  updateLatestButton();
});
app.addEventListener('scroll', event => { if (event.target.id === 'conversation') updateLatestButton(); }, true);
function handle(id) {
  if (id === 'latest') {
    const conversation = document.querySelector('#conversation');
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
    updateLatestButton(); return;
  }
  if (id === 'new') { if (hasSave() || state) confirmPanel('Begin a new adventure?', 'This replaces the existing adventure saved in this browser. Your current progress will be lost.', 'confirmNew', 'Start new game'); else startNew(); return; }
  if (id === 'confirmNew') { startNew(); return; }
  if (id === 'cancel') { closePanel(); return; }
  if (id === 'load') { if (state && !menu) confirmPanel('Load the saved adventure?', 'Restore the most recent autosave or manual save from this browser?', 'confirmLoad', 'Load saved game'); else doLoad(); return; }
  if (id === 'confirmLoad') { doLoad(); return; }
  if (id === 'settings') { settingsPanel(); return; }
  if (id === 'credits') { creditsPanel(); return; }
  if (id === 'music') { settings.music = !settings.music; persistSettings(); playMusic(); if (modal.open && document.querySelector('#volume')) settingsPanel(); else render(); return; }
  if (id === 'save') { save(); return; }
  if (id === 'menu') { save(true); menu = true; render(); return; }
  if (menu || !state) return;
  if (id === 'map') { mapPanel(); return; }
  if (id === 'inventory') { inventoryPanel(); return; }
  if (id === 'quests') { questsPanel(); return; }
  if (id === 'history') {
    openPanel('Pages already written', historyConversations(state).map(group => `<section class="history-conversation"><h3 class="conversation-divider">${escape(group.title)}</h3>${renderMessages(group.messages)}</section>`).join('') || '<p>Your story is still ahead.</p>'); return;
  }
  const before = state;
  state = dispatch(state, id);
  if (state === before) return;
  save(true); render(!id.startsWith('equip:') && id !== 'drink' && !['attack','defend','potion'].includes(id)); toast(state.notice);
  if (id.startsWith('travel:')) closePanel();
  else if (id.startsWith('equip:') || id === 'drink') inventoryPanel();
}
document.addEventListener('click', event => { const b = event.target.closest('button[data-action]'); if (b && !b.disabled) handle(b.dataset.action); });
document.querySelector('#closeModal').addEventListener('click', closePanel);
modal.addEventListener('click', e => { if(e.target === modal) { const r=modal.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) closePanel(); } });
modal.addEventListener('input', event => {
  const el=event.target;
  if (el.id === 'theme') settings.theme=el.value;
  else if (el.id === 'volume') { settings.volume=Number(el.value); document.querySelector('#volumeOutput').textContent=`${Math.round(settings.volume*100)}%`; }
  else if (el.id === 'muted' || el.id === 'reducedMotion') settings[el.id]=el.checked;
  else return;
  persistSettings();
});
audio.addEventListener('error',()=>toast('The local music asset could not play. Your adventure can continue without audio.'));
applySettings(); render();
