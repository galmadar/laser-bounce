# Laser Bounce — design

A laser is always on. Turn and place mirrors so the beam reaches the stops
**in order**: A then B on level 1, A→B→C on level 2, one more stop each level.

## The board

- 10×10 squares. Dark slate-blue tiles, 16-bit pixel look, all drawn in code.
- **Laser**: a grey box with a green lens. It fires one way and never moves.
- **Stops** A, B, C…: round yellow markers. The beam passes straight through.
  - Lit gold: reached in the right order.
  - Blinking: the one the light needs next.
  - Red: the light got there too early.
- **Walls**: dark bricks. They stop the beam.

## Pieces

| Piece | What it does | Turns |
|---|---|---|
| Mirror (orange) | Bounces the beam 90°. | `/` and `\` |
| Splitter (blue glass) | Lets the beam through *and* bounces a copy. | `/` and `\` |
| Block (grey) | Stops the beam. Useful to cut off a splitter branch. | — |

Some mirrors are **fixed** (darker orange, with rivets): part of the level. You
can turn them, never move or remove them. Every other piece comes from the
level's **tray**, which holds a limited number of each.

## The order rule

The beam is traced one square per step, every branch at the same pace. A stop
counts when the light **first** reaches it strictly after the stop before it.
Without a splitter that is simply "the beam passes A, then B, then C". With a
splitter it means "the light got there sooner" — two branches reaching two
stops on the same step does not count.

The beam redraws after every change. A beam that comes back onto a square in a
direction it already travelled is stopped there, so loops can't run forever.

## Controls

| Do | Mouse | Touch | Keys |
|---|---|---|---|
| Turn a mirror | click it | tap it | — |
| Pick a tray piece | click the slot | tap the slot | 1–9 |
| Place the picked piece | click an empty square | tap an empty square | — |
| Place directly | drag from tray | drag from tray | — |
| Move a piece | drag it | drag it | — |
| Put a piece back | right click, or drag it onto the tray | long press, or drag onto tray | — |
| Put the picked piece down | click its slot again | tap its slot again | Esc |
| Start the level again | ↺ button | ↺ button | R |
| Undo / redo | ↶ ↷ buttons | ↶ ↷ buttons | Ctrl/Cmd Z, Ctrl/Cmd Shift Z |
| Next / previous level | ▶ ◀ buttons (asks first) | same | N ] / P [ |
| Go to a level | — | — | Ctrl/Cmd G |
| Controls card | ? button | ? button | ? or H |

Fixed pieces give a little "no" shake when you try to move or remove them.
While a question box is open, only Enter (yes) and Esc (no) do anything.
Every key lives in one table, `src/input/keymap.ts`.

## Levels

1. **First Bounce** — A, B. Turn the fixed mirror, place one.
2. **B Before C** — A–C. The obvious path hits C before B.
3. **Zigzag** — A–D. Three mirrors, one fixed, a trap that skips C.
4. **Split Beam** — A–E. Splitter and block, both needed.
5. **Hall of Mirrors** — A–F. Three wrong fixed mirrors, splitter, block.

Level complete: the frame flashes, the stops sparkle, then a box offers the next
level. Progress (current level, levels done ★) is saved in the browser.

## How it's built

TypeScript + Vite + Vitest, like the other games here. Canvas 2D, no three.js.

- `src/sim/` — board, pieces, beam tracing, undo history. No drawing, no browser.
- `src/content/` — the level list. Maps are 10 lines of text.
- `src/render/` — draws everything at 176×216 and scales up with hard pixels.
- `src/input/` — pointer events (mouse, pen, touch) and the key table.
- `src/shell/` — the running level, question boxes, saved progress.

`npm test` checks `sim/` and `content/` never touch the DOM, canvas or
renderer, and plays every level's known solution to make sure it wins.

## Not yet

- Sound.
- More piece types (coloured filters, one-way glass, portals).
- Level select screen.

## Look

Soft pastels on a dusk-lavender ground, in a clean modern style. This replaces
the colours and pixel-art wording above.

- **Board**: rounded lavender tiles on a slightly darker base, so the gaps form a
  soft grid. Rounded corners and a gentle shadow. The rim turns gold on a win.
- **Walls**: smooth dark rounded slabs.
- **Laser**: a rounded grey box with a glowing mint lens.
- **Beam**: a smooth mint line with a white core, a soft glow and rounded bends.
- **Stops**: round badges with a letter. Idle: dark with a dull gold ring. Next:
  a gold ring that pulses outward. Lit: solid gold and glowing. Too early: a
  red ring that glows.
- **Mirror**: a peach rounded tile with a white diagonal bar.
- **Fixed mirror**: darker terracotta, with a thin inner ring and two pins.
- **Splitter**: see-through sky-blue glass with a dashed bar.
- **Block**: a solid lavender-grey rounded cube.
- **Page**: rounded pill buttons with icons, soft shadows, and hover and press
  states. The font is Nunito, falling back to the system sans font.

Every colour lives in `src/render/palette.ts`. The canvas draws at the
screen's real pixel density, so edges stay sharp.
