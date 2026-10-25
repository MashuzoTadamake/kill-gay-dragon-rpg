export const VERSION = 1;
export const CONFIG = {
  start: { level: 1, xp: 0, hp: 100, maxHp: 100, attack: 10, gold: 50 },
  maxLevel: 5, xpThresholds: [30, 50, 70, 90], levelHp: 20, levelAttack: 3,
  rest: { cost: 10, fraction: .4 }, potion: { cost: 20, heal: 50 }
};
export const ITEMS = {
  rusty: { name: 'Rusty Sword', category: 'weapon', rarity: 'Common', bonus: 0, description: 'A village heirloom. The rust is load-bearing.' },
  sharpened: { name: 'Sharpened Sword', category: 'weapon', rarity: 'Uncommon', bonus: 8, description: 'An actual edge. An astonishing innovation.' },
  reinforced: { name: 'Reinforced Sword', category: 'weapon', rarity: 'Uncommon', bonus: 16, description: 'For problems that survive the first sword.' },
  bonking: { name: 'Sword of Bonking', category: 'weapon', rarity: 'Rare', bonus: 20, description: 'BONK FIRST. ASK QUESTIONS LATER.' },
  potion: { name: 'Healing Potion', category: 'consumable', rarity: 'Common', description: 'Restores 50 HP. Uses a turn in combat.' },
  metal: { name: 'Stolen Metal', category: 'quest', rarity: 'Quest', description: 'The blacksmith’s missing iron. Return it in Shamepur.' },
  supplies: { name: 'Supply Bag', category: 'quest', rarity: 'Quest', description: 'The merchant’s stock, smelling faintly of goblin.' },
  key: { name: 'Prison Key', category: 'quest', rarity: 'Quest', description: 'Opens the camp cages. A reminder of people brought home.' }
};
export const ENEMIES = {
  goblin: { name: 'Bangu Goblin', hp: 35, damage: [4, 8], xp: 20, gold: 12, quip: '“YOU GOT A PERMIT FOR THAT JAWLINE?”' },
  hobgoblin: { name: 'Hobgoblin', hp: 65, damage: [7, 12], xp: 35, gold: 22, quip: '“Human resources said this was an office job.”' },
  charukola: { name: 'Charukola Hobgoblin', hp: 200, damage: [14, 20], xp: 0, gold: 60, quip: '“MY VIOLENCE IS A PERFORMANCE PIECE!”' }
};
export const WAVES = [['goblin', 'goblin'], ['goblin', 'hobgoblin'], ['hobgoblin', 'hobgoblin']];
export const LOCATIONS = {
  village: { name: 'Shamepur Village', icon: '⌂', subtitle: 'A small home. An unreasonable destiny.', links: ['gate', 'forest'], description: 'Orange leaves gather around the well. The market smells of warm bread, hot iron, and the chief’s latest terrible decision.' },
  gate: { name: 'Eastern Gate', icon: '⚑', subtitle: 'The first stand', links: ['village', 'forest'], description: 'Beyond the crooked palisade, the road slips into an autumn haze. Someone has painted “PLEASE INVADE ELSEWHERE” on the gate.' },
  forest: { name: 'Whispering Forest', icon: '♧', subtitle: 'Every leaf has heard something', links: ['village', 'gate', 'camp'], description: 'Copper leaves whisper overhead. Footprints wind between the roots. The road is safe enough to travel; patrols lurk away from it.' },
  camp: { name: 'Goblin Camp', icon: '⚔', subtitle: 'Bad tents. Worse company.', links: ['forest', 'ruins'], description: 'A crooked banner droops over stolen carts. Beyond the guard posts stand locked cages and a suspiciously well-hidden cave.' },
  ruins: { name: 'Ancient Ruins', icon: '♜', subtitle: 'The gallery below the world', links: ['camp'], description: 'Ancient stone swallows the daylight. Somewhere below, a terrible painter is explaining his genius to a captive audience.' }
};
