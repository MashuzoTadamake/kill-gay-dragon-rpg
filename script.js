"use strict";

const CONFIG = {
  start: { level: 1, xp: 0, hp: 100, maxHp: 100, attack: 10, gold: 50, potions: 0, sword: 0 },
  maxLevel: 5,
  xpThresholds: [30, 50, 70, 90],
  levelHp: 20,
  levelAttack: 3,
  rest: { cost: 10, fraction: 0.4 },
  potion: { cost: 20, heal: 50 },
  sword: { costs: [40, 80], attack: 8 },
  hobgoblin: { minLevel: 2, chance: 0.4 },
  monsters: {
    goblin: { name: "Goblin", hp: 35, damage: [4, 8], xp: 20, gold: 12 },
    hobgoblin: { name: "Hobgoblin", hp: 65, damage: [7, 12], xp: 35, gold: 22 },
    dragon: { name: "Dragon", hp: 320, damage: [16, 26], xp: 0, gold: 0 }
  },
  logLimit: 6
};

const ui = Object.fromEntries(
  ["levelText", "xpText", "healthText", "goldText", "controls", "monsterStats", "monsterName", "monsterHealth", "text"]
    .map(id => [id, document.getElementById(id)])
);
const intro = ui.text.textContent.trim();
const DEBUG = new URLSearchParams(window.location.search).has("debug");
let state;

function xpNeeded(level) {
  return CONFIG.xpThresholds[level - 1] ?? 0;
}

function rollDamage([min, max], random = Math.random) {
  return min + Math.floor(random() * (max - min + 1));
}

function heal(player, amount) {
  return { ...player, hp: Math.min(player.maxHp, Math.max(0, player.hp + amount)) };
}

function levelUp(player) {
  const maxHp = player.maxHp + CONFIG.levelHp;
  return { ...player, level: player.level + 1, maxHp, hp: maxHp, attack: player.attack + CONFIG.levelAttack };
}

function applyXp(player, amount) {
  let next = { ...player, xp: player.xp + amount };
  while (next.level < CONFIG.maxLevel && next.xp >= xpNeeded(next.level)) {
    next.xp -= xpNeeded(next.level);
    next = levelUp(next);
  }
  if (next.level === CONFIG.maxLevel) next.xp = 0;
  return next;
}

function log(message) {
  state.log = [...state.log, message].slice(-CONFIG.logLimit);
}

function reset() {
  state = { scene: "town", player: { ...CONFIG.start }, enemy: null, log: [intro] };
}

function goTown() {
  state.scene = "town";
  state.enemy = null;
}

function goShop() {
  state.scene = "shop";
}

function enterCombat(kind) {
  state.scene = "combat";
  state.enemy = { ...CONFIG.monsters[kind], kind, maxHp: CONFIG.monsters[kind].hp };
  log(`A ${state.enemy.name} appears!`);
}

function enterCave() {
  const stronger = state.player.level >= CONFIG.hobgoblin.minLevel && Math.random() < CONFIG.hobgoblin.chance;
  enterCombat(stronger ? "hobgoblin" : "goblin");
}

function fightDragon() {
  if (state.player.level >= CONFIG.maxLevel) enterCombat("dragon");
}

function rest() {
  const player = state.player;
  if (player.gold < CONFIG.rest.cost || player.hp === player.maxHp) return;
  state.player = heal({ ...player, gold: player.gold - CONFIG.rest.cost }, Math.ceil(player.maxHp * CONFIG.rest.fraction));
  log(`You rest for ${CONFIG.rest.cost} gold and recover ${state.player.hp - player.hp} HP.`);
}

function buyPotion() {
  if (state.player.gold < CONFIG.potion.cost) return;
  state.player.gold -= CONFIG.potion.cost;
  state.player.potions += 1;
  log(`Bought a potion for ${CONFIG.potion.cost} gold.`);
}

function sharpenSword() {
  const cost = CONFIG.sword.costs[state.player.sword];
  if (cost === undefined || state.player.gold < cost) return;
  state.player.gold -= cost;
  state.player.sword += 1;
  state.player.attack += CONFIG.sword.attack;
  log(`Sword sharpened to tier ${state.player.sword}. Attack is now ${state.player.attack}.`);
}

function counterAttack() {
  const damage = rollDamage(state.enemy.damage);
  state.player.hp = Math.max(0, state.player.hp - damage);
  log(`${state.enemy.name} hits you for ${damage} damage.`);
  if (state.player.hp === 0) {
    state.scene = "gameover";
    state.enemy = null;
    log("You have fallen. Start over to try again.");
  }
}

function attack() {
  const enemy = state.enemy;
  enemy.hp = Math.max(0, enemy.hp - state.player.attack);
  log(`You hit ${enemy.name} for ${state.player.attack} damage.`);
  if (enemy.hp > 0) return counterAttack();
  if (enemy.kind === "dragon") {
    state.scene = "victory";
    state.enemy = null;
    log("The dragon falls! You win. Play again for a fresh adventure.");
    return;
  }
  const previousLevel = state.player.level;
  state.player = applyXp({ ...state.player, gold: state.player.gold + enemy.gold }, enemy.xp);
  log(`Defeated ${enemy.name}! +${enemy.xp} XP, +${enemy.gold} gold.`);
  if (state.player.level > previousLevel) log(`Level ${state.player.level}! Your HP is fully restored and your attack increases.`);
  goTown();
}

