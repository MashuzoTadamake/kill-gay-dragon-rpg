# Kill The Gay Dragon RPG

**Chapter I — The Rise of the Chad** is a complete, choice-driven fantasy comedy about Shamepur, a tsundere childhood friend, and an ancient dragon with a deeply unreasonable imperial plan. A vanilla HTML/CSS/JavaScript text RPG, expanded from the original Dragon Slayer RPG. The original autumn forest, cream-and-orange palette, gradient buttons, Caffeine Code branding, and media are preserved.

## Run locally

From this repository, with Python 3 installed:

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000**. No installation, backend, API key, or build step is needed. Use an HTTP server rather than opening `index.html` directly: the game uses JavaScript modules. `npm start` runs the same server if Node/npm is installed.

## Playing

- Choose **Begin your story**, or **Continue adventure** to restore a save.
- Click/tap dialogue responses and **Continue**. Messages appear one at a time and accumulate in the current conversation: Hero on the right, NPCs on the left, narration centered, and announcements in centered parchment strips. Selected responses are added to the conversation. Keyboard users can use Tab, Enter/Space, and Escape to close panels.
- **Map** shows only discovered places, their connected roads, and your location. Travel is safe; patrol battles are optional. Finish dialogue or leave a shop before traveling.
- **Inventory** equips one weapon or drinks a potion between encounters. Combat has its own potion action.
- **Quests** reveals objectives only as you discover them, separates completed quests, and introduces village errands after you meet their NPCs. **History** keeps earlier conversations and selected responses. The conversation panel follows new messages when you are near the bottom; while reviewing earlier messages it keeps your place and offers a “return to the latest” button.
- Visit the village to upgrade weapons, buy potions, or rest. The chief offers emergency recovery if you cannot afford the inn.
- Finish any exploration before opening the prison chamber after Charukola. This begins the final sequence. The chapter ends at the completion screen; Chapter 2 is not playable.
- The game shell fits the viewport. During story scenes, only the conversation scrolls; choices stay visible. Map, inventory, quests, and history scroll inside their own panels. Short screens use tighter spacing while retaining the same interface.
- **Settings** controls classic/dark parchment, music volume, mute, and reduced motion. Music starts after interaction, at 25% volume by default. Reduced motion replaces the animated forest with a static autumn gradient.

## Chapter I

52 scenes with explicitly authored speaker metadata cover the prologue, breakfast, Shamepur’s invasion, tutorial battle, village celebration, the scout’s report, three camp waves, hidden cave, prisoner rescue, Charukola’s gallery, reunion, Kashit’s cinematic confrontation, kidnapping, and the hero’s vow. Five connected locations support backtracking before the final sequence. Optional village errands reward exploration; the Sword of Bonking is a unique equippable treasure.

## Mechanics

| Rule | Value |
| --- | --- |
| Starting player | Level 1, 100 HP, 10 base ATK, 50 gold, no potions |
| XP per level | 30 / 50 / 70 / 90; level cap 5 |
| Level up | +20 max HP, +3 base ATK, full heal; surplus XP carries over |
| Bangu Goblin | 35 HP, 4–8 damage, 20 XP, 12 gold |
| Hobgoblin | 65 HP, 7–12 damage, 35 XP, 22 gold |
| Forest patrol | Goblin; at level 2+, 40% chance of a Hobgoblin |
| Charukola | Requires level 5; 200 HP, 14–20 damage, 60 gold |
| Rest | 10 gold; restores 40% max HP rounded up; no charge at full HP |
| Emergency cot | Free below 10 gold and 40% HP; recovers **to** 40% HP |
| Potion | 20 gold; restores 50 HP, capped at max; uses a turn in combat |
| Standard sword upgrades | 40 / 80 gold; +8 / +16 ATK; first upgrade 30g after blacksmith quest |
| Sword of Bonking | Unique rare weapon; +20 ATK; hidden in the camp cave |
| Attack | Fixed base ATK + equipped weapon bonus; killing blows prevent counters |
| Defend | Uses a turn; halves the next enemy hit, damage rounded up |
| Flee | Guaranteed, no counterattack; unfinished encounter resets |
| Defeat | Retry encounter at full HP, or return to Shamepur at 25% HP; campaign retained |

**Intentional changes from the original:** Shamepur replaces the small town/cave menu with a chapter and connected map. Defend, equipment selection, quest rewards, and checkpoints expand the combat foundation. Camp rewards are paid when the entire wave clears, so retrying/fleeing cannot farm partial-wave rewards; cleared waves never reset. The main path gives 245 XP before Charukola (20 + 40 + 55 + 70 + 60), reaching level 5 without grinding. The original repeatable 320-HP dragon fight is replaced by an unwinnable **cinematic** Kashit encounter; it consumes no potions and cannot produce an early dragon victory. Weapon bonuses are derived from a single equipped item, rather than permanently added to base attack.

