// Cars: the factory, the parked cars that fill the lots, the traffic that drives the grid
// keeping right, and the driving physics for whichever car the player is sitting in.
// Traffic cars hold a route (one road, one direction) and pick a new one at intersections,
// which keeps them on the roads without any pathfinding. Everybody shares the same body
// step: accelerate along the heading, turn, move, then let the world push the car out of
// buildings and other cars.
import { CAR, COAST_Y, HEAT, HROADS, VROADS, WORLD } from './config.js';
import { collideCircle, isRoad, laneX, laneY, nearestRoadPoint } from './world.js';

export const CAR_COLORS = [
  '#d8d8d8', '#c23b2e', '#2e5fc2', '#3f9e4d', '#e0a81c', '#7a4fa3',
  '#22262b', '#e8e2d4', '#4fb3bf', '#b3541e', '#5b8c5a', '#c2c9d1',
];

let nextCarId = 1;

export function createCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++, x, y, angle, speed: 0, color, kind,
    w: CAR.width, l: CAR.length, radius: CAR.radius,
    route: null, blocked: 0, honk: 0, alarm: false, alarmT: 0,
    damage: 0, special: null, dead: false,
  };
}

/** Angle for a route direction: axis 'x' travels along horizontal roads, 'y' along vertical. */
function routeAngle(axis, dir) {
  return axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

/** A fresh route on the road nearest a point, heading a random way. */
function randomRoute(random, x, y) {
  const point = nearestRoadPoint(x, y);
  const onVertical = VROADS.includes(point.x);
  const axis = onVertical && Math.random() < 0.5 ? 'y' : (onVertical ? 'x' : 'y');
  // nearestRoadPoint snaps to whichever centre is closer; rebuild cleanly:
  if (axis === 'y') {
    const centre = VROADS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const dir = random() < 0.5 ? 1 : -1;
    return { axis, centre, dir, x: laneX(centre, dir), y: point.y };
  }
  const centres = [...HROADS, COAST_Y];
  const centre = centres.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  const dir = random() < 0.5 ? 1 : -1;
  return { axis, centre, dir, x: point.x, y: laneY(centre, dir) };
}

/** Parked cars in every lot (one is the story's yellow Gullwing), plus a few on wide streets. */
export function spawnParked(game, random) {
  const cars = [];
  for (const lot of game.world.lots) {
    const cols = Math.max(1, Math.floor(lot.w / 64));
    const rows = Math.max(1, Math.floor(lot.h / 96));
    const want = lot.special ? 2 : Math.min(CAR.parkedPerLot + Math.floor(random() * 2), cols * rows);
    const spots = [];
    for (let cx = 0; cx < cols; cx += 1) for (let cy = 0; cy < rows; cy += 1) spots.push([cx, cy]);
    for (let i = 0; i < want && spots.length > 0; i += 1) {
      const pick = spots.splice(Math.floor(random() * spots.length), 1)[0];
      const x = lot.x + 34 + pick[0] * 64;
      const y = lot.y + 46 + pick[1] * 96;
      const car = createCar(x, y, Math.PI / 2, CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], 'parked');
      cars.push(car);
      if (lot.special && i === 0) {
        car.color = '#f2c229';
        car.special = 'gullwing';
        car.angle = -Math.PI / 2;
        game.gullwing = car;
      }
    }
  }
  return cars;
}

