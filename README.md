# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/rachmantc16/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/rachmantc16/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Starfall Defender** is an original neon arcade defender written in vanilla JavaScript and Canvas, with every sound synthesized live through Web Audio — no libraries, no assets, no network. Pilot the last ship guarding the line: move with the mouse, arrow keys or A/D, and hold Space or the mouse button to fire. Shoot down waves of drifters, weavers, divers and armored tanks, chain kills into a combo multiplier up to x8, catch falling orbs for Rapid Fire, Spread Shot, Shield and extra lives, and bring down the Dreadnought boss every fifth wave — clear wave 10 to win, or fall and lose your last life. Breaches cost lives too, so guard the line.

## Run it

Hand the entry in (copies `game/` and `screenshots/` to the output directory and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Before copying, the handover verifies the payload — every file under `game/` present and non-empty, every screenshot within the 256 KiB cap — clears any stale output from a previous run, and prints a build summary (game file count, screenshot sizes, dossier size) after reading `dossier.json` back. A clean run reports 11 game files, 4 screenshots and a valid `makefun/dossier/v1` dossier.

Or play the game locally with the tiny bundled server, then open the address it prints:

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=pas2z9sw&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
