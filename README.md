# UBU Engineering Tutorials

Open-source teaching tools and lab tutorials from the **Faculty of Engineering,
Ubon Ratchathani University**. Each subdirectory is its own track with its own
README, dependencies, and release cycle. Everything here is licensed Apache 2.0.

| Track | What it is | Status |
|---|---|---|
| [**ubu-electrical-basic**](./ubu-electrical-basic/) | Electron + web app: IEC 60617 schematic editor, circuit analysis (DC / AC / 3φ), and linear SISO control-system block diagrams (Mason's rule + root-locus rule walkthrough). | Released v0.3.4 |
| computer-programming | 15-week introduction-to-programming curriculum (Python, AI-era pedagogy). Used in the *1306 100 Computer Programming* course. | Coming soon |
| ripes-tutorial | RISC-V assembly + computer-architecture tutorial built around the [Ripes](https://github.com/mortbopet/Ripes) simulator. Used in *1306 220 Computer System and Architecture*. | Coming soon |
| plc-automation-tutorial | 11-page step-by-step PLC ladder-logic tutorial for FX5U / HMI / PID / Modbus. | Coming soon |
| opcua-tutorial | 10-chapter tutorial on IEC 62541 / Industrie 4.0 OPC UA, designed for Year 3–4 students after PLC + Modbus. | Coming soon |

The first track (ubu-electrical-basic) is the only one published in this commit;
the other four will land here as they're sanitised for public release.

## Releases

Each track is versioned independently. Tags use the format
`<track>-<version>`, e.g. `electrical-basic-v0.3.4`.
Pre-built binaries (where applicable) are attached as assets on the
[GitHub Releases](../../releases) page.

## Contributing

Issues and pull requests welcome. Please tag the issue with the track name
(`[electrical-basic] ...`) so it's easy to triage.

## License

[Apache License 2.0](./LICENSE) — Copyright © 2026 Faculty of Engineering,
Ubon Ratchathani University.

Some tracks bundle third-party reference material (e.g. Erik Cheever's
`RLocusGui.m` inside `ubu-electrical-basic/` is included as a historical
reference for the root-locus rule walkthrough). Those bundles retain their
original licenses; see each track's README + LICENSE for details.