/** The moving traffic: cars seeded across the grid, already rolling. */
export function spawnTraffic(game, random) {
  const cars = [];
  for (let i = 0; i < CAR.trafficCount; i += 1) {
    const x = 200 + random() * (WORLD.width - 400);
    const y = 200 + random() * 1700;
    const car = createCar(x, y, 0, CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], 'traffic');
    car.route = randomRoute(random, x, y);
    car.x = car.route.x;
    car.y = car.route.y;
    car.angle = routeAngle(car.route.axis, car.route.dir);
    car.speed = CAR.trafficSpeed * (0.75 + random() * 0.5);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

/** Is there something solid just ahead of this car that it should slow down for? */
function blockedAhead(game, car, distance) {
  const fx = car.x + Math.cos(car.angle) * distance;
  const fy = car.y + Math.sin(car.angle) * distance;
  const check = (other) => {
    if (other === car || other.dead) return false;
    const dx = other.x - fx;
    const dy = other.y - fy;
    return dx * dx + dy * dy < 46 * 46;
  };
  for (const other of game.traffic) if (check(other)) return true;
  for (const other of game.police) if (check(other)) return true;
  if (game.player.mode === 'car' && game.player.car && check(game.player.car)) return true;
  if (game.player.mode === 'foot') {
    const dx = game.player.x - fx;
    const dy = game.player.y - fy;
    if (dx * dx + dy * dy < 40 * 40) return true;
  }
  return false;
}

/** At an intersection, maybe turn onto the crossing road; returns true when the car turned. */
function maybeTurn(game, car, random) {
  const route = car.route;
  const crossings = route.axis === 'x' ? VROADS : [...HROADS, COAST_Y];
  const along = route.axis === 'x' ? car.x : car.y;
  for (const centre of crossings) {
    if (Math.abs(along - centre) > 8) continue;
    if (random() < 0.5) return false;
    const dir = random() < 0.5 ? 1 : -1;
    if (route.axis === 'x') {
      car.route = { axis: 'y', centre, dir };
      car.x = laneX(centre, dir);
    } else {
      car.route = { axis: 'x', centre, dir };
      car.y = laneY(centre, dir);
    }
    return true;
  }
  return false;
}

/** One step of traffic driving: follow the route, brake for company, turn at corners. */
export function updateTraffic(game, dt, random) {
  for (const car of game.traffic) {
    if (car.dead) continue;
    const route = car.route;
    const target = blockedAhead(game, car, 86) ? 0 : car.cruise;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 240 * dt);
    car.blocked = target === 0 && car.speed < 4 ? car.blocked + dt : 0;
    if (route.axis === 'x') car.x += route.dir * car.speed * dt;
    else car.y += route.dir * car.speed * dt;
    maybeTurn(game, car, random);
    car.angle = routeAngle(route.axis, route.dir);
    // Keep the car centred on its lane and inside the town; a car that leaves the grid
    // wraps to the far side so the town never empties.
    if (route.axis === 'x') car.y += (laneY(route.centre, route.dir) - car.y) * Math.min(1, dt * 4);
    else car.x += (laneX(route.centre, route.dir) - car.x) * Math.min(1, dt * 4);
    if (car.x < -80) car.x = WORLD.width + 60;
    if (car.x > WORLD.width + 80) car.x = -60;
    if (car.y < -80) car.y = COAST_Y + 40;
    if (car.y > COAST_Y + 80) car.y = -60;
    if (car.alarm) {
      car.alarmT -= dt;
      if (car.alarmT <= 0) car.alarm = false;
    }
  }
}

/**
 * The car the player drives: throttle/brake/reverse and steering from the held keys.
 * `controls` is {throttle: -1..1, steer: -1..1}. Returns crash events for sound and heat:
 * {hitCar, hitBuilding, impact} with impact the speed lost in the hardest knock.
 */
export function drivePlayerCar(game, car, controls, dt) {
  const events = { hitCar: null, hitBuilding: false, impact: 0 };
  if (controls.throttle > 0) {
    car.speed += CAR.accel * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (controls.throttle < 0) {
    car.speed -= (car.speed > 4 ? CAR.brake : CAR.reverseAccel) * dt;
  }
  car.speed -= car.speed * CAR.drag * dt * 0.35;
  if (!isRoad(car.x, car.y)) car.speed -= car.speed * dt * 0.9; // sand and grass drag
  car.speed = Math.min(CAR.maxForward, Math.max(-CAR.maxReverse, car.speed));
  if (Math.abs(car.speed) < 1.5 && controls.throttle === 0) car.speed = 0;

  const speedRatio = Math.min(1, Math.abs(car.speed) / 130);
  if (controls.steer !== 0 && car.speed !== 0) {
    car.angle += controls.steer * CAR.turnRate * speedRatio * dt * Math.sign(car.speed);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = collideCircle(game.world, nx, ny, car.radius);
  if (Math.abs(resolved.x - nx) > 0.6 || Math.abs(resolved.y - ny) > 0.6) {
    events.hitBuilding = true;
    events.impact = Math.abs(car.speed);
    car.speed *= 0.25;
    car.damage = Math.min(100, car.damage + Math.abs(events.impact) * 0.02);
  }
  car.x = resolved.x;
  car.y = resolved.y;

  // Bumping other cars: shove both apart, trade speed, remember the hardest knock.
  const others = [...game.traffic, ...game.police, ...game.parked];
  for (const other of others) {
    if (other.dead) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const rr = car.radius + other.radius - 6;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const push = (rr - d) / 2;
    car.x += (dx / d) * push;
    car.y += (dy / d) * push;
    if (other.kind !== 'parked') {
      other.x -= (dx / d) * push;
      other.y -= (dy / d) * push;
    }
    if (Math.abs(car.speed) > 60) {
      events.hitCar = other;
      events.impact = Math.max(events.impact, Math.abs(car.speed));
      if (other.kind === 'traffic') {
        game.addHeat(HEAT.hitCar, other.x, other.y);
        other.speed = Math.min(other.cruise ?? 0, 30);
      }
    }
    car.speed *= 0.55;
  }
  return events;
}

/** Cars the player is not driving still roll a touch when shoved; settle them back to rest. */
export function settleParked(game, dt) {
  for (const car of game.parked) {
    if (car.alarm) {
      car.alarmT -= dt;
      if (car.alarmT <= 0) car.alarm = false;
    }
  }
}