## Saving

Versioned `localStorage` saves automatically after game actions, including dialogue choices, combat turns, completed waves, travel, purchases, equipment changes, and quest events. **Save** and **Load** are also available. Continue restores the exact dialogue message or combat turn, including defeat and completion screens. Existing Chapter I V1 saves are migrated in memory to the message format, preserving stats, equipment, quest flags, wave progress, and previously read dialogue. They are saved in the extended format on the next game action. Authored message edits refresh already-read history on load without changing the saved cursor or revealing new messages. Settings are stored separately and survive a new game.

New Game asks before replacing existing progress. Saves are validated; invalid or incompatible data shows an error and remains untouched until you explicitly start over. Storage failures show a notification. Saves belong to the current browser profile and site origin: changing the port, clearing site data, or using another browser will not carry them over. There is no cloud sync or save-file import/export.

## Code and checks

```text
index.html               Accessible page shell and original assets
styles.css               Responsive cream/orange and dark parchment themes
script.js                Rendering, panels, input, audio, and browser persistence
js/data.js               Original balance, items, enemies, locations, waves
js/story.js              Authored messages, speaker roles, choices, stable scene IDs
js/dialogue.js           Message rendering, conversation history, legacy migration
assets/fonts/            Local medieval fonts and their OFL license notices
js/engine.js             Authoritative state, game rules, quests, and transitions
js/save.js               Versioned serialization, validation, and settings
tests/game.test.js        Pure game-logic tests (Node 22+)
tests/browser-check.mjs   Optional dependency-free Chromium UI smoke test
```

Run the logic checks with Node 22+:

```bash
npm test
```

The 33 tests cover initialization, XP/cap, damage and defend, healing, purchases, equipment, rewards, quest/map gates, retries, emergency recovery, wave checkpoints, rescue, boss gating, all four Kashit choices, corruption handling, and completion persistence. Additional checks cover spoiler visibility at story milestones, side-quest discovery, explicit speaker roles, accumulated replies, rendering/escaping, conversation boundaries, message cursors, and five old-save fixtures. Targeted story checks cover the secretary’s anonymity, the Childhood Friend label, and the hero’s subjective gender assumption. A full no-grind main path serializes and reloads after every action.

For browser checks, start the game server and a **separate test browser profile**, then run:

```bash
chromium --headless --remote-debugging-port=9222 --user-data-dir=/tmp/kgd-browser-test about:blank
node tests/browser-check.mjs
```

Use your Chromium-compatible executable (for example Brave) in place of `chromium`. This test resets game storage **in that test browser profile**, plays Chapter I through the UI, checks themes/audio/new-game confirmation and viewport/choice bounds, and writes desktop/mobile screenshots to `/tmp/kgd-screenshots`. Keep this remote-debugging session local and close it when finished. No browser automation dependencies are installed.

Verified during implementation: all 33 logic tests passed; the full UI smoke test passed in headless Brave, with no uncaught exceptions. Desktop, mobile, and short portrait/landscape screenshots were captured and inspected. The page remains within the viewport, dialogue scrolls internally, and choices remain on screen. A separate test URL may be passed as the first argument to `tests/browser-check.mjs`. Physical mobile devices and other browser engines have not been tested. Reading-time targets have not been measured with human playtesters.

## Credits and assets

- Original game: **sanbi / sanbisensei** — [original repository](https://github.com/sanbisensei/kill-gay-dragon-rpg).
- Fork and development: **MashuzoTadamake** — [this repository](https://github.com/MashuzoTadamake/kill-gay-dragon-rpg).
- Typography: **Cinzel / Cinzel Decorative** (Natanael Gama and the Cinzel Project Authors) and **Alegreya** (the Alegreya Project Authors), bundled locally under the SIL Open Font License 1.1. Sources and full license notices are in `assets/fonts/`. The game makes no runtime requests to a font service; system-serif fallbacks remain available.
- Existing **Caffeine Code** branding and assets are retained: `caffaine.png`, `bg.gif`, `bgm.mp3`, and `me.jpg`. Asset-specific creator/license information was not provided in the supplied repository. Ownership remains with the respective creators; no new license or ownership claim is introduced.

Future work may expand the Four Pillars, later chapters, optional portraits, and additional dialogue consequences. Chapter I stores general story flags for that expansion; no hidden route meter or secret ending is implemented.
