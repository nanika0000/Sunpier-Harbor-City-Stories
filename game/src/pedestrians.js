// Pedestrians: townsfolk who stroll the sidewalks, scatter when a car comes at them or a
// fist swings, and — this matters in a crime game — phone the police about what they saw.
// A pedestrian walks a sidewalk line (the ring just inside a block edge, or the road edge),
// turning at corners. Fear is a timer: while it lasts they run straight away from trouble.
import { HEAT, PED, WORLD, COAST_Y, HROADS, VROADS, ROAD_W } from './config.js';
import { collideCircle } from './world.js';

const SKIN = ['#e8b98d', '#c68e5e', '#8a5a3b', '#f0c8a0', '#6e4525'];
const CLOTHES = ['#d96f4a', '#4a7fa5', '#7fa653', '#c2b280', '#8a6fb8', '#d8d8d8', '#b3541e', '#3f9e8c'];

let nextPedId = 1;

function makePed(random, x, y) {
  return {
    id: nextPedId++, x, y, angle: random() * Math.PI * 2,
    speed: PED.walkSpeed * (0.7 + random() * 0.6),
    axis: random() < 0.5 ? 'x' : 'y',
    dir: random() < 0.5 ? 1 : -1,
    line: 0, fear: 0, down: 0, reported: false,
    skin: SKIN[Math.floor(random() * SKIN.length)],
    clothes: CLOTHES[Math.floor(random() * CLOTHES.length)],
    walkPhase: random() * 6,
  };
}

/** The sidewalk line a pedestrian follows: just inside the nearest road edge. */
function snapToSidewalk(ped) {
  if (ped.axis === 'x') {
    let best = Infinity;
    for (const hy of [...HROADS, COAST_Y]) {
      for (const side of [-1, 1]) {
        const line = hy + side * (ROAD_W / 2 + 16);
        if (Math.abs(ped.y - line) < best) { best = Math.abs(ped.y - line); ped.line = line; }
      }
    }
    ped.y = ped.line;
  } else {
    let best = Infinity;
    for (const vx of VROADS) {
      for (const side of [-1, 1]) {
        const line = vx + side * (ROAD_W / 2 + 16);
        if (Math.abs(ped.x - line) < best) { best = Math.abs(ped.x - line); ped.line = line; }
      }
    }
    ped.x = ped.line;
  }
}

export function spawnPeds(game, random) {
  const peds = [];
  for (let i = 0; i < PED.count; i += 1) {
    const ped = makePed(random, 300 + random() * (WORLD.width - 600), 200 + random() * 1700);
    snapToSidewalk(ped);
    peds.push(ped);
  }
  return peds;
}

function scare(game, ped, fromX, fromY, reportHeat) {
  ped.fear = 3.2;
  ped.angle = Math.atan2(ped.y - fromY, ped.x - fromX);
  if (reportHeat > 0 && !ped.reported) {
    ped.reported = true;
    ped.reportT = game.time;
    game.addHeat(reportHeat, ped.x, ped.y);
    game.toast('A witness is calling the police!');
  }
}

/** One step for every pedestrian: stroll, flee, get up, and notice crimes near them. */
export function updatePeds(game, dt, random) {
  const player = game.player;
  for (const ped of game.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    ped.reported = ped.reported && game.time - (ped.reportT ?? 0) < 20;
    let vx = 0;
    let vy = 0;
    if (ped.fear > 0) {
      ped.fear -= dt;
      vx = Math.cos(ped.angle) * PED.fleeSpeed;
      vy = Math.sin(ped.angle) * PED.fleeSpeed;
    } else {
      // Stroll the sidewalk; at a crossing, sometimes swap axis.
      if (ped.axis === 'x') {
        vx = ped.dir * ped.speed;
        ped.y += (ped.line - ped.y) * Math.min(1, dt * 3);
        for (const vxRoad of VROADS) {
          if (Math.abs(ped.x - vxRoad) < 6 && random() < 0.012) { ped.axis = 'y'; snapToSidewalk(ped); }
        }
      } else {
        vy = ped.dir * ped.speed;
        ped.x += (ped.line - ped.x) * Math.min(1, dt * 3);
        for (const hy of HROADS) {
          if (Math.abs(ped.y - hy) < 6 && random() < 0.012) { ped.axis = 'x'; snapToSidewalk(ped); }
        }
      }
      if (ped.x < 60 || ped.x > WORLD.width - 60) ped.dir *= -1;
      if (ped.y < 60 || ped.y > COAST_Y - 40) ped.dir *= -1;
      ped.angle = Math.atan2(vy, vx);
    }
    const resolved = collideCircle(game.world, ped.x + vx * dt, ped.y + vy * dt, PED.radius);
    ped.x = resolved.x;
    ped.y = resolved.y;
    ped.walkPhase += dt * (ped.fear > 0 ? 13 : 7);

    // Danger sense: a fast car close by, or the player's car bearing down, scares them off.
    const threats = [];
    if (player.mode === 'car' && player.car) threats.push(player.car);
    for (const car of game.traffic) threats.push(car);
    for (const car of threats) {
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      const d2 = dx * dx + dy * dy;
      if (Math.abs(car.speed) > 200 && d2 < 120 * 120) {
        scare(game, ped, car.x, car.y, 0);
      }
      // Run over: the pedestrian goes down, cash scatters, and everyone saw it.
      if (d2 < 34 * 34 && Math.abs(car.speed) > 60) {
        ped.down = 6;
        ped.fear = 0;
        if (car === player.car) {
          game.addHeat(HEAT.hitPed, ped.x, ped.y);
          game.toast('You ran someone down!');
          game.audio?.crash();
          if (player.car) player.car.speed *= 0.5;
        }
      }
    }
    // A punch landing nearby (main.js sets game.lastPunch) scares the block.
    if (game.lastPunch && game.time - game.lastPunch.t < 0.1) {
      const dx = ped.x - game.lastPunch.x;
      const dy = ped.y - game.lastPunch.y;
      if (dx * dx + dy * dy < 130 * 130 && ped !== game.lastPunch.target) {
        scare(game, ped, game.lastPunch.x, game.lastPunch.y, 0);
      }
    }
  }
}

/** The player's fist: hit the nearest pedestrian in range and facing. Returns the victim. */
export function punchTarget(game) {
  const player = game.player;
  let best = null;
  let bestD = Infinity;
  for (const ped of game.peds) {
    if (ped.down > 0) continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 54 + PED.radius) continue;
    const facing = Math.cos(player.angle) * dx + Math.sin(player.angle) * dy;
    if (facing < -6) continue;
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}
