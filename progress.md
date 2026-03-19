Original prompt: Design a Material You (M3) interface with large rounded corners (28px), tonal color palettes, expressive typography, dynamic color theming, elevated surfaces, FAB button.

- Added a new app shell direction: hero banner, section headings, board hero, and a floating palette FAB in the markup.
- Shifted the visual system toward M3 tokens in CSS with 28px major shapes, elevated tonal surfaces, and more expressive typography.
- Added runtime theme seeding in `game.js`; the FAB now cycles through several dynamic color palettes and updates the shell labels.
- Added `window.render_game_to_text` and `window.advanceTime` so the browser test loop can inspect the current game state.
- Browser validation:
  - Used a local `python3 -m http.server 4173` plus the built-in Playwright browser tooling because the skill's standalone client could not import the `playwright` package in this repo.
  - Verified desktop and mobile layouts with screenshots.
  - Verified palette cycling through the FAB and confirmed mode switching updates the shell labels and tonal surfaces.
  - Final console check is clean.