function usePotion() {
  const player = state.player;
  if (player.potions === 0 || player.hp === player.maxHp) return;
  state.player = heal({ ...player, potions: player.potions - 1 }, CONFIG.potion.heal);
  log(`You drink a potion and recover ${state.player.hp - player.hp} HP.`);
  counterAttack();
}

function flee() {
  log(`You escape ${state.enemy.name} and return to town.`);
  goTown();
}

function render() {
  const player = state.player;
  if (DEBUG) console.assert(player.gold >= 0 && player.hp >= 0 && player.hp <= player.maxHp, "Gold and HP bounds");
  const focusedAction = ui.controls.contains(document.activeElement) ? document.activeElement.dataset.action : null;
  ui.levelText.textContent = player.level;
  ui.xpText.textContent = player.level === CONFIG.maxLevel ? "MAX" : `${player.xp}/${xpNeeded(player.level)}`;
  ui.healthText.textContent = `${player.hp}/${player.maxHp}`;
  ui.goldText.textContent = player.gold;
  ui.monsterStats.hidden = state.scene !== "combat";
  ui.monsterName.textContent = state.enemy?.name ?? "";
  ui.monsterHealth.textContent = state.enemy ? `${state.enemy.hp}/${state.enemy.maxHp}` : "";
  let buttons;
  let context;
  switch (state.scene) {
    case "town":
      context = `Town · ATK ${player.attack} · Sword tier ${player.sword} · Potions ${player.potions}\nExplore the cave, prepare your gear, then challenge the dragon.`;
      buttons = [
        ["shop", "Shop"], ["cave", "Cave"],
        ["rest", `Rest (${CONFIG.rest.cost}g)`, player.hp === player.maxHp ? "HP is already full" : player.gold < CONFIG.rest.cost ? "Not enough gold" : ""],
        ["dragon", player.level < CONFIG.maxLevel ? `Fight Dragon (requires Lv ${CONFIG.maxLevel})` : "Fight Dragon", player.level < CONFIG.maxLevel ? `Reach level ${CONFIG.maxLevel} first` : ""]
      ];
      break;
    case "shop": {
      const cost = CONFIG.sword.costs[player.sword];
      context = `Shop · ATK ${player.attack} · Sword tier ${player.sword} · Potions ${player.potions}\nPotions heal ${CONFIG.potion.heal} HP in combat and use a turn. Each sword tier adds ${CONFIG.sword.attack} ATK.`;
      buttons = [
        ["buyPotion", `Buy Potion (${CONFIG.potion.cost}g)`, player.gold < CONFIG.potion.cost ? "Not enough gold" : ""],
        ["sharpen", cost === undefined ? "Sword maxed (Tier 2)" : `Sharpen Sword (${cost}g)`, cost === undefined ? "Sword is at maximum tier" : player.gold < cost ? "Not enough gold" : ""],
        ["town", "Back"]
      ];
      break;
    }
    case "combat":
      context = `Combat · ATK ${player.attack}\nAttacks and potions use a turn. Flee safely to town.`;
      buttons = [
        ["attack", "Attack"],
        ["potion", `Potion (${player.potions})`, !player.potions ? "No potions left" : player.hp === player.maxHp ? "HP is already full" : ""],
        ["flee", "Flee"]
      ];
      break;
    case "gameover":
      context = "Game over";
      buttons = [["reset", "Start over"]];
      break;
    case "victory":
      context = "Victory!";
      buttons = [["reset", "Play again"]];
      break;
  }
  ui.controls.replaceChildren(...buttons.map(([action, label, reason], index) => {
    const button = document.createElement("button");
    button.id = `button${index + 1}`;
    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;
    button.disabled = Boolean(reason);
    if (reason) button.title = reason;
    return button;
  }));
  ui.text.textContent = `${context}\n\n${state.log.join("\n")}`;
  if (focusedAction) {
    const available = [...ui.controls.children].filter(button => !button.disabled);
    (available.find(button => button.dataset.action === focusedAction) ?? available[0])?.focus();
  }
}

const actions = { shop: goShop, cave: enterCave, town: goTown, rest, dragon: fightDragon, buyPotion, sharpen: sharpenSword, attack, potion: usePotion, flee, reset };
ui.controls.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || !ui.controls.contains(button) || button.disabled) return;
  actions[button.dataset.action]();
  render();
});

reset();
render();

if (DEBUG) {
  console.assert(CONFIG.xpThresholds.reduce((sum, xp) => sum + xp, 0) === 240, "Total XP to level 5");
  CONFIG.xpThresholds.forEach((xp, index) => console.assert(xpNeeded(index + 1) === xp, "XP threshold"));
  console.assert(applyXp(CONFIG.start, 29).level === 1 && applyXp(CONFIG.start, 30).level === 2, "Level boundary");
  console.assert(applyXp(CONFIG.start, 45).xp === 15, "XP carries over");
  console.assert(applyXp(CONFIG.start, 1000).level === 5, "Level cap");
  console.assert(heal(CONFIG.start, 50).hp === 100 && heal(CONFIG.start, -200).hp === 0, "HP clamping");
  console.assert(state.player.gold >= 0, "No negative gold");
}
