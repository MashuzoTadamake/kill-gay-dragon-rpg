# Kill The Gay Dragon RPG

**Chapter I — The Rise of the Chad** is a complete, choice-driven fantasy comedy about Shamepur, a tsundere childhood friend (male?), and an ancient dragon with a deeply unreasonable imperial plan. A vanilla HTML/CSS/JavaScript text RPG.

## Run locally

From this repository, with Python 3 installed:

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000**. No installation, backend, API key, or build step is needed. Use an HTTP server rather than opening `index.html` directly: the game uses JavaScript modules. `npm start` runs the same server if Node/npm is installed.


## Chapter I

52 scenes in the whole chapter with various interactions. Focused on story more than gameplay for now. 


## Saving

Versioned `localStorage` saves automatically after game actions, including dialogue choices, combat turns, completed waves, travel, purchases, equipment changes, and quest events. **Save** and **Load** are also available. Continue restores the exact dialogue message or combat turn, including defeat and completion screens. Existing Chapter I V1 saves are migrated in memory to the message format, preserving stats, equipment, quest flags, wave progress, and previously read dialogue. They are saved in the extended format on the next game action. Authored message edits refresh already-read history on load without changing the saved cursor or revealing new messages. Settings are stored separately and survive a new game.

New Game asks before replacing existing progress. Saves are validated; invalid or incompatible data shows an error and remains untouched until you explicitly start over. Storage failures show a notification. Saves belong to the current browser profile and site origin: changing the port, clearing site data, or using another browser will not carry them over. There is no cloud sync or save-file import/export.

## Credits

- Original game idea: **sanbi / sanbisensei** — [original repository](https://github.com/sanbisensei/kill-gay-dragon-rpg).
- Fork and development: **MashuzoTadamake** — [this repository](https://github.com/MashuzoTadamake/kill-gay-dragon-rpg).
