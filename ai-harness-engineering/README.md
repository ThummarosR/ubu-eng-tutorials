# AI Harness Engineering

Advanced, **concept-only** Thai-language tutorial on **AI harness engineering** —
the scaffolding that turns a raw language model into a reliable, production-grade
AI agent. Aimed at engineers and graduate students, not first-years.

> **The thesis:** a language model is the *engine*; the **harness** is everything you
> design around it — tools, context, memory, grounding, permissions, observability.
> Reliability is *engineered*, not bought.

Static HTML — open `index.html` in a browser, or serve the folder with any
static-file server. No build step, no dependencies. There is **no code** in the
tutorial: every idea is taught as system *behaviour and flow*.

## How it's organised

- **Part 0 · ปูพื้นทฤษฎี (theory primer)** — what a harness is, its anatomy and the
  agentic loop (gather → act → verify → repeat), and a map of the 2026 field vocabulary.
- **Parts 1–6 · 20 chapters** — build a "Lab Operations Assistant" from a throwaway
  script into a production agent (tools → context → memory → grounding → permissions →
  observability), connect it to the world (MCP, Skills), make it good and safe (context
  engineering, security, orchestration, evaluation), and look at the frontier (Physical
  AI, human integration, a capstone).
- **Fleet Gallery** — a consolidated scorecard comparing five real systems across six
  harness dimensions.

Every chapter has its own interactive, vanilla-JS activity.

## Audience

Engineers and graduate students taking an advanced course; assumes general familiarity
with software systems. Thai-first, with English technical terms kept in English
(MCP, context, tools, agent, …).

## Live version

The canonical hosted version is on the [Mechatronics Engineering program
website](https://mechatronics-website-655397920844.asia-southeast1.run.app/tutorials).

## License + acknowledgements

Tutorial text, HTML, CSS, and JavaScript: Apache 2.0 — see [../LICENSE](../LICENSE).

The "real systems" used as worked examples are described only as *behaviour and flow* —
no source code, file paths, or internal configuration is reproduced. The field concepts
are synthesised from public 2025–2026 research and documentation (Anthropic, the Model
Context Protocol, OpenAI, and others), which are referenced — not redistributed; see the
in-tutorial **references** page for the full list.
