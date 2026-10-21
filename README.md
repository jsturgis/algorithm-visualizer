# Algorithms, step by step

Interactive step-through visualizations for learning algorithms. Plain HTML, CSS and JavaScript: no build step, no dependencies.

```
index.html                 Home page (search + tag filter), reads algorithms.js
algorithms.js              The list of algorithms shown on the home page
assets/css/base.css        Shared colours, layout, controls, code view, array boxes
assets/js/player.js        Shared step-through player (AlgoPlayer.create)
algorithms/<slug>/         One folder per algorithm page
algorithms/_template/      A working example page to copy
tests/                     Vitest tests (one file per page, plus shared player tests)
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Run the tests

```sh
npm install
npm test            # or: npm run test:watch
```

Each test loads the real page into jsdom, runs its scripts and works its controls. Remote URLs (Google Fonts) are stubbed out, so tests run offline.

- `tests/player.test.js` runs against every page in `algorithms.js` plus the template: it loads without errors, every step highlights a code line and has a note, and Step/Back/Restart, the keyboard shortcuts, Play/Pause and the input row all work.
- `tests/home.test.js` checks `algorithms.js` against the folders on disk and tests the cards, search and tag filters.
- `tests/<slug>.test.js` calls the page's `buildTrace` directly, checks its answers against a brute-force reference on the problem's examples and on random inputs, and checks what the page shows.

## Add an algorithm

1. Copy `algorithms/_template/` to `algorithms/<slug>/`.
2. Edit the header text and tags, then replace the four pieces the template marks:
   - `source`: the code lines to display.
   - `buildTrace(input)`: run the algorithm and push one snapshot per step: `{ line, note, vars, flash, ...anything your visual needs }`.
   - `setup(input)`: build the visual (DOM or SVG) for a new input.
   - `render(step)`: update the visual for one snapshot.
3. Add an entry to `algorithms.js`:
   ```js
   { slug: "my-algorithm", title: "My Algorithm", summary: "One sentence.", tags: ["Graphs"], complexity: "O(n log n)" }
   ```
   The shared player tests pick the new page up automatically.
4. Add `tests/<slug>.test.js` that checks `buildTrace`'s answers against a brute-force version, and checks what the page shows.

The player handles Play/Pause, Back/Step, Restart, speed, keyboard shortcuts (Space, ←, →, R), the highlighted code line, the variable cards and the custom-input row. `AlgoPlayer.svgEl`, `AlgoPlayer.parseIntList` and `AlgoPlayer.fmt` are there for building visuals and parsing input.

## Deploy to GitHub Pages

The site is served straight from the `main` branch root (`.nojekyll` makes sure `_template` is served too):

```sh
gh repo create algorithm-visualizer --public --source . --push
gh api -X POST repos/{owner}/algorithm-visualizer/pages -f "source[branch]=main" -f "source[path]=/"
```

Or in the repo's **Settings → Pages**, pick **Deploy from a branch**, `main`, `/ (root)`. The site appears at `https://<user>.github.io/algorithm-visualizer/` a minute or so later, and every push to `main` redeploys it.
