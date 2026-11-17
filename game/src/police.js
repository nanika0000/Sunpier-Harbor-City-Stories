// The law: heat becomes stars, stars become patrol cars, and patrol cars become a bust.
// Heat is a single number the whole game feeds (theft alarms, collisions, witnesses);
// it cools when no officer is close enough to watch the player. Police drive a simple
// pursuit — steer at where the player will be, slide off buildings — and the bust meter
// fills while an officer is near a slow or on-foot player. Full meter: BUSTED.
import { HEAT, POLICE, WORLD, COAST_Y } from './config.js';
import { createCar } from './vehicles.js';
import { collideCircle, nearestRoadPoint } from './world.js';

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < HEAT.thresholds.length; i += 1) {
    if (heat >= HEAT.thresholds[i]) stars = i;
  }
  return stars;
}

/** Spawn one patrol car on a road, far from the player but inside the town. */
function spawnCop(game, random) {
  const player = game.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * POLICE.spawnDistance;
    const y = player.y + Math.sin(angle) * POLICE.spawnDistance;
    if (x < 60 || x > WORLD.width - 60 || y < 60 || y > COAST_Y + 30) continue;
    const point = nearestRoadPoint(x, y);
    const cop = createCar(point.x, point.y, angle, '#e8e8ea', 'police');
    cop.cruise = POLICE.baseSpeed;
    game.police.push(cop);
    return;
  }
}

/** Heat bookkeeping and the patrol population, once per step. */
export function updateWanted(game, dt, random) {
  const player = game.player;
  let watched = false;
  for (const cop of game.police) {
    const dx = cop.x - player.x;
    const dy = cop.y - player.y;
    if (dx * dx + dy * dy < POLICE.sight * POLICE.sight) { watched = true; break; }
  }
  if (!watched && game.time - game.lastCrime > 4) {
    game.heat = Math.max(0, game.heat - HEAT.decay * dt);
  }
  game.stars = starsForHeat(game.heat);

  const wanted = Math.min(8, game.stars * 2);
  if (game.police.length < wanted) {
    game.copTimer -= dt;
    if (game.copTimer <= 0) {
      spawnCop(game, random);
      game.copTimer = 1.4;
    }
  } else if (game.police.length > wanted) {
    // Too many for the current stars: the farthest quietly leaves the chase.
    let far = null;
    let farD = -1;
    for (const cop of game.police) {
      const d = (cop.x - player.x) ** 2 + (cop.y - player.y) ** 2;
      if (d > farD) { farD = d; far = cop; }
    }
    if (far && farD > 900 * 900) game.police.splice(game.police.indexOf(far), 1);
    else if (wanted === 0 && far) game.police.splice(game.police.indexOf(far), 1);
  }
  game.sirenOn = game.police.length > 0 && watched;
}

/** One step of pursuit for every patrol car, plus the bust meter. */
export function updatePolice(game, dt) {
  const player = game.player;
  const targetX = player.mode === 'car' && player.car ? player.car.x : player.x;
  const targetY = player.mode === 'car' && player.car ? player.car.y : player.y;
  const targetSpeed = player.mode === 'car' && player.car ? player.car.speed : 0;
  const maxSpeed = POLICE.baseSpeed + game.stars * POLICE.perStar;
  let nearAndSlow = false;

  for (const cop of game.police) {
    // Aim where the player is heading, not where they are.
    const lead = Math.min(0.7, Math.hypot(targetX - cop.x, targetY - cop.y) / 500);
    const aimX = targetX + Math.cos(player.angle) * targetSpeed * lead;
    const aimY = targetY + Math.sin(player.angle) * targetSpeed * lead;
    const desired = Math.atan2(aimY - cop.y, aimX - cop.x);
    let turn = desired - cop.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, turn));
    const dist = Math.hypot(targetX - cop.x, targetY - cop.y);
    const goal = dist < 60 ? 0 : maxSpeed;
    cop.speed += Math.sign(goal - cop.speed) * Math.min(Math.abs(goal - cop.speed), POLICE.accel * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const resolved = collideCircle(game.world, nx, ny, cop.radius);
    if (Math.abs(resolved.x - nx) > 0.8 || Math.abs(resolved.y - ny) > 0.8) cop.speed *= 0.3;
    cop.x = resolved.x;
    cop.y = resolved.y;

    // Shoving the player's car is fair game for the law.
    if (player.mode === 'car' && player.car) {
      const car = player.car;
      const dx = car.x - cop.x;
      const dy = car.y - cop.y;
      const rr = car.radius + cop.radius - 6;
      if (dx * dx + dy * dy < rr * rr && (dx || dy)) {
        const d = Math.hypot(dx, dy);
        car.x += (dx / d) * 3;
        car.y += (dy / d) * 3;
        if (Math.abs(cop.speed) > 120 && game.time - (game.lastRam ?? -9) > 0.9) {
          game.lastRam = game.time;
          game.hurtPlayer(4, 'A police car rammed you!');
        }
      }
    }

    const playerSpeed = player.mode === 'car' && player.car ? Math.abs(player.car.speed) : 0;
    if (dist < POLICE.bustRange && playerSpeed < 42) nearAndSlow = true;
  }

  if (nearAndSlow && game.stars > 0) {
    game.bust = Math.min(1, game.bust + dt / POLICE.bustSeconds);
    if (game.bust >= 1) game.onBusted();
  } else {
    game.bust = Math.max(0, game.bust - dt * 0.7);
  }
}
