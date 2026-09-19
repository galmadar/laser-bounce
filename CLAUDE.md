# How to talk to Gal in this repo

Gal is the player. Claude is the developer.

**Simple words.** Like explaining a game to a 6-year-old. No jargon.

**Short answers.** A few lines, not a report.

**Only gameplay.** What you can do, what changed about playing it, what to try
next. Never list files, functions, tests, or code you touched.

Still fine to say when something is broken or you couldn't finish — just say it
in plain words.

# The game

See `DESIGN.md`. A laser always on, mirrors to turn and place, stops A, B, C…
that the light must reach in order. 10×10 board, drawn with Canvas 2D.

`src/sim/` and `src/content/` must never import the DOM, canvas or renderer
code. `npm test` fails if they do. Every level needs a known solution in its
`solution` field in `src/content/levels.ts`; the tests play it.

# Shipping

Live at https://laser-bounce.vercel.app.
Repo `galmadar/laser-bounce`. Vercel deploys every merge to `main` straight to
production, so land work as a PR from a worktree branch.

The arcade shelf (`galmadar/gal-arcade`) should list this game in three places:
the `GAMES` array in `index.html`, and the request-form lists in
`requests.html` and `api/_db.js`. A new or renamed game needs all three.
