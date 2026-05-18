# Beckett — Google × NBCU CTV explainer

A static explainer site for the **Google Search × NBCU ACR/OCR Contextual
CTV** pitch. Holds three concepts; Concept 01 (TOO CLOSE TO CALL) is fully
built. Concepts 02 and 03 are TBD placeholders.

## Stack
Plain HTML/CSS/JS. No build step. Designed for static hosting on Vercel.

## Local preview
```bash
cd ~/Desktop/Beckett
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy
- Push to GitHub (`origin/main`)
- In Vercel: import the `edmfg/Beckett` repo, accept the defaults
  (framework: Other, build: none, output: root)
- `vercel.json` enables clean URLs so `/mechanic`, `/concept-01`, etc.
  resolve without the `.html` extension

## Pages
- `/` — landing / overview
- `/mechanic` — shared 4-step mechanic (Signal → Trigger → Ad → Search)
- `/concept-01` — TOO CLOSE TO CALL (full)
- `/concept-02` — TBD, amber accent
- `/concept-03` — TBD, cool-blue accent

## Source
`CONCEPT.md` is the project's build doc (Claude Code context file).
`theme-3-stadium-tunnel.html` is the original locked theme; kept as
reference.
