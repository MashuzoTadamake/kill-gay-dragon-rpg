import { VERSION, ITEMS, LOCATIONS, ENEMIES, WAVES } from './data.js';
import { STORY } from './story.js';
import { createGame, xpNeeded } from './engine.js';
import { restoreLegacyDialogue, validMessage, refreshStoryMessages } from './dialogue.js';
export const SAVE_KEY = 'kgd.chapter1.save';
export const SETTINGS_KEY = 'kgd.settings';
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
export function validateSave(s) {
  if (!s || s.version !== VERSION) throw new Error('This save is incompatible with Chapter I.');
  const p = s.player;
  if (!p || !integer(p.level, 1, 5) || p.maxHp !== 100 + (p.level - 1) * 20 || p.attack !== 10 + (p.level - 1) * 3 || !integer(p.hp, 0, p.maxHp) || !integer(p.gold, 0, 1e9) || !integer(p.xp, 0, p.level === 5 ? 0 : xpNeeded(p.level) - 1)) throw new Error('Invalid player statistics.');
  if (!s.inventory || Object.entries(s.inventory).some(([id, n]) => !ITEMS[id] || !integer(n, 0, ITEMS[id].category === 'consumable' ? 1e6 : 1)) || !s.inventory[s.equipped] || ITEMS[s.equipped]?.category !== 'weapon') throw new Error('Invalid inventory.');
  if (!LOCATIONS[s.location] || !Array.isArray(s.unlocked) || s.unlocked.some(id => !LOCATIONS[id]) || !s.unlocked.includes(s.location) || !s.unlocked.includes('village')) throw new Error('Invalid location.');
  if (!integer(s.waves, 0, 3) || !integer(s.tier, 0, 2) || !s.flags || typeof s.flags !== 'object' || Array.isArray(s.flags) || Object.values(s.flags).some(v => !['boolean', 'string', 'number'].includes(typeof v))) throw new Error('Invalid progress.');
  if (!s.quests || !['metal', 'supplies'].every(k => ['available', 'active', 'return', 'completed'].includes(s.quests[k]))) throw new Error('Invalid quests.');
  if (!['story', 'explore', 'combat', 'defeat', 'complete', 'smith', 'merchant', 'inn', 'chief'].includes(s.view) || (s.view === 'story' && !STORY[s.scene])) throw new Error('Invalid scene.');
  if (s.view === 'complete' && !s.flags.complete || s.flags.rescued && s.waves !== 3 || s.flags.boss && !s.flags.rescued) throw new Error('Inconsistent story progress.');
  const f = s.flags;
  for (const key of ['armed', 'tutorial', 'title', 'scout', 'friendGone', 'treasure', 'rescued', 'metBoss', 'boss', 'pointOfNoReturn', 'complete']) {
    if (Object.hasOwn(f, key) && typeof f[key] !== 'boolean') throw new Error('Invalid story flag.');
  }
  if (f.tutorial && !f.armed || f.scout && (!f.tutorial || !f.title) || s.waves > 0 && (!f.scout || !f.friendGone) || f.pointOfNoReturn && !f.boss || f.complete && !f.pointOfNoReturn || f.boss && p.level !== 5 || f.treasure && (s.waves !== 3 || !s.inventory.bonking)) throw new Error('Inconsistent story flags.');
  for (const [id, flag] of [['gate', 'armed'], ['forest', 'scout'], ['camp', 'scout'], ['ruins', 'rescued']]) {
    if (s.unlocked.includes(id) !== !!f[flag]) throw new Error('Inconsistent map progress.');
  }
  if (s.inventory.rusty !== 1 || !integer(s.inventory.potion, 0, 1e6) || s.tier >= 1 && !s.inventory.sharpened || s.tier === 2 && !s.inventory.reinforced) throw new Error('Incomplete inventory.');
  if (f.pointOfNoReturn && !['story', 'complete'].includes(s.view)) throw new Error('Invalid final sequence checkpoint.');
  if (['combat', 'defeat'].includes(s.view)) {
    const c = s.combat;
    if (!c || !['tutorial', 'wave', 'boss', 'goblin', 'hobgoblin'].includes(c.kind) || !Array.isArray(c.kinds) || !c.kinds.length || c.kinds.length > 2 || c.kinds.some(k => !ENEMIES[k]) || !integer(c.index, 0, c.kinds.length - 1) || !integer(c.hp, 1, ENEMIES[c.kinds[c.index]].hp)) throw new Error('Invalid encounter.');
    const expected = c.kind === 'wave' ? WAVES[s.waves] : c.kind === 'tutorial' ? ['goblin'] : c.kind === 'boss' ? ['charukola'] : [c.kind];
    if (JSON.stringify(c.kinds) !== JSON.stringify(expected) || (s.view === 'defeat') !== (p.hp === 0)) throw new Error('Inconsistent encounter checkpoint.');
    if (c.kind === 'tutorial' && (s.location !== 'gate' || f.tutorial) || c.kind === 'wave' && s.location !== 'camp' || c.kind === 'boss' && (s.location !== 'ruins' || p.level !== 5 || f.boss) || ['goblin', 'hobgoblin'].includes(c.kind) && s.location !== 'forest') throw new Error('Encounter in an invalid location.');
  } else if (s.combat !== null) {
    throw new Error('Unexpected active encounter.');
  }
  if (!Array.isArray(s.history) || s.history.length > 20000 || s.history.some(n => !n || typeof n.speaker !== 'string' || typeof n.text !== 'string') || !Array.isArray(s.log) || s.log.length > 6 || s.log.some(n => typeof n !== 'string') || typeof s.notice !== 'string') throw new Error('Invalid history.');
  // Build a fresh, plain state. Never merge arbitrary save fields into live objects.
  const clean = createGame();
  for (const k of Object.keys(clean)) if (Object.hasOwn(s, k)) clean[k] = structuredClone(s[k]);
  if (!Object.hasOwn(s, 'dialogue')) restoreLegacyDialogue(clean);
  const d = clean.dialogue;
  if (!d || !integer(d.conversation, 1, 1e9) || !integer(d.cursor, 0, 1000) || clean.history.some(m => !validMessage(m))) throw new Error('Invalid conversation history.');
  if (clean.view === 'story' && (d.group !== STORY[clean.scene].conversation || !integer(d.cursor, 1, STORY[clean.scene].messages.length))) throw new Error('Invalid dialogue checkpoint.');
  refreshStoryMessages(clean);
  return clean;
}
export const serialize = state => JSON.stringify(validateSave(state));
export const deserialize = text => validateSave(JSON.parse(text));
export function saveGame(state, storage = localStorage) { storage.setItem(SAVE_KEY, serialize(state)); }
export function loadGame(storage = localStorage) { const raw = storage.getItem(SAVE_KEY); return raw ? deserialize(raw) : null; }
export function hasSave(storage = localStorage) { try { return !!storage.getItem(SAVE_KEY); } catch { return false; } }
export function readSettings(storage = localStorage) {
  const defaults = { theme: 'classic', volume: .25, muted: false, music: false, reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false };
  try {
    const v = JSON.parse(storage.getItem(SETTINGS_KEY));
    if (!v) return defaults;
    return { theme: v.theme === 'dark' ? 'dark' : 'classic', volume: typeof v.volume === 'number' && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : .25, muted: v.muted === true, music: v.music === true, reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : defaults.reducedMotion };
  } catch { return defaults; }
}
