// The screenshot scenes behind ?shot=chase|street|mission|start. Each one arranges the
// real game state — the actual town, cars, pedestrians, police and mission bookkeeping —
// and lets the renderer paint it, so a screenshot is the game as it truly plays, staged
// at a photogenic moment. chase is first by file name on purpose: the cover should be
// the game at full stretch, not a menu.
import { HEAT } from './config.js';
import { createCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function place(game, x, y) {
  game.player.x = x;
  game.player.y = y;
  game.camera.x = x;
  game.camera.y = y;
}

function copAt(game, x, y, angle) {
  const cop = createCar(x, y, angle, '#e8e8ea', 'police');
  game.police.push(cop);
  return cop;
}

/** The cover: a stolen sports car, three stars, the pier watch closing in mid-chase. */
function stageChase(game) {
  game.screen = SCREEN_PLAY;
  game.cash = 690;
  game.progress.cash = 690;
  // The player is driving a stolen red coupe east along the second avenue.
  const car = createCar(1450, 690, 0, '#c23b2e', 'player');
  car.speed = 315;
  car.alarm = true;
  car.alarmT = 99;
  game.player.mode = 'car';
  game.player.car = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = 0;
  place(game, car.x, car.y);
  // The law, arriving from three sides.
  copAt(game, 1180, 700, 0.15);
  copAt(game, 1330, 560, 0.9);
  copAt(game, 1620, 830, -2.4);
  game.heat = HEAT.thresholds[3] + 6;
  game.stars = 3;
  game.sirenOn = true;
  // Chapter 3 is on the clock, cooler in the back.
  game.missionDefs = game.missionDefs; // (defs already built on the real world)
  game.mission = { index: 2, def: game.missionDefs[2], stage: 1, timer: 74, state: 'run', failed: false };
  // A few townsfolk on the sidewalks for scale.
  game.peds.slice(0, 6).forEach((ped, i) => {
    ped.x = 1230 + i * 68;
    ped.y = 640;
    ped.fear = 2;
    ped.angle = -Math.PI / 2;
  });
  game.time = 12;
}

/** Street level: Mika on foot outside Rosa's, first order in hand, town flowing past. */
function stageStreet(game) {
  game.screen = SCREEN_PLAY;
  const noodle = game.world.landmarks.noodle;
  place(game, noodle.doorX + 30, noodle.doorY + 44);
  game.player.angle = -0.5;
  game.cash = 0;
  game.mission = { index: 0, def: game.missionDefs[0], stage: 0, timer: 100, state: 'run', failed: false };
  game.dialogue = {
    lines: [
      { who: 'Aunt Rosa', text: 'Mika! There you are. The Tanaka order is getting cold.' },
      { who: 'Mika', text: 'One noodle run across town. Easy money, right?' },
    ],
    i: 0,
    after: null,
  };
  game.peds.slice(0, 5).forEach((ped, i) => {
    ped.x = noodle.doorX - 90 + i * 44;
    ped.y = noodle.doorY + 60 + (i % 2) * 26;
  });
  game.time = 4;
}

/** The long drive south: ledger aboard, the lighthouse beacon across the beach. */
function stageMission(game) {
  game.screen = SCREEN_PLAY;
  const car = createCar(2940, 2068, 0, '#2e5fc2', 'player');
  car.speed = 265;
  game.player.mode = 'car';
  game.player.car = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = 0;
  place(game, car.x, car.y);
  // Frame the harbour: the camera sits a little south of the car so the pier, the
  // lighthouse and the beacon all share the shot with the coast road.
  game.camera.y = 2135;
  // One patrol car on the player's tail — half the town really is chasing this book.
  copAt(game, 2615, 2052, 0.05);
  game.heat = HEAT.thresholds[1] + 4;
  game.stars = 1;
  game.cash = 1140;
  game.progress.cash = 1140;
  game.mission = { index: 4, def: game.missionDefs[4], stage: 1, timer: 96, state: 'run', failed: false };
  game.time = 8;
}

/** The title over a slow harbour pan (the loop does the panning; this frames one still). */
function stageStart(game) {
  game.screen = SCREEN_TITLE;
  game.camera.x = 2740;
  game.camera.y = 1560;
  game.saveData = { missionIndex: 2, cash: 690, storyDone: false };
  game.time = 2;
}

export function stageShot(name, game) {
  if (name === 'street') stageStreet(game);
  else if (name === 'mission') stageMission(game);
  else if (name === 'start') stageStart(game);
  else stageChase(game);
  return game;
}
