# Dragon Slayer RPG

A small, complete vanilla JavaScript RPG built on the original freeCodeCamp-style scaffold. The original background, panel, colors, and introduction are retained.

Open `index.html` in your browser to play. No install, server, build, or dependencies are required. Use Tab to move between buttons and Enter or Space to activate them.

Fight in the cave to earn XP and gold, buy sword upgrades and potions, and challenge the dragon at level 5. Defeating cave enemies returns you to town. Leveling fully heals you. Losing or winning offers a full restart. Progress lasts for the current page session only.

| Rule | Value |
| --- | --- |
| Starting player | Level 1, 100 HP, 10 ATK, 50 gold, no potions |
| XP per level | 30 / 50 / 70 / 90; level cap 5 |
| Level up | +20 max HP, +3 ATK, full heal; surplus XP carries over |
| Goblin | 35 HP, 4–8 damage, 20 XP, 12 gold |
| Hobgoblin | Level 2+, 40% of encounters; 65 HP, 7–12 damage, 35 XP, 22 gold |
| Rest | 10 gold; restores 40% of max HP, rounded up |
| Potion | 20 gold; restores 50 HP in combat, then the enemy counters |
| Sword | 40 / 80 gold; +8 ATK per tier, maximum tier 2 |
| Dragon | Requires level 5; 320 HP, 16–26 damage |
| Combat | Fixed player attack; random inclusive enemy damage; a killing blow prevents a counterattack |
| Flee | Always succeeds, no counterattack; the next encounter starts at full enemy HP |

At level 5, a tier-2 sword gives 38 ATK and you have 180 max HP. Prepare your gear and healing before challenging the dragon. Full-health healing, unaffordable purchases, and unavailable upgrades are disabled. The orange panel keeps the last six log entries.

## Contributing

Keep the game static, dependency-free, and visually consistent with the existing UI. All balance values live in `CONFIG` in `script.js`. Discuss larger changes with the repository owner before submitting a PR. Save/load, sound, extra enemies, and boss phases are outside this first version.

Open `index.html?debug` and check the browser console for built-in assertions covering XP thresholds, carryover, the level cap, and HP clamping.

Before submitting changes, check:

- Fresh-load stats; dragon locked below level 5 and available at level 5.
- Unaffordable purchases, maximum sword tier, and resting at full HP.
- Kill rewards granted once, XP carryover, and full healing on level up.
- Potions clamp to maximum HP, consume one item and turn, and cannot be used outside combat.
- Flee, victory, defeat, and full reset from both ending screens.
- A complete run, a 360px-wide screen, and keyboard-only navigation.

The repository currently has no license file; this README does not grant a license to the original code or assets.
