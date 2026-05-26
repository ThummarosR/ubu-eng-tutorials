# UBUElectricalBasic

A free, open-source teaching tool for undergraduate electrical engineering.
Three modes in one app:

- **Schematic** — IEC 60617 motor-control diagrams (MCB, contactor, overload, push-button NO/NC, pilot lamps, 3-phase motors) with a live simulator: wires glow, lamps light, motors animate.
- **Circuit Analysis** — DC nodal/mesh/superposition/Thévenin walkthroughs with worked examples, AC mode with H(s) / Bode / phasor / step response / pole-zero / power, and balanced 3-phase analysis.
- **Block Diagram** — linear SISO control-system reduction with Mason's gain formula, root locus with the full RLocusGui-style rule walkthrough (asymptotes, real-axis segments, break points, ω-axis crossings, etc.), and a P/I/D + plant playground.

Every mode shows the *moves*, not just the result: step-by-step prose in Thai + technical English, with quantity-coloured math (V = blue, I = emerald, R = amber, G = sky, H = fuchsia, Δ = indigo, ω = cyan, …).

Built at the **Faculty of Engineering, Ubon Ratchathani University** for the *1306 211 Electrical Engineering Workshop* and *1306 210 Electrical Engineering Laboratory I* courses, plus the linear-control-systems course.

---

## Install

### Windows

1. Download the latest `UBUElectricalBasic-Setup-*.exe` from the [Releases](#) page.
2. Double-click. SmartScreen may warn "publisher unknown" — click *More info → Run anyway* (the installer is unsigned for now).
3. Choose an install folder, pick whether to create Desktop / Start Menu shortcuts, and finish.
4. Launch from the shortcut. Fully offline.

### Run in a browser (no install)

If you have Node.js 18+ installed:

```bash
git clone https://github.com/<your-org>/ubu-electrical-basic.git
cd ubu-electrical-basic
npm install
npm run dev
# open http://localhost:5173
```

Or `npm run build && npm run preview` for a production build.

---

## Build the installer yourself

```bash
npm install
npm run dist
# output: release/UBUElectricalBasic-Setup-<version>-x64.exe
```

`npm run dist` re-generates the icon (`scripts/build-icon.cjs` from `public/icon.svg`),
runs `tsc -b && vite build`, then packages with `electron-builder --win nsis`.

---

## Project structure

```
src/
  components/
    nodes/iec.tsx           ~70 IEC 60617 symbol descriptors + IECNode wrapper
    AnalysisPanel.tsx       Right-side DC/AC/3φ analysis panel
    BlockDiagramPanel.tsx   Right-side block-diagram panel (Mason + plots)
    RootLocusPlot.tsx       Zoomable root-locus + rule walkthrough
    FormattedStep.tsx       Quantity-coloured math renderer
  lib/
    analyze/                Polynomial algebra, MNA solver, root finder, units
    blockdiagram/           Mason's rule, s-poly parser, SymExpr CAS-lite, RLocus rules
    examples.ts             Catalogue of example diagrams (JSON-backed for hand-tuned ones)
electron/main.cjs           Electron main process
scripts/build-icon.cjs      SVG → multi-resolution ICO
```

## Tech

[Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript;
[React Flow](https://reactflow.dev/) for the canvas;
[Tailwind CSS](https://tailwindcss.com/);
[Zustand](https://github.com/pmndrs/zustand) for app state;
[Electron](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/) for the Windows installer;
[Vitest](https://vitest.dev/) for the tests.

No backend, no telemetry, no network calls.

## Tests

```bash
npm test         # one-shot
npm run test:watch
```

Currently 62 tests covering the polynomial parser, the SymExpr arithmetic,
Mason's rule (including non-touching loop topologies), and the root-locus rules.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Copyright © 2026 Faculty of Engineering, Ubon Ratchathani University.

## Acknowledgements

- The root-locus rule walkthrough is modelled after **Erik Cheever's RLocusGui**
  (Swarthmore College, 2007) — a long-time favourite for learning the textbook
  rules visually.
- IEC 60617 symbol layouts follow the conventions used in the
  *1306 211 Electrical Engineering Workshop* and *1306 210 Electrical
  Engineering Laboratory I* lab manuals at UBU Faculty of Engineering.
