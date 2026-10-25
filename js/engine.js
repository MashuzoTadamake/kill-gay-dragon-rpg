import { CONFIG, VERSION, ITEMS, ENEMIES, WAVES, LOCATIONS } from './data.js';
import { STORY, message } from './story.js';
export const xpNeeded = level => CONFIG.xpThresholds[level - 1] ?? 0;
export const totalAttack = state => state.player.attack + ITEMS[state.equipped].bonus;
export const rollDamage = ([min, max], random = Math.random) => min + Math.min(max - min, Math.max(0, Math.floor(random() * (max - min + 1))));
export const heal = (player, amount) => ({ ...player, hp: Math.max(0, Math.min(player.maxHp, player.hp + amount)) });
export function applyXp(player, amount) {
  const p = { ...player, xp: player.xp + Math.max(0, amount) };
  while (p.level < 5 && p.xp >= xpNeeded(p.level)) {
    p.xp -= xpNeeded(p.level); p.level++; p.maxHp += 20; p.attack += 3; p.hp = p.maxHp;
  }
  if (p.level === 5) p.xp = 0;
  return p;
}
export function createGame() {
  const s = { version: VERSION, player: { ...CONFIG.start }, inventory: { rusty: 1, potion: 0 }, equipped: 'rusty', tier: 0,
    location: 'village', unlocked: ['village'], flags: {}, waves: 0, quests: { metal: 'available', supplies: 'available' },
    view: 'story', scene: 'prologue', combat: null, history: [], dialogue: null, log: [], notice: 'Your story begins.' };
  enterScene(s, 'prologue'); return s;
}
const notify = (s, message) => { s.notice = message; };
function reward(s, xp, gold = 0) {
  const old = s.player.level;
  s.player = applyXp({ ...s.player, gold: s.player.gold + gold }, xp);
  notify(s, `+${xp} XP · +${gold} gold${s.player.level > old ? ` · LEVEL ${s.player.level}! Full HP restored.` : ''}`);
}
export function grantItem(s, id, amount = 1) {
  if (!ITEMS[id]) return;
  s.inventory[id] = ITEMS[id].category === 'consumable' ? (s.inventory[id] ?? 0) + amount : 1;
}
function unlock(s, ...ids) { s.unlocked = [...new Set([...s.unlocked, ...ids])]; }
function effect(s, id) {
  // Every narrative reward is keyed; revisiting history or reloading cannot claim it twice.
  if (!id || s.flags[`effect:${id}`]) return;
  if (id !== 'search') s.flags[`effect:${id}`] = true;
  switch (id) {
    case 'arm': s.flags.armed = true; unlock(s, 'gate'); notify(s, 'Main quest started: Defend Shamepur'); break;
    case 'title': s.flags.title = true; notify(s, 'Title earned: CHAD MALE — DEFENDER OF SHAMEPUR'); break;
    case 'scout': s.flags.scout = true; unlock(s, 'forest', 'camp'); s.location = 'village'; notify(s, 'Main quest started: The Goblin Menace'); break;
    case 'friendGone': s.flags.friendGone = true; break;
    case 'metBoss': s.flags.metBoss = true; break;
    case 'treasure': grantItem(s, 'bonking'); s.flags.treasure = true; notify(s, 'Rare weapon found: Sword of Bonking'); break;
    case 'rescue': s.flags.rescued = true; unlock(s, 'ruins'); reward(s, 60); notify(s, `${s.notice} · Prisoners rescued. Main quest: Bring Him Home`); break;
    case 'recover': s.player.hp = s.player.maxHp; s.location = 'village'; break;
    case 'complete': s.flags.complete = true; notify(s, 'Chapter I complete · Slay the Four Pillars unlocked for the future'); break;
    case 'acceptMetal': s.quests.metal = 'active'; notify(s, 'Side quest started: The Blacksmith’s Problem'); break;
    case 'acceptSupplies': s.quests.supplies = 'active'; notify(s, 'Side quest started: Missing Supplies'); break;
    case 'search':
      for (const key of ['metal', 'supplies']) if (s.quests[key] === 'active') { grantItem(s, key); s.quests[key] = 'return'; notify(s, 'Missing goods found. Return them in Shamepur.'); }
      break;
  }
}
export function enterScene(s, id) {
  if (id === 'explore' || id === 'complete') { s.view = id; s.scene = null; return; }
  const n = STORY[id]; if (!n) throw new Error(`Unknown story scene: ${id}`);
  const sameConversation = s.view === 'story' && s.dialogue?.group === n.conversation;
  s.dialogue = { conversation: sameConversation ? s.dialogue.conversation : (s.dialogue?.conversation ?? 0) + 1, group: n.conversation, cursor: 0 };
  s.view = 'story'; s.scene = id;
  revealMessage(s);
}
function revealMessage(s) {
  const index = s.dialogue.cursor++;
  s.history.push({ ...STORY[s.scene].messages[index], scene: s.scene, messageIndex: index, conversation: s.dialogue.conversation });
}
export const hasSeen = (s, scene) => s.history.some(m => m.scene === scene);
export const visibleLocations = s => Object.entries(LOCATIONS).filter(([id]) => s.unlocked.includes(id));
export function locationStatus(s, id) {
  if (s.location === id) return 'current';
  if (s.unlocked.includes(id)) return 'unlocked';
  if ((id === 'camp' && !s.flags.scout) || (id === 'ruins' && !s.flags.rescued)) return 'undiscovered';
  return 'locked';
}
export function lockReason(s, id) {
  return ({ village: '', gate: 'The chief must send you to defend the gate.', forest: 'Defend Shamepur and hear the scout’s report.', camp: 'The scout must mark the camp on your map.', ruins: 'Free the prisoners to learn the route to the ruins.' })[id];
}
export const canTravel = (s, id) => s.view === 'explore' && s.unlocked.includes(id) && LOCATIONS[s.location].links.includes(id);
export function journal(s) {
  const f = s.flags;
  const scoutKnown = f.scout || s.history.some(m => m.scene === 'scout' && m.speakerId === 'scout');
  return [
    { id: 'opening', kind: 'main', name: 'Your Story Begins', visible: true, status: f.armed ? 'completed' : 'active', description: 'Follow the opening story in Shamepur.', steps: [] },
    { id: 'defend', kind: 'main', name: 'Defend Shamepur', visible: !!f.armed, status: f.tutorial ? 'completed' : 'active', description: 'Protect your home at the Eastern Gate.', steps: [['Receive the chief’s sword', !!f.armed], ['Defeat the Bangu Goblin', !!f.tutorial]] },
    { id: 'camp', kind: 'main', name: 'The Goblin Menace', visible: !!scoutKnown, status: f.rescued ? 'completed' : f.scout ? 'active' : 'available', description: 'Secure the camp and bring the villagers home.', steps: [...WAVES.map((_, i) => [`Clear wave ${i + 1}`, s.waves > i]), ['Free the prisoners', !!f.rescued]] },
    { id: 'friend', kind: 'main', name: 'Bring Him Home', visible: !!f.rescued, status: f.complete ? 'completed' : 'active', description: f.complete ? 'You found him, but Kashit took him. Your promise continues beyond this chapter.' : hasSeen(s, 'awakening') ? 'Recover in Shamepur. Your friend is still out there.' : f.pointOfNoReturn ? 'Stay close to your friend.' : 'Follow the prisoner’s directions into the Ancient Ruins.', steps: [
      ['Reach the Ancient Ruins', s.location === 'ruins' || !!f.metBoss],
      ...(f.metBoss ? [['Reach level 5', s.player.level === 5], ['Defeat Charukola', !!f.boss]] : []),
      ...(f.boss ? [['Open the prison chamber', !!f.pointOfNoReturn]] : []),
      ...(hasSeen(s, 'pillars') ? [['Make your vow', !!f.complete]] : [])
    ] },
    ...['metal', 'supplies'].map(id => ({ id, kind: 'side', name: id === 'metal' ? 'The Blacksmith’s Problem' : 'Missing Supplies', visible: s.quests[id] !== 'available' || !!f[id === 'metal' ? 'metSmith' : 'metMerchant'], status: s.quests[id] === 'return' ? 'active' : s.quests[id], description: id === 'metal' ? 'Recover iron from the forest. Reward: 20 XP and a 10g discount on the first upgrade.' : 'Find the merchant’s bag in the forest. Reward: 25 gold and a potion.', steps: [['Accept the errand', s.quests[id] !== 'available'], ['Search the forest', ['return', 'completed'].includes(s.quests[id])], ['Return the goods', s.quests[id] === 'completed']] })),
    { id: 'pillars', kind: 'main', name: 'Slay the Four Pillars', visible: !!f.complete, status: 'available', description: 'A future journey. Chapter 2 is not yet playable.', steps: [] }
  ].filter(q => q.visible);
}
const act = (id, label, reason = '') => ({ id, label, reason });
export function actions(s) {
  if (s.view === 'story') {
    const n = STORY[s.scene];
    if (s.dialogue.cursor < n.messages.length) return [act('continue', 'Continue →')];
    return n.choices ? n.choices.filter(c => !c.condition || s.flags[c.condition]).map((c, i) => act(`choice:${i}`, c.label)) : [act('continue', s.scene === 'vow' ? 'Make your vow' : 'Continue →')];
  }
  if (s.view === 'combat') return [act('attack', `Attack · ${totalAttack(s)} damage`), act('defend', 'Defend · halve next hit'), act('potion', `Potion · ${s.inventory.potion ?? 0} left`, !s.inventory.potion ? 'No potions' : s.player.hp === s.player.maxHp ? 'HP already full' : ''), act('flee', 'Flee · guaranteed')];
  if (s.view === 'defeat') return [act('retry', 'Retry encounter · restore HP'), act('safe', 'Return to Shamepur')];
  if (s.view === 'complete') return [];
  if (s.view === 'smith') {
    const price = s.tier === 0 ? (s.quests.metal === 'completed' ? 30 : 40) : 80;
    return [act('upgrade', s.tier === 2 ? 'Standard sword fully upgraded' : `Buy ${s.tier === 0 ? 'Sharpened' : 'Reinforced'} Sword · ${price}g`, s.tier === 2 ? 'Maximum tier' : s.player.gold < price ? 'Not enough gold' : ''), ...(s.quests.metal === 'available' ? [act('metalQuest', 'Ask about the missing iron')] : s.quests.metal === 'return' ? [act('returnMetal', 'Return the stolen metal')] : []), act('back', 'Back to village')];
  }
  if (s.view === 'merchant') return [act('buyPotion', 'Buy healing potion · 20g', s.player.gold < 20 ? 'Not enough gold' : ''), ...(s.quests.supplies === 'available' ? [act('suppliesQuest', 'Ask about the missing bag')] : s.quests.supplies === 'return' ? [act('returnSupplies', 'Return the supply bag')] : []), act('back', 'Back to village')];
  if (s.view === 'inn') return [act('rest', 'Rest · 10g · recover 40% max HP', s.player.hp === s.player.maxHp ? 'HP already full' : s.player.gold < 10 ? 'Not enough gold' : ''), act('back', 'Back to village')];
  if (s.view === 'chief') return [act('chiefTalk', 'Talk to the chief'), act('emergency', 'Use emergency cot · free', s.player.gold >= 10 ? 'You can afford the inn' : s.player.hp >= Math.ceil(s.player.maxHp * .4) ? 'Reserved for injured, stranded heroes' : ''), act('back', 'Back to village')];
  switch (s.location) {
    case 'village': return [act('chief', 'Village Chief'), ...(!s.flags.friendGone ? [act('friend', 'Childhood Friend', !s.flags.scout ? 'Defend the gate first' : '')] : []), act('smith', 'Blacksmith'), act('merchant', 'Merchant'), act('inn', 'Rest at the Inn'), act('villageExplore', 'Explore the village')];
    case 'gate': return s.flags.tutorial ? [act('gateLook', 'Survey the repaired gate')] : [act('tutorial', 'Defend Shamepur · tutorial battle')];
    case 'forest': return [act('search', 'Explore the stream & cart tracks'), act('hunt', 'Seek a goblin patrol · optional combat')];
    case 'camp': return [...(!s.flags.friendGone ? [act('campIntro', 'Scout the camp')] : s.waves < 3 ? [act('wave', `Fight wave ${s.waves + 1} · ${WAVES[s.waves].map(k => ENEMIES[k].name).join(' + ')}`)] : [...(!s.flags.treasure ? [act('treasure', 'Investigate the hidden cave')] : []), ...(!s.flags.rescued ? [act('rescue', 'Unlock the prisoner cages')] : [])])];
    case 'ruins': return !s.flags.metBoss ? [act('gallery', 'Enter the painted gallery')] : !s.flags.boss ? [act('boss', 'Challenge Charukola · level 5', s.player.level < 5 ? 'Reach level 5. Return to town and prepare.' : '')] : [act('reunion', 'Open the prison chamber · point of no return')];
    default: return [];
  }
}
function startCombat(s, kind, retry = false) {
  const kinds = kind === 'tutorial' ? ['goblin'] : kind === 'wave' ? WAVES[s.waves] : kind === 'boss' ? ['charukola'] : [kind];
  if (!kinds || kinds.some(k => !ENEMIES[k])) return;
  s.view = 'combat';
  s.combat = { kind, kinds: [...kinds], index: 0, hp: ENEMIES[kinds[0]].hp };
  s.log = [kind === 'tutorial' ? 'Tutorial: Attack deals your ATK. Enemies counter only if they survive. Defend halves one hit; potions use a turn. Fleeing leaves the objective unfinished.' : 'One enemy at a time. A killing blow prevents its counterattack.'];
  if (retry) s.player.hp = s.player.maxHp;
}
function combatAction(s, id, random) {
  const c = s.combat, enemy = ENEMIES[c.kinds[c.index]];
  const log = message => { s.log = [...s.log, message].slice(-6); };
  if (id === 'flee') { s.view = 'explore'; s.combat = null; notify(s, 'Escaped safely. Unfinished encounters reset; cleared waves remain secured.'); return; }
  if (id === 'attack') { c.hp = Math.max(0, c.hp - totalAttack(s)); log(`You deal ${totalAttack(s)} damage.`); }
  if (id === 'potion') { s.inventory.potion--; s.player = heal(s.player, 50); log('You drink a potion (+50 HP, capped at maximum).'); }
  if (!c.hp) {
    log(`${enemy.name} defeated.`);
    if (c.index < c.kinds.length - 1) { c.index++; c.hp = ENEMIES[c.kinds[c.index]].hp; log('The next guard steps forward.'); return; }
    const xp = c.kinds.reduce((n, k) => n + ENEMIES[k].xp, 0), gold = c.kinds.reduce((n, k) => n + ENEMIES[k].gold, 0);
    reward(s, xp, gold); s.combat = null;
    if (c.kind === 'tutorial') { s.flags.tutorial = true; enterScene(s, 'tutorialAfter'); }
    else if (c.kind === 'wave') { s.waves++; if (s.waves === 3) grantItem(s, 'key'); enterScene(s, `wave${s.waves}`); }
    else if (c.kind === 'boss') { s.flags.boss = true; enterScene(s, 'bossAfter'); }
    else s.view = 'explore';
    return;
  }
  let damage = rollDamage(enemy.damage, random); if (id === 'defend') damage = Math.ceil(damage / 2);
  s.player.hp = Math.max(0, s.player.hp - damage); log(`${enemy.name} hits for ${damage}${id === 'defend' ? ' (guarded)' : ''}.`);
  if (s.player.hp === 0) { s.view = 'defeat'; notify(s, 'You fell. Your campaign and cleared waves are safe. This encounter has awarded no rewards.'); }
}
export function dispatch(state, id, random = Math.random) {
  const s = structuredClone(state); s.notice = '';
  if (id.startsWith('travel:')) {
    const to = id.slice(7); if (!canTravel(s, to)) return state;
    s.location = to; notify(s, `Arrived at ${LOCATIONS[to].name}`); return s;
  }
  if (id.startsWith('equip:')) {
    const item = id.slice(6);
    if (s.view === 'explore' && s.inventory[item] && ITEMS[item]?.category === 'weapon') { s.equipped = item; notify(s, `Equipped ${ITEMS[item].name} · ATK ${totalAttack(s)}`); return s; }
    return state;
  }
  if (id === 'drink') {
    if (s.view !== 'explore' || !s.inventory.potion || s.player.hp === s.player.maxHp) return state;
    s.inventory.potion--; s.player = heal(s.player, 50); notify(s, 'Potion used. Up to 50 HP restored.'); return s;
  }
  const available = actions(s).find(a => a.id === id); if (!available || available.reason) return state;
  if (s.view === 'combat') { combatAction(s, id, random); return s; }
  if (id === 'continue' || id.startsWith('choice:')) {
    const n = STORY[s.scene];
    if (s.dialogue.cursor < n.messages.length) { revealMessage(s); return s; }
    const c = id === 'continue' ? n : n.choices.filter(c => !c.condition || s.flags[c.condition])[Number(id.split(':')[1])];
    if (id.startsWith('choice:')) s.history.push({ ...message(c.speakerId, c.label), scene: s.scene, conversation: s.dialogue.conversation, choice: true });
    if (c.flag) s.flags[c.flag] = c.value;
    effect(s, n.effect); if (c !== n) effect(s, c.effect);
    enterScene(s, c.next); return s;
  }
  switch (id) {
    case 'tutorial': startCombat(s, 'tutorial'); break;
    case 'hunt': startCombat(s, s.player.level >= 2 && random() < .4 ? 'hobgoblin' : 'goblin'); break;
    case 'wave': startCombat(s, 'wave'); break;
    case 'boss': startCombat(s, 'boss'); break;
    case 'retry': startCombat(s, s.combat.kind, true); break;
    case 'safe': s.view = 'explore'; s.location = 'village'; s.combat = null; s.player.hp = Math.max(1, Math.ceil(s.player.maxHp * .25)); notify(s, 'The villagers bring you home. The chief can help if you are stranded.'); break;
    case 'chief': case 'smith': case 'merchant': case 'inn':
      s.view = id;
      if (id === 'smith') s.flags.metSmith = true;
      if (id === 'merchant') s.flags.metMerchant = true;
      break;
    case 'back': s.view = 'explore'; break;
    case 'friend': enterScene(s, 'friendVisit'); break;
    case 'chiefTalk': enterScene(s, 'chiefVisit'); break;
    case 'villageExplore': enterScene(s, 'villageExplore'); break;
    case 'gateLook': notify(s, 'The gate stands. Children have painted a pumpkin on the repaired plank. The story battle will not repeat.'); break;
    case 'search': enterScene(s, 'forestExplore'); break;
    case 'campIntro': enterScene(s, 'campArrival'); break;
    case 'treasure': enterScene(s, 'treasure'); break;
    case 'rescue': enterScene(s, 'prisoners'); break;
    case 'gallery': enterScene(s, 'gallery'); break;
    case 'reunion': s.flags.pointOfNoReturn = true; enterScene(s, 'reunion'); break;
    case 'metalQuest': enterScene(s, 'smithQuest'); break;
    case 'suppliesQuest': enterScene(s, 'merchantQuest'); break;
    case 'returnMetal': s.quests.metal = 'completed'; delete s.inventory.metal; reward(s, 20); notify(s, `${s.notice} · Blacksmith quest complete. First upgrade discounted to 30g.`); break;
    case 'returnSupplies': s.quests.supplies = 'completed'; delete s.inventory.supplies; s.player.gold += 25; grantItem(s, 'potion'); notify(s, 'Missing Supplies complete · +25 gold · +1 potion'); break;
    case 'buyPotion': s.player.gold -= 20; grantItem(s, 'potion'); notify(s, 'Bought a healing potion.'); break;
    case 'upgrade': {
      s.player.gold -= s.tier === 0 ? (s.quests.metal === 'completed' ? 30 : 40) : 80;
      s.tier++; const item = s.tier === 1 ? 'sharpened' : 'reinforced'; grantItem(s, item);
      // Preserve a better rare weapon; equipment bonuses are always derived, never added to base ATK.
      if (ITEMS[item].bonus > ITEMS[s.equipped].bonus) s.equipped = item;
      notify(s, `${ITEMS[item].name} purchased. Weapon bonuses never stack.`); break;
    }
    case 'rest': s.player.gold -= 10; s.player = heal(s.player, Math.ceil(s.player.maxHp * .4)); notify(s, 'A warm bed, a terrible pillow. 40% max HP restored.'); break;
    case 'emergency': s.player.hp = Math.ceil(s.player.maxHp * .4); notify(s, 'A long afternoon on the cabbage cot. Recovered to 40% HP.'); break;
  }
  return s;
}
