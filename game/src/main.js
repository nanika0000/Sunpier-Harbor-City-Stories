// Sunpier: Harbor City Stories — boot and the one loop. The world advances in fixed
// 1/60 s steps; this file owns the game state, walks the player between screens (title,
// play, paused, busted, wasted, story complete), and wires the systems together:
// world, vehicles, pedestrians, police, missions, audio, save.
//
// ?seed=N fixes the town's generation. ?shot=chase|street|mission|start (with &seed=N)
// stages a screenshot scene instead of running the loop, paints it and sets
// window.__shotReady. window.__sunpierState exposes the live game for play tests.
import { HEAT, PED, PLAYER, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { generateWorld, collideCircle } from './world.js';
import { createCar, drivePlayerCar, settleParked, spawnParked, spawnTraffic, updateTraffic } from './vehicles.js';
import { punchTarget, spawnPeds, updatePeds } from './pedestrians.js';
import { starsForHeat, updatePolice, updateWanted } from './police.js';
import { buildMissions, nextGiver, startMission, updateMission } from './missions.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, storeSave } from './save.js';
import {
  PRESS_CONFIRM, PRESS_CONTINUE, PRESS_INTERACT, PRESS_PAUSE, PRESS_PUNCH, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

export function createGame() {
  const random = createRandom(seed);
  const world = generateWorld(random);
  const game = {
    time: 0,
    screen: SCREEN_TITLE,
    world,
    missionDefs: buildMissions(world),
    camera: { x: world.landmarks.noodle.x, y: world.landmarks.noodle.y },
    player: {
      x: world.landmarks.noodle.doorX, y: world.landmarks.noodle.doorY + 26,
      angle: Math.PI / 2, hp: PLAYER.maxHp, mode: 'foot', car: null, walkPhase: 0, punchT: 0, punchCd: 0,
    },
    cash: 0,
    heat: 0, stars: 0, bust: 0, lastCrime: -99, copTimer: 0, sirenOn: false,
    traffic: [], parked: [], peds: [], police: [],
    gullwing: null,
    mission: null,
    dialogue: null,
    toastMsg: null,
    lastPunch: null,
    lastFine: 0,
    progress: { missionIndex: 0, cash: 0, storyDone: false },
    saveData: loadSave(),
    audio: createAudio(),
    random,
  };
  game.parked = spawnParked(game, random);
  game.traffic = spawnTraffic(game, random);
  game.peds = spawnPeds(game, random);

  game.toast = (text) => { game.toastMsg = { text, until: game.time + 3.4 }; };
  game.addHeat = (amount, x, y) => {
    game.heat += amount;
    game.lastCrime = game.time;
    game.stars = starsForHeat(game.heat);
  };
  game.showDialogue = (lines, after) => {
    game.dialogue = { lines, i: 0, after };
  };
  game.saveProgress = () => {
    storeSave(game.progress);
    game.saveData = loadSave();
  };
  game.hurtPlayer = (amount, why) => {
    if (game.screen !== SCREEN_PLAY) return;
    game.player.hp -= amount;
    if (game.player.hp <= 0) game.onWasted(why);
  };
  game.respawnAtClinic = () => {
    const clinic = world.landmarks.clinic;
    if (game.player.mode === 'car') game.exitCar(true);
    game.player.x = clinic.doorX;
    game.player.y = clinic.doorY + 24;
    game.player.hp = PLAYER.maxHp;
    game.heat = 0;
    game.stars = 0;
    game.bust = 0;
    game.police.length = 0;
  };
  game.respawnAtGiver = (mission) => {
    const giver = mission.def.giver;
    if (game.player.mode === 'car') game.exitCar(true);
    game.player.x = giver.doorX;
    game.player.y = giver.doorY + 24;
  };
  game.onBusted = () => {
    game.lastFine = Math.min(game.cash, Math.max(20, Math.round(game.cash * 0.12)));
    game.cash -= game.lastFine;
    game.progress.cash = game.cash;
    game.saveProgress();
    game.audio.busted();
    game.screen = SCREEN_BUSTED;
    status.textContent = `Busted. Fine $${game.lastFine}.`;
  };
  game.onWasted = () => {
    game.lastFine = Math.min(game.cash, Math.max(15, Math.round(game.cash * 0.08)));
    game.cash -= game.lastFine;
    game.progress.cash = game.cash;
    game.saveProgress();
    game.audio.crash();
    game.screen = SCREEN_WASTED;
    status.textContent = `Wasted. Clinic bill $${game.lastFine}.`;
  };
  game.onStoryComplete = () => {
    game.screen = SCREEN_COMPLETE;
    status.textContent = 'Story complete. Sunpier is yours to roam.';
  };
  game.enterCar = (car) => {
    game.player.mode = 'car';
    game.player.car = car;
    game.audio.enter();
    if (car.kind === 'traffic') {
      // Hopping into a moving car means it leaves the traffic system for good.
      const idx = game.traffic.indexOf(car);
      if (idx >= 0) game.traffic.splice(idx, 1);
      car.kind = 'player';
      game.toast('You yank the driver out and take the wheel!');
      game.addHeat(HEAT.theftAlarm, car.x, car.y);
    }
    if (car.kind === 'parked') {
      // Taking a parked car: sometimes the alarm talks.
      const idx = game.parked.indexOf(car);
      if (idx >= 0) game.parked.splice(idx, 1);
      car.kind = 'player';
      if (game.random() < 0.55) {
        car.alarm = true;
        car.alarmT = 6;
        game.addHeat(HEAT.theftAlarm, car.x, car.y);
        game.toast(car.special === 'gullwing' ? 'The Gullwing alarm screams!' : 'Car alarm! Someone heard that.');
        game.audio.alarm();
      } else {
        game.addHeat(HEAT.theftQuiet, car.x, car.y);
        game.toast('Quietly does it…');
      }
    }
  };
  game.exitCar = (silent = false) => {
    const car = game.player.car;
    if (!car) return;
    car.kind = 'parked';
    if (!game.parked.includes(car)) game.parked.push(car);
    game.player.mode = 'foot';
    game.player.car = null;
    game.player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 34;
    game.player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 34;
    const resolved = collideCircle(world, game.player.x, game.player.y, PLAYER.radius);
    game.player.x = resolved.x;
    game.player.y = resolved.y;
    if (!silent) game.audio.enter();
  };
  return game;
}

/** Start (or restart) the story: fresh progress, or the saved one when `continuing`. */
function beginStory(game, continuing) {
  if (continuing && game.saveData) {
    game.progress = {
      missionIndex: Math.min(game.saveData.missionIndex, game.missionDefs.length),
      cash: game.saveData.cash,
      storyDone: game.saveData.storyDone,
    };
  } else {
    game.progress = { missionIndex: 0, cash: 0, storyDone: false };
    clearSave();
  }
  game.cash = game.progress.cash;
  game.respawnAtClinic();
  const noodle = game.world.landmarks.noodle;
  game.player.x = noodle.doorX;
  game.player.y = noodle.doorY + 26;
  game.player.hp = PLAYER.maxHp;
  game.screen = SCREEN_PLAY;
  status.textContent = 'Sunpier. Your story starts at Rosa\'s Noodles.';
  if (game.progress.missionIndex < game.missionDefs.length) {
    game.toast(game.progress.missionIndex === 0 ? 'Head to the gold marker — Rosa is waiting.' : 'The gold marker shows the next chapter.');
  } else {
    game.toast('Story complete — Sunpier is yours. The marker is gone; the town is not.');
  }
}

/** The nearest car the player could get into, or null. */
function carInReach(game) {
  const p = game.player;
  let best = null;
  let bestD = PLAYER.enterRange;
  for (const car of [...game.parked, ...game.traffic]) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function stepPlayer(game, input, dt) {
  const player = game.player;
  if (player.punchT > 0) player.punchT -= dt;
  if (player.punchCd > 0) player.punchCd -= dt;

  if (player.mode === 'car' && player.car) {
    const move = input.moveVector();
    const events = drivePlayerCar(game, player.car, { throttle: -move.y, steer: move.x }, dt);
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    if (events.hitCar && events.impact > 130) game.audio.crash();
    if (events.hitBuilding && events.impact > 150) {
      game.audio.crash();
      game.hurtPlayer(3, 'A crash rattled you.');
    }
    game.audio.engine(player.car.speed);
    return;
  }

  const move = input.moveVector();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (move.x !== 0 || move.y !== 0) {
    const len = Math.hypot(move.x, move.y);
    const vx = (move.x / len) * speed;
    const vy = (move.y / len) * speed;
    const resolved = collideCircle(game.world, player.x + vx * dt, player.y + vy * dt, PLAYER.radius);
    player.x = resolved.x;
    player.y = resolved.y;
    player.angle = Math.atan2(vy, vx);
    player.walkPhase += dt * (input.running() ? 12 : 8.5);
  }
  game.audio.engine(null);
}

function doPunch(game) {
  const player = game.player;
  if (player.mode !== 'foot' || player.punchCd > 0) return;
  player.punchCd = PLAYER.punchCooldown;
  player.punchT = 0.18;
  game.audio.punch();
  const target = punchTarget(game);
  game.lastPunch = { x: player.x, y: player.y, t: game.time, target };
  if (!target) return;
  target.down = 4;
  target.fear = 0;
  const loot = 6 + Math.floor(game.random() * 22);
  game.cash += loot;
  game.progress.cash = game.cash;
  game.addHeat(HEAT.punchPed, target.x, target.y);
  game.toast(`Took $${loot} off a pedestrian. Classy.`);
  game.audio.cash();
}

function stepGame(game, input, dt) {
  game.time += dt;
  const presses = input.takePresses();

  // Dialogue swallows confirm presses and freezes the player's feet, not the town.
  if (game.dialogue) {
    if (presses.includes(PRESS_CONFIRM) || presses.includes(PRESS_INTERACT)) {
      game.dialogue.i += 1;
      if (game.dialogue.i >= game.dialogue.lines.length) {
        const after = game.dialogue.after;
        game.dialogue = null;
        after?.();
      }
    }
    updateTraffic(game, dt, game.random);
    updatePeds(game, dt, game.random);
    return;
  }

  for (const press of presses) {
    if (press === PRESS_PAUSE && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      return;
    }
    if (press === PRESS_INTERACT) {
      if (game.player.mode === 'car') game.exitCar();
      else {
        const car = carInReach(game);
        if (car) game.enterCar(car);
      }
    }
    if (press === PRESS_PUNCH) doPunch(game);
    if (press === PRESS_CONFIRM) {
      // Standing at a chapter's giver with no mission running starts the chapter.
      if (!game.mission && game.progress.missionIndex < game.missionDefs.length) {
        const giver = nextGiver(game);
        if (giver && Math.hypot(game.player.x - giver.doorX, game.player.y - giver.doorY) < 84) {
          startMission(game, game.progress.missionIndex);
        }
      }
    }
  }

  stepPlayer(game, input, dt);
  updateTraffic(game, dt, game.random);
  settleParked(game, dt);
  updatePeds(game, dt, game.random);
  updateWanted(game, dt, game.random);
  updatePolice(game, dt);
  updateMission(game, dt);
  game.audio.siren(game.sirenOn);

  // Camera: a gentle chase after whoever the player is right now.
  const focus = game.player.mode === 'car' && game.player.car ? game.player.car : game.player;
  game.camera.x += (focus.x - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (focus.y - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = Math.min(WORLD.width - 40, Math.max(40, game.camera.x));
  game.camera.y = Math.min(WORLD.height - 40, Math.max(40, game.camera.y));
}

function runGame() {
  const game = createGame();
  window.__sunpierState = game;
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function handleScreenPresses() {
    const presses = input.takePresses();
    for (const press of presses) {
      game.audio.unlock();
      if (game.screen === SCREEN_TITLE) {
        if (press === PRESS_CONFIRM) beginStory(game, false);
        else if (press === PRESS_CONTINUE && game.saveData) beginStory(game, true);
      } else if (game.screen === SCREEN_PAUSED && (press === PRESS_PAUSE || press === PRESS_CONFIRM)) {
        game.screen = SCREEN_PLAY;
      } else if ((game.screen === SCREEN_BUSTED || game.screen === SCREEN_WASTED) && press === PRESS_CONFIRM) {
        game.respawnAtClinic();
        game.screen = SCREEN_PLAY;
      } else if (game.screen === SCREEN_COMPLETE && press === PRESS_CONFIRM) {
        game.screen = SCREEN_PLAY;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(game, input, STEP);
        accumulator -= STEP;
        if (game.screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else {
      accumulator = 0;
      handleScreenPresses();
      // The title screen idles over a slow pan of the harbour.
      if (game.screen === SCREEN_TITLE) {
        game.time += 1 / 60;
        game.camera.x = 1920 + Math.sin(game.time * 0.05) * 900;
        game.camera.y = 1500 + Math.cos(game.time * 0.037) * 620;
        updateTraffic(game, STEP, game.random);
      }
    }
    renderer.draw(game);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSED;
  });

  status.textContent = 'Sunpier: Harbor City Stories. Press Enter to start.';
  requestAnimationFrame(frame);
}

function runShot(name) {
  const game = createGame();
  window.__sunpierState = game;
  stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
