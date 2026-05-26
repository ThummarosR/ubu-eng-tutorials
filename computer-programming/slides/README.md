# AI Era Slide Extensions — Computer Programming

Markdown sources for **supplementary slides** that accompany the original Topic 1–11 decks. Designed to be imported into Google Slides or PowerPoint using a Claude/AI slide extension, or compiled directly with Marp.

## Purpose

- **Not a replacement** for the original deck — purely additive
- **5–10 supplementary slides per topic** focused on AI-era framing
- Every new slide carries a clear 🤖 header — instructors who do not wish to teach the AI extension may skip these slides without losing core content
- Tone: formal academic English, suitable for inter-institutional sharing
- Format compatible with both **Google Slides** (preferred for collaborative sharing) and **PowerPoint**

## Directory Structure

```
slides/
├── README.md                              ← this file
├── topic-01-flowchart-ai-additions.md     ← AI extension for Topic 1
├── topic-02-python-ai-additions.md        ← AI extension for Topic 2
├── ... (through topic-11)
└── images/
    ├── topic-01/
    │   ├── pipeline.png                   ← ready-to-insert PNG
    │   ├── pipeline.mmd                   ← Mermaid source (editable, re-renderable)
    │   └── ...
    └── topic-02/
        └── ...
```

## Usage with Google Slides

### Option 1 — Claude / AI slide extension (recommended)
1. Open the Google Slides deck for the relevant topic
2. Activate the Claude / AI slide extension
3. Provide the file `topic-XX-ai-additions.md` along with the instruction:
   > "Append these slides to the end of the current deck. Preserve existing fonts and theme. Insert the referenced images from `images/topic-XX/`."

### Option 2 — Manual import (without an extension)
1. Each `---` delimiter in the markdown file marks one new slide
2. The level-1 heading (`#`) becomes the slide title
3. Insert images from `images/topic-XX/` as referenced in the markdown
4. Apply the deck's existing font (commonly Sarabun or a Sarabun-compatible face)

### Option 3 — Marp (for a standalone deck)
```bash
npm install -g @marp-team/marp-cli
marp topic-01-flowchart-ai-additions.md --pptx -o topic-01-ai.pptx
```

## Editing the Diagrams

Every image has an accompanying **`.mmd` source** in the same folder. To edit and re-render:

```bash
# One-time installation of Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Re-render to PNG (transparent background, high resolution)
mmdc -i images/topic-01/pipeline.mmd -o images/topic-01/pipeline.png -b transparent -w 1600
```

## Authoring Principles for AI-Era Slides

Each new slide addresses one of the following questions:

1. **Why is this concept more important in the AI era?** — opening hook
2. **What can AI do well in this area, and what are its limits?** — strengths and limitations
3. **How should AI be directed for this task?** — practical prompt template
4. **How should AI output be evaluated for this topic?** — review checklist
5. **What mistakes does AI frequently make here?** — common pitfalls
6. **What is the 10–15 minute classroom exercise?** — hands-on activity
7. **What is the comparison between the pre-AI and AI-era approaches?** — closing summary

Not every slide deck needs to cover all seven; select 5–7 items that best fit the topic.

## Mapping: Original Topics ↔ AI-Era 15-Week Tutorial

| Original Topic | Corresponding AI-Era Tutorial Pages |
|---|---|
| Topic 1 — Intro & Flowchart | [W01](../w01-problem-finding.html) + [W03](../w03-diagrams.html) |
| Topic 2 — Intro to Python | [W04](../w04-read-ai-code.html) + [setup-python](../setup-python.html) |
| Topic 3 — Output | [W04 §examples](../w04-read-ai-code.html) |
| Topic 4 — Input | [W04 §examples](../w04-read-ai-code.html) |
| Topic 5 — Conditions | [W04](../w04-read-ai-code.html) + [W05](../w05-modify-ai-code.html) |
| Topic 6 — Repetition | [W04](../w04-read-ai-code.html) + [W05](../w05-modify-ai-code.html) |
| Topic 7 — Functions | [W05](../w05-modify-ai-code.html) + [W06](../w06-direct-from-spec.html) |
| Topic 8 — NumPy | [W09](../w09-numpy-plot.html) |
| Topic 9 — OOP / Matplotlib | [W09](../w09-numpy-plot.html) + [W11](../w11-oop-structure.html) |
| Topic 10 — Pandas | [W08](../w08-tables.html) + [W10](../w10-data-project.html) |
| Topic 11 — GenAI | [W04](../w04-read-ai-code.html) through [W06](../w06-direct-from-spec.html) + [setup-ai](../setup-ai.html) |
