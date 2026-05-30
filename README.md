# UBU Engineering Tutorials

Open-source teaching tools and lab tutorials from the **Faculty of Engineering,
Ubon Ratchathani University**. Each subdirectory is its own track with its own
README, dependencies, and release cycle. Everything here is licensed Apache 2.0.

| Track | What it is |
|---|---|
| [**computer-programming**](./computer-programming/) | 15-week introduction-to-programming curriculum (Python, AI-era pedagogy). Used in the *1306 100 Computer Programming* course. |
| [**ripes-tutorial**](./ripes-tutorial/) | RISC-V assembly + computer-architecture tutorial built around the [Ripes](https://github.com/mortbopet/Ripes) simulator. Used in *1306 220 Computer System and Architecture*. |
| [**plc-automation-tutorial**](./plc-automation-tutorial/) | Step-by-step PLC ladder-logic tutorial for Mitsubishi FX5U and Omron CP1L: HMI, PID, Modbus. |
| [**opcua-tutorial**](./opcua-tutorial/) | 10-chapter tutorial on IEC 62541 / Industrie 4.0 OPC UA, designed for Year 3–4 students after PLC + Modbus. |
| [**ai-harness-engineering**](./ai-harness-engineering/) | Advanced, concept-only tutorial on **AI harness engineering** — turning a language model into a reliable, production-grade AI agent (tools, context, memory, grounding, permissions, observability, evaluation). For engineers and graduate students. |

## Related tools (separate repos)

Standalone applications that support these courses live in their own
repositories so they can have independent release cycles and issue
trackers:

| Tool | Repo |
|---|---|
| **UBUElectricalBasic** — Electron + web app: IEC 60617 schematic editor, circuit analysis (DC / AC / 3φ), and linear SISO control-system block diagrams (Mason's rule + root-locus rule walkthrough). Windows installer + open-source code. | [ThummarosR/ubu-electrical-basic](https://github.com/ThummarosR/ubu-electrical-basic) |

## Relationship to the program website

The Mechatronics & Automotive Engineering programme website
([mechatronics-website-...run.app](https://mechatronics-website-655397920844.asia-southeast1.run.app/tutorials))
is the **canonical hosted version** of these tutorials — that's where
students actually read them. This repo is a **public snapshot for external
contributions** and may lag slightly behind the live website.

If you spot a typo or want to add a small improvement, opening a PR here is
welcome — we'll fold it into the website on the next refresh. For the
authoritative reading experience, use the website link.

## Contributing

Issues and pull requests welcome. Please tag the issue with the track name
(`[ripes] ...`, `[plc] ...`, etc.) so it's easy to triage.

## License

[Apache License 2.0](./LICENSE) — Copyright © 2026 Faculty of Engineering,
Ubon Ratchathani University.

Each tutorial references external tools, vendor manuals, or standards
(Ripes, Mitsubishi / Omron / Delta documentation, the OPC UA / IEC 62541
specification, etc.) that remain under their respective licenses and are
referenced — not redistributed — here. See each track's README for the
specifics.
