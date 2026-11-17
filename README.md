# Sunpier-Harbor-City-Stories

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nanika0000/Sunpier-Harbor-City-Stories/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nanika0000/Sunpier-Harbor-City-Stories/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunpier: Harbor City Stories** — a top-down 2D open-world crime game in a sunny harbour town (3840×2560, deterministically generated: road grid, named shops, parks, parking lots, a beach, a pier and a lighthouse). Play as Mika Sol, delivery rider for Rosa's Noodles, through a five-chapter story: noodle runs, a mural repaint, a quiet clinic cargo, one very illegal yellow Gullwing, and the harbour ledger itself.

Walk or drive anywhere. Steal parked cars (mind the alarms), brawl with pedestrians, and manage your wanted level — heat rises with every witnessed crime, stars bring out the pier watch (two patrol cars per star), and getting surrounded at low speed means BUSTED. Full HUD with cash, health, wanted stars and a mission timer, a live minimap with objective beacon, dialogue, synthesized WebAudio sound (engine, sirens, alarms — no audio files), and localStorage saves between chapters. Static files only: no build step, no network, no libraries.

**Controls:** WASD / arrows to move and drive · Shift to run · E to enter or steal a car · F to punch · P to pause · Enter to talk, confirm and start chapters.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
# (or simply open game/index.html — it runs from file:// too)
```

To rebuild the hand-in bundle (copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=bwze4h58&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
