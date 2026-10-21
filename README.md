# Algorithms, step by step

Interactive step-through visualizations for learning algorithms. Plain HTML, CSS and JavaScript: no build step, no dependencies.

```
index.html                 Home page (search + tag filter), reads algorithms.js
algorithms.js              The list of algorithms shown on the home page
assets/css/base.css        Shared colours, layout, controls, code view, array boxes
assets/js/player.js        Shared step-through player (AlgoPlayer.create)
algorithms/<slug>/         One folder per algorithm page
algorithms/_template/      A working example page to copy
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

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

The player handles Play/Pause, Back/Step, Restart, speed, keyboard shortcuts (Space, ←, →, R), the highlighted code line, the variable cards and the custom-input row. `AlgoPlayer.svgEl`, `AlgoPlayer.parseIntList` and `AlgoPlayer.fmt` are there for building visuals and parsing input.

## Deploy to GitHub Pages

The site is served straight from the `main` branch root (`.nojekyll` makes sure `_template` is served too):

```sh
gh repo create algorithm-visualizer --public --source . --push
gh api -X POST repos/{owner}/algorithm-visualizer/pages -f "source[branch]=main" -f "source[path]=/"
```

Or in the repo's **Settings → Pages**, pick **Deploy from a branch**, `main`, `/ (root)`. The site appears at `https://<user>.github.io/algorithm-visualizer/` a minute or so later, and every push to `main` redeploys it.
