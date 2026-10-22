# Algorithms, step by step

Interactive step-through visualizations for learning algorithms: https://jsturgis.github.io/algorithm-visualizer/

Each algorithm is a **problem package** modelled on the [ICPC problem package format](https://icpc.io/problem-package-format/): a statement, constraints, sample and generated tests, an input validator, and several submissions, some of them deliberately wrong. Every package is verified the way a contest's problem checker would verify it. The accepted TypeScript solution is both the code shown on the page and the code under test. Vite builds the packages into a static site in `dist/`, and only `dist/` is deployed.

```
problems/<slug>/             one problem package per algorithm (the canonical source)
problems/_template/          a complete, working package to copy (verified, not published)
src/runtime/                 browser runtime: step player, page wiring, input constraints, edit mode
src/editor/                  code editor (CodeMirror) and TypeScript checker, loaded on first Edit
src/judge/                   judge for edited code: sandboxed runner and verdict panel, loaded on first Run tests
src/home/                    home page
src/styles/base.css          shared colours, layout and components
site/index.html              home page shell (algorithm pages are generated into site/algorithms/)
build/                       package loader, verifier, page renderer, Vite plugin
scripts/verify.ts            `npm run verify`
tests/                       Vitest: package checks, verifier self-tests, pages, build output
```

## A problem package

```
problems/k-radius-averages/
  problem.yaml                          title, tags, complexity, entry function, input constraints,
                                        return type, time limit, visualization settings
  problem_statement/statement.md
  data/sample/1.in, 1.ans               examples, as JSON: the input object / the expected answer
  data/invalid_input/*.in               inputs the validator must reject
  generators/generators.ts              random (a fast-check arbitrary), edge (named cases),
                                        large (maximum-size inputs for the time limit)
  input_validators/validate.ts          optional: constraints that aren't ranges (e.g. "sorted")
  submissions/accepted/solution.ts      the solution shown on the page; mark lines with // @line <label>
  submissions/time_limit_exceeded/*.ts  correct but slow (brute force): the oracle for random tests
  submissions/wrong_answer/*.ts         plausible bugs the tests must catch
  visualization/trace.ts                runs the algorithm and records each step; steps name @line labels
  visualization/view.ts, view.css       draws the picture for a step
```

Two differences from ICPC: test files are JSON rather than whitespace-separated text, and submissions are TypeScript modules that export the entry function rather than programs reading stdin.

## What `npm run verify` checks

For every package, including the template:

| Check | Catches |
|---|---|
| `problem.yaml` matches the schema | missing or misspelled fields |
| The validator accepts every sample, edge, random and large input | generators that break the stated constraints |
| The validator rejects every `data/invalid_input` file | a validator that's too lenient |
| Every accepted submission matches every sample `.ans` | a wrong solution or a wrong example |
| Accepted and brute-force submissions agree on samples + edge cases + 200 seeded random tests | bugs the examples miss |
| Property test: solution = brute force on 1,000 fast-check inputs (counterexamples are shrunk) | rarer bugs, reported as a minimal failing input |
| Accepted submissions run every `large` test within `limits.time_ms` | a solution with the wrong complexity |
| Each `wrong_answer` submission fails at least one test | tests too weak to catch known mistakes |
| The accepted solution, as displayed, type-checks against the contract (`entry`, input types, `returns`) | a `problem.yaml` that disagrees with its solution |
| The trace only uses real `@line` labels, every step has a note, and the last step's `result` equals the solution's answer on every test that fits the page | a visualization that drifts from the solution |

`time_limit_exceeded` submissions are only run on the small tests. The verifier doesn't confirm that they actually exceed the time limit.

`npm run verify` also writes the generated tests to `data/secret/` (gitignored) so you can review them like a checked-in package.

## Page layout

On desktop (1024 px and wider), an algorithm page is a workspace that fills the window:
- **Left pane:** **Problem** and **Code** tabs. Problem holds the approach, statement, examples and constraints. Code holds the code, the variable cards and edit mode. The first visit to an algorithm opens on Problem; after that, the page remembers the last tab per algorithm.
- **Right pane:** the animation, its step explanation and the input row.
- **Control bar:** Play, Step, Back, Restart and speed, along the bottom.

Each pane scrolls on its own, so the highlighted code line, the animation and the controls stay on screen together. On narrower screens the panes stack, and the control bar sticks to the bottom of the screen.

## Editing code on a page

The code panel's **Edit** button opens the accepted solution in an editor (CodeMirror 6) with TypeScript diagnostics, autocomplete and hover types. The code is checked against the problem's contract: the entry function must keep its name, accept the `input` types from `problem.yaml` (`int` → `number`, `int[]` → `number[]`) and return its `returns` type. Edits are saved per algorithm in the browser. The animation always follows the reference solution, so line highlighting is turned off while the edited code differs from it.

**Run tests** judges the edited code against the same tests `npm run verify` uses, in the same order (samples, edge cases, the seeded random tests, then the large tests), and stops at the first failure with an ICPC-style verdict:

| Verdict | When |
|---|---|
| Accepted | every test passed |
| Wrong Answer | a test's output differs; shows the input, the expected output, your output and the first difference |
| Time Limit Exceeded | a test ran longer than the problem's `limits.time_ms` × 3 for running in a browser (`BROWSER_TIME_MULTIPLIER`); infinite loops are stopped by a watchdog that terminates the worker |
| Runtime Error | the code threw, or crashed its worker |
| Compile Error | the code has syntax or contract problems (type errors alone don't block a run) |

The code runs in a fresh Web Worker per run, with the network and script-loading APIs removed. Answers are compared as canonical JSON, by `src/runtime/answers.ts`, which the verifier uses too. The build ships each package's test set as its own lazily loaded chunk (`virtual:testset/<slug>`): small tests with their inputs and answers, and large tests as their generator plus a SHA-256 fingerprint of the answer, so 100,000-element inputs aren't downloaded. The test set and the judge load only when someone first clicks Run tests: about 70 KB gzipped, most of it `fast-check`, which the generators need.

The checker runs in a Web Worker using **TypeScript 6.0.3** (`typescript-js` in `package.json`), the last JavaScript-hosted release. The repo's own TypeScript 7 is a native binary with no browser build, so the two can disagree on newer language features. The editor and checker load only when someone first clicks Edit: about 160 KB and 1 MB gzipped.

## Commands

```sh
npm install
npm run dev          # local site with live reload at http://localhost:5173
npm run verify       # check every problem package (or: npm run verify -- binary-search)
npm test             # all tests (also runs the package checks)
npm run typecheck
npm run build        # static site in dist/
npm run check        # everything CI runs
```

Requires Node 22.18 or newer, which runs the TypeScript in `scripts/` and `problems/` directly.

## Add an algorithm

1. Copy `problems/_template/` to `problems/<slug>/`. The folder name becomes the page's URL.
2. Fill in `problem.yaml` and the statement, then add samples and invalid inputs under `data/`.
3. Write `submissions/accepted/solution.ts`. Add `// @line <label>` to every line the visualization should be able to highlight.
4. Add a brute force in `submissions/time_limit_exceeded/` and a few realistic bugs in `submissions/wrong_answer/`.
5. Write `generators/generators.ts`, plus `input_validators/validate.ts` if some constraints aren't simple ranges.
6. Write `visualization/trace.ts` and `view.ts`. The last step must set `result`.
7. Run `npm run verify -- <slug>` until everything passes, then `npm run dev` to see the page.
8. Optionally add `tests/pages/<slug>.test.ts` for what the page shows. The shared page tests and the package checks pick the new package up automatically.

## Deployment

`.github/workflows/pages.yml` runs on every push and pull request. It type-checks, verifies the packages, runs the tests and builds the site. On `main`, it then deploys `dist/` to GitHub Pages. The repo's Pages source is set to **GitHub Actions**, so nothing else in the repo is published.
