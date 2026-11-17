// Drawing only: the game state in, pixels out. A camera follows the player over the
// 3840x2560 town; the visible slice is painted ground-first (pavement, parks, roads,
// beach, sea) then props, buildings, cars, people, and finally the HUD, the minimap and
// whichever screen overlay is up. Everything is flat shapes and canvas text — no images —
// but the town is dressed: roof clutter, shop names, crosswalks, trees, umbrellas, boats.
// Off-screen work is culled against the camera's rectangle, so a frame stays cheap.
import {
  BEACH, COAST_Y, FONT, HROADS, LIGHTHOUSE, PALETTE, PIER, ROAD_W, VROADS, WORLD,
} from './config.js';
import { currentTarget, nextGiver } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

/** World units visible vertically; the camera shows a 720-tall slice of the town. */
const VIEW_H = 720;
const MINIMAP = { w: 216, h: 144, pad: 14 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, w: 1280, h: 720 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.w = Math.round(window.innerWidth * ratio);
    view.h = Math.round(window.innerHeight * ratio);
    canvas.width = view.w;
    canvas.height = view.h;
    view.scale = view.h / VIEW_H;
  }
  window.addEventListener('resize', resize);
  resize();

  function font(size, bold = false) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', bold = false) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function wrap(value, maxChars) {
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---------- the town ----------

  function drawGround(game, rect) {
    const world = game.world;
    ctx.fillStyle = PALETTE.pavement;
    ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0, Math.min(rect.y1, BEACH.top) - rect.y0);
    // Pavement seams.
    ctx.strokeStyle = PALETTE.pavementLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(rect.x0 / 120) * 120; x < rect.x1; x += 120) { ctx.moveTo(x, rect.y0); ctx.lineTo(x, Math.min(rect.y1, BEACH.top)); }
    for (let y = Math.floor(rect.y0 / 120) * 120; y < Math.min(rect.y1, BEACH.top); y += 120) { ctx.moveTo(rect.x0, y); ctx.lineTo(rect.x1, y); }
    ctx.stroke();
    // Blocks: parks green, lots dark, landmark plots slightly warm.
    for (const block of world.blocks) {
      if (block.x > rect.x1 || block.x + block.w < rect.x0 || block.y > rect.y1 || block.y + block.h < rect.y0) continue;
      if (block.kind === 'park') {
        ctx.fillStyle = PALETTE.parkGrass;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = PALETTE.parkPath;
        ctx.fillRect(block.x, block.y + block.h / 2 - 9, block.w, 18);
        ctx.fillRect(block.x + block.w / 2 - 9, block.y, 18, block.h);
        if (block.pond) {
          ctx.fillStyle = PALETTE.waterLight;
          ctx.beginPath();
          ctx.arc(block.pond.x, block.pond.y, block.pond.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (block.kind === 'lot') {
        ctx.fillStyle = PALETTE.lotAsphalt;
        ctx.fillRect(block.x, block.y, block.w, block.h);
      } else if (block.kind === 'green') {
        ctx.fillStyle = PALETTE.parkGrassDark;
        ctx.fillRect(block.x, block.y, block.w, block.h);
      }
    }
    // Parking stripes.
    ctx.strokeStyle = PALETTE.lotLine;
    ctx.lineWidth = 3;
    for (const lot of world.lots) {
      if (lot.x > rect.x1 || lot.x + lot.w < rect.x0 || lot.y > rect.y1 || lot.y + lot.h < rect.y0) continue;
      ctx.beginPath();
      for (let x = lot.x + 34; x < lot.x + lot.w - 10; x += 64) { ctx.moveTo(x, lot.y + 8); ctx.lineTo(x, lot.y + 84); }
      ctx.stroke();
    }
    // Beach and sea.
    if (rect.y1 > BEACH.top) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(rect.x0, Math.max(rect.y0, BEACH.top), rect.x1 - rect.x0, Math.min(rect.y1, BEACH.water) - Math.max(rect.y0, BEACH.top));
      ctx.fillStyle = PALETTE.sandDark;
      for (let x = Math.floor(rect.x0 / 90) * 90; x < rect.x1; x += 90) {
        ctx.fillRect(x + 20, 2140 + ((x * 7) % 200), 26, 5);
      }
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(rect.x0, Math.max(rect.y0, BEACH.water), rect.x1 - rect.x0, rect.y1 - Math.max(rect.y0, BEACH.water));
      ctx.strokeStyle = PALETTE.waterLight;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const wave = Math.sin(game.time * 1.4) * 6;
      for (let x = Math.floor(rect.x0 / 130) * 130; x < rect.x1; x += 130) {
        ctx.moveTo(x, 2430 + ((x * 13) % 90) + wave);
        ctx.lineTo(x + 54, 2430 + ((x * 13) % 90) + wave);
      }
      ctx.stroke();
      // The pier and its lighthouse.
      ctx.fillStyle = PALETTE.pierWood;
      ctx.fillRect(PIER.x - PIER.halfWidth, PIER.from, PIER.halfWidth * 2, PIER.to - PIER.from);
      ctx.strokeStyle = shade(PALETTE.pierWood, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = PIER.from + 16; y < PIER.to; y += 32) { ctx.moveTo(PIER.x - PIER.halfWidth, y); ctx.lineTo(PIER.x + PIER.halfWidth, y); }
      ctx.stroke();
      for (const boat of world.boats) drawBoat(boat);
      for (const umb of world.umbrellas) {
        ctx.fillStyle = umb.color;
        ctx.beginPath();
        ctx.arc(umb.x, umb.y, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(umb.x, umb.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Lighthouse: concentric harbour rings with a lamp that breathes.
      const pulse = 0.55 + 0.45 * Math.sin(game.time * 2.2);
      ctx.fillStyle = `rgba(255, 217, 77, ${0.16 * pulse})`;
      ctx.beginPath();
      ctx.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, 74, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e6da';
      ctx.beginPath(); ctx.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, LIGHTHOUSE.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c23b2e';
      ctx.beginPath(); ctx.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, LIGHTHOUSE.r * 0.68, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8e6da';
      ctx.beginPath(); ctx.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, LIGHTHOUSE.r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, 9, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBoat(boat) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(3, 5, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(-32, 0); ctx.lineTo(-20, -11); ctx.lineTo(22, -11); ctx.lineTo(34, 0); ctx.lineTo(22, 11); ctx.lineTo(-20, 11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e6da';
    ctx.fillRect(-6, -6, 16, 12);
    ctx.restore();
  }

  function drawRoads(rect) {
    ctx.fillStyle = PALETTE.road;
    for (const vx of VROADS) ctx.fillRect(vx - ROAD_W / 2, Math.max(rect.y0, 0), ROAD_W, Math.min(rect.y1, COAST_Y + ROAD_W / 2));
    for (const hy of [...HROADS, COAST_Y]) ctx.fillRect(Math.max(rect.x0, 0), hy - ROAD_W / 2, Math.min(rect.x1, WORLD.width), ROAD_W);
    // Edge lines and centre dashes.
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const vx of VROADS) {
      ctx.moveTo(vx - ROAD_W / 2 + 4, Math.max(rect.y0, 0)); ctx.lineTo(vx - ROAD_W / 2 + 4, Math.min(rect.y1, COAST_Y + ROAD_W / 2));
      ctx.moveTo(vx + ROAD_W / 2 - 4, Math.max(rect.y0, 0)); ctx.lineTo(vx + ROAD_W / 2 - 4, Math.min(rect.y1, COAST_Y + ROAD_W / 2));
    }
    ctx.stroke();
    ctx.strokeStyle = PALETTE.laneDash;
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const vx of VROADS) { ctx.moveTo(vx, Math.max(rect.y0, 0)); ctx.lineTo(vx, Math.min(rect.y1, COAST_Y + ROAD_W / 2)); }
    for (const hy of [...HROADS, COAST_Y]) { ctx.moveTo(Math.max(rect.x0, 0), hy); ctx.lineTo(Math.min(rect.x1, WORLD.width), hy); }
    ctx.stroke();
    ctx.setLineDash([]);
    // Crosswalks at intersections.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const vx of VROADS) {
      for (const hy of [...HROADS, COAST_Y]) {
        if (vx + 80 < rect.x0 || vx - 80 > rect.x1 || hy + 80 < rect.y0 || hy - 80 > rect.y1) continue;
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(vx - ROAD_W / 2 - 14, hy + i * 22 - 5, 10, 12);
          ctx.fillRect(vx + ROAD_W / 2 + 4, hy + i * 22 - 5, 10, 12);
          ctx.fillRect(vx + i * 22 - 5, hy - ROAD_W / 2 - 14, 12, 10);
          ctx.fillRect(vx + i * 22 - 5, hy + ROAD_W / 2 + 4, 12, 10);
        }
      }
    }
  }

  function drawBuildings(game, rect) {
    for (const b of game.world.buildings) {
      if (b.x > rect.x1 || b.x + b.w < rect.x0 || b.y > rect.y1 || b.y + b.h < rect.y0) continue;
      ctx.fillStyle = 'rgba(10, 14, 18, 0.35)';
      ctx.fillRect(b.x + 9, b.y + 12, b.w, b.h);
      ctx.fillStyle = shade(b.roof, 0.72);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
      if (b.mural) {
        const bands = ['#e5534b', '#e8933a', '#f2c94c', '#5da24f', '#4a7fa5', '#8a6fb8'];
        const bandH = (b.h - 14) / bands.length;
        bands.forEach((color, i) => {
          ctx.fillStyle = color;
          ctx.fillRect(b.x + 7, b.y + 7 + i * bandH, b.w - 14, bandH);
        });
      }
      // Roof clutter: a water tank and air-conditioning boxes, placed by the building's seed.
      ctx.fillStyle = shade(b.roof, 0.6);
      if (b.tank) ctx.fillRect(b.x + b.w * 0.12, b.y + b.h * 0.14, 26, 26);
      for (let i = 0; i < b.acUnits; i += 1) {
        ctx.fillRect(b.x + b.w * (0.55 + i * 0.16), b.y + b.h * 0.62, 18, 14);
      }
      ctx.fillStyle = shade(b.roof, 1.12);
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.16, b.h * 0.14);
      if (b.name) {
        ctx.font = font(15, true);
        ctx.fillStyle = 'rgba(12, 16, 20, 0.62)';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    // Trees and lamps.
    for (const tree of game.world.trees) {
      if (tree.x < rect.x0 - 30 || tree.x > rect.x1 + 30 || tree.y < rect.y0 - 30 || tree.y > rect.y1 + 30) continue;
      ctx.fillStyle = 'rgba(10,14,18,0.25)';
      ctx.beginPath(); ctx.arc(tree.x + 4, tree.y + 6, tree.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath(); ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.25, tree.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PALETTE.lamp;
    for (const lamp of game.world.lamps) {
      if (lamp.x < rect.x0 || lamp.x > rect.x1 || lamp.y < rect.y0 || lamp.y > rect.y1) continue;
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawCar(car, game) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(8,10,12,0.4)';
    roundRect(ctx, -car.l / 2 + 4, -car.w / 2 + 6, car.l, car.w, 10);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.l / 2, -car.w / 2, car.l, car.w, 10);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#22262b';
      ctx.fillRect(-car.l * 0.18, -car.w / 2, car.l * 0.36, car.w);
      const flash = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? PALETTE.policeRed : '#5b7fff';
      ctx.fillRect(-9, -car.w / 2 + 3, 18, 7);
      ctx.fillStyle = flash ? '#5b7fff' : PALETTE.policeRed;
      ctx.fillRect(-9, car.w / 2 - 10, 18, 7);
    }
    // Cabin, glass and lights.
    ctx.fillStyle = 'rgba(16, 24, 34, 0.9)';
    roundRect(ctx, -car.l * 0.16, -car.w / 2 + 5, car.l * 0.34, car.w - 10, 6);
    ctx.fill();
    ctx.fillStyle = shade(car.color, 0.82);
    roundRect(ctx, -car.l * 0.42, -car.w / 2 + 6, car.l * 0.2, car.w - 12, 5);
    ctx.fill();
    ctx.fillStyle = '#fdf6c8';
    ctx.fillRect(car.l / 2 - 4, -car.w / 2 + 4, 4, 8);
    ctx.fillRect(car.l / 2 - 4, car.w / 2 - 12, 4, 8);
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(-car.l / 2, -car.w / 2 + 4, 4, 8);
    ctx.fillRect(-car.l / 2, car.w / 2 - 12, 4, 8);
    if (car.special === 'gullwing') {
      ctx.strokeStyle = 'rgba(120, 84, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-car.l * 0.1, -car.w / 2 + 2); ctx.lineTo(car.l * 0.12, 0); ctx.lineTo(-car.l * 0.1, car.w / 2 - 2);
      ctx.stroke();
    }
    ctx.restore();
    if (car.alarm) {
      const pulse = 0.5 + 0.5 * Math.sin(game.time * 14);
      ctx.strokeStyle = `rgba(255, 170, 40, ${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(car.x, car.y, car.radius + 8 + pulse * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (car.damage > 55) {
      ctx.fillStyle = 'rgba(90, 90, 90, 0.35)';
      ctx.beginPath();
      ctx.arc(car.x + Math.cos(car.angle) * 26, car.y + Math.sin(car.angle) * 26, 8 + (car.damage - 55) * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped, game) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.globalAlpha = 0.75;
    }
    ctx.fillStyle = 'rgba(8,10,12,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    const stride = Math.sin(ped.walkPhase) * 3;
    ctx.fillStyle = '#2c3138';
    ctx.fillRect(-6 + stride * 0.4, 2, 5, 8);
    ctx.fillRect(2 - stride * 0.4, 2, 5, 8);
    ctx.fillStyle = ped.clothes;
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 2.5, Math.sin(ped.angle) * 2.5, 5.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayer(game) {
    const player = game.player;
    if (player.mode === 'car') return; // the car itself is drawn with the traffic
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(8,10,12,0.35)';
    ctx.beginPath(); ctx.ellipse(2, 5, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    const stride = Math.sin(player.walkPhase) * 3.4;
    ctx.fillStyle = '#23272e';
    ctx.fillRect(-6 + stride * 0.4, 2, 5, 9);
    ctx.fillRect(2 - stride * 0.4, 2, 5, 9);
    ctx.fillStyle = '#1f8a8a';
    ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.fill();
    if (player.punchT > 0) {
      const reach = (0.35 - player.punchT) / 0.35;
      ctx.strokeStyle = '#e8b98d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(player.angle) * 6, Math.sin(player.angle) * 6);
      ctx.lineTo(Math.cos(player.angle) * (12 + reach * 22), Math.sin(player.angle) * (12 + reach * 22));
      ctx.stroke();
    }
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath(); ctx.arc(Math.cos(player.angle) * 2.5, Math.sin(player.angle) * 2.5, 5.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c229';
    ctx.beginPath(); ctx.arc(Math.cos(player.angle) * 1.5, Math.sin(player.angle) * 1.5, 6.2, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.restore();
  }

  function drawBeacon(game, target) {
    if (!target) return;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 4);
    const grad = ctx.createLinearGradient(0, target.y - 320, 0, target.y);
    grad.addColorStop(0, 'rgba(255, 217, 77, 0)');
    grad.addColorStop(1, 'rgba(255, 217, 77, 0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 13, target.y - 320, 26, 320);
    ctx.strokeStyle = `rgba(255, 217, 77, ${0.65 + 0.35 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, 30 + pulse * 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(target.x, target.y, 7, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- screen space: HUD, minimap, dialogue, overlays ----------

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
  }

  function drawStars(game, cx, y) {
    for (let i = 0; i < 5; i += 1) {
      const x = cx + (i - 2) * 34;
      ctx.font = font(30, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = i < game.stars ? PALETTE.gold : 'rgba(240, 244, 248, 0.22)';
      ctx.fillText('★', x, y);
    }
    if (game.bust > 0.02) {
      const w = 190;
      ctx.fillStyle = 'rgba(10, 14, 20, 0.75)';
      roundRect(ctx, cx - w / 2, y + 12, w, 16, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.danger;
      roundRect(ctx, cx - w / 2 + 2, y + 14, (w - 4) * game.bust, 12, 6);
      ctx.fill();
      text('BUSTED…', cx, y + 48, 15, PALETTE.danger, 'center', true);
    }
  }

  function drawHud(game) {
    const w = view.w / (window.devicePixelRatio || 1);
    const mission = game.mission;
    const panelH = !mission ? 74 : mission.state === 'run' ? 178 : 106;
    panel(14, 14, 252, panelH);
    text(`$${game.cash}`, 30, 48, 27, PALETTE.cash, 'left', true);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, 30, 58, 150, 11, 5);
    ctx.fill();
    ctx.fillStyle = game.player.hp > 30 ? '#7fc95e' : PALETTE.danger;
    roundRect(ctx, 30, 58, 150 * Math.max(0, game.player.hp) / 100, 11, 5);
    ctx.fill();
    text('HP', 190, 69, 13, PALETTE.muted, 'left', true);
    if (game.mission) {
      const mission = game.mission;
      text(mission.def.title, 30, 92, 14.5, PALETTE.gold, 'left', true);
      if (mission.state === 'run') {
        const stage = mission.def.stages[mission.stage];
        const lines = wrap(stage.label, 34).slice(0, 2);
        lines.forEach((line, i) => text(line, 30, 112 + i * 17, 13.5, PALETTE.text));
        const frac = Math.max(0, mission.timer / mission.def.time);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        roundRect(ctx, 30, 116 + lines.length * 17, 220, 8, 4);
        ctx.fill();
        ctx.fillStyle = frac > 0.25 ? PALETTE.gold : PALETTE.danger;
        roundRect(ctx, 30, 116 + lines.length * 17, 220 * frac, 8, 4);
        ctx.fill();
      }
    }
    drawStars(game, w / 2, 38);
    if (game.player.mode === 'car' && game.player.car) {
      const kmh = Math.round(Math.abs(game.player.car.speed) * 0.42);
      text(`${kmh} km/h`, w - 26, view.h / (window.devicePixelRatio || 1) - 24, 24, PALETTE.text, 'right', true);
      if (game.player.car === game.gullwing) text('THE GULLWING', w - 26, view.h / (window.devicePixelRatio || 1) - 52, 13, PALETTE.gold, 'right', true);
    }
    text('WASD move · E enter / steal · F punch · P pause', 16, view.h / (window.devicePixelRatio || 1) - 16, 12.5, 'rgba(230,236,242,0.55)');
  }

  function drawMinimap(game) {
    const ratio = window.devicePixelRatio || 1;
    const w = view.w / ratio;
    const x0 = w - MINIMAP.w - MINIMAP.pad;
    const y0 = MINIMAP.pad;
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    ctx.save();
    panel(x0 - 6, y0 - 6, MINIMAP.w + 12, MINIMAP.h + 12);
    ctx.beginPath();
    ctx.rect(x0, y0, MINIMAP.w, MINIMAP.h);
    ctx.clip();
    ctx.fillStyle = '#274b63';
    ctx.fillRect(x0, y0, MINIMAP.w, MINIMAP.h);
    ctx.fillStyle = '#6d747a';
    ctx.fillRect(x0, y0, MINIMAP.w, BEACH.top * sy);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, y0 + BEACH.top * sy, MINIMAP.w, (BEACH.water - BEACH.top) * sy);
    ctx.strokeStyle = 'rgba(240,244,248,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const vx of VROADS) { ctx.moveTo(x0 + vx * sx, y0); ctx.lineTo(x0 + vx * sx, y0 + COAST_Y * sy); }
    for (const hy of [...HROADS, COAST_Y]) { ctx.moveTo(x0, y0 + hy * sy); ctx.lineTo(x0 + MINIMAP.w, y0 + hy * sy); }
    ctx.stroke();
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
    };
    const target = currentTarget(game) ?? nextGiver(game);
    if (target) {
      const pulse = 2.6 + Math.sin(game.time * 5) * 0.9;
      dot(target.x, target.y, PALETTE.gold, pulse + 1.6);
      dot(target.x, target.y, '#7a5c00', 1.8);
    }
    for (const cop of game.police) dot(cop.x, cop.y, Math.floor(game.time * 4) % 2 ? '#5b7fff' : '#ff7a6e', 2.6);
    const p = game.player.mode === 'car' && game.player.car ? game.player.car : game.player;
    dot(p.x, p.y, '#ffffff', 3.2);
    ctx.restore();
  }

  function drawOffscreenArrow(game, target) {
    if (!target) return;
    const ratio = window.devicePixelRatio || 1;
    const w = view.w / ratio;
    const h = view.h / ratio;
    const cam = game.camera;
    const dx = target.x - cam.x;
    const dy = target.y - cam.y;
    const sx = dx * view.scale / ratio + w / 2;
    const sy = dy * view.scale / ratio + h / 2;
    if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) return;
    const angle = Math.atan2(dy, dx);
    const ax = Math.min(w - 44, Math.max(44, sx));
    const ay = Math.min(h - 60, Math.max(70, sy));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(17, 0); ctx.lineTo(-9, -10); ctx.lineTo(-9, 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    const dist = Math.round(Math.hypot(dx, dy) / 10);
    text(`${dist}m`, ax, ay + 26, 13, PALETTE.gold, 'center', true);
  }

  function drawDialogue(game) {
    const dialogue = game.dialogue;
    if (!dialogue) return;
    const ratio = window.devicePixelRatio || 1;
    const w = view.w / ratio;
    const h = view.h / ratio;
    const boxW = Math.min(760, w - 48);
    const x = (w - boxW) / 2;
    const y = h - 128;
    panel(x, y, boxW, 106);
    const line = dialogue.lines[dialogue.i];
    text(line.who, x + 22, y + 32, 15, PALETTE.gold, 'left', true);
    wrap(line.text, 62).slice(0, 2).forEach((l, i) => text(l, x + 22, y + 58 + i * 21, 16.5, PALETTE.text));
    if (Math.floor(game.time * 2) % 2 === 0) text('Enter ▸', x + boxW - 22, y + 88, 13, PALETTE.muted, 'right');
  }

  function drawToast(game) {
    if (!game.toastMsg || game.time > game.toastMsg.until) return;
    const ratio = window.devicePixelRatio || 1;
    const w = view.w / ratio;
    const remain = game.toastMsg.until - game.time;
    ctx.globalAlpha = Math.min(1, remain / 0.6);
    const tw = ctx.measureText(game.toastMsg.text).width;
    panel(w / 2 - tw / 2 - 34, 64, tw + 68, 40);
    text(game.toastMsg.text, w / 2, 91, 16.5, PALETTE.text, 'center', true);
    ctx.globalAlpha = 1;
  }

  function overlay(game, title, titleColor, lines, prompt) {
    const ratio = window.devicePixelRatio || 1;
    const w = view.w / ratio;
    const h = view.h / ratio;
    ctx.fillStyle = 'rgba(8, 12, 18, 0.62)';
    ctx.fillRect(0, 0, w, h);
    text(title, w / 2, h * 0.36, 64, titleColor, 'center', true);
    lines.forEach((line, i) => text(line, w / 2, h * 0.36 + 52 + i * 26, 18, PALETTE.text, 'center'));
    if (prompt) text(prompt, w / 2, h * 0.36 + 62 + lines.length * 26, 17, PALETTE.gold, 'center', true);
  }

  function drawTitle(game) {
    const ratio = window.devicePixelRatio || 1;
    const w = view.w / ratio;
    const h = view.h / ratio;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(8, 14, 22, 0.78)');
    grad.addColorStop(0.55, 'rgba(8, 14, 22, 0.25)');
    grad.addColorStop(1, 'rgba(8, 14, 22, 0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    text('S U N P I E R', w / 2, h * 0.30, 84, PALETTE.gold, 'center', true);
    text('HARBOR CITY STORIES', w / 2, h * 0.30 + 52, 26, PALETTE.text, 'center', true);
    text('Deliver noodles. Run errands. Steal one (1) car. Outrun the pier watch.', w / 2, h * 0.30 + 96, 17, PALETTE.muted, 'center');
    const save = game.saveData;
    const prompts = ['Enter — start a new story'];
    if (save) prompts.push(`C — continue: chapter ${Math.min(5, save.missionIndex + 1)} · $${save.cash}`);
    prompts.push('WASD / arrows to move · E to enter or steal a car · F to punch · P to pause');
    prompts.forEach((line, i) => text(line, w / 2, h * 0.62 + i * 28, 17, i === 0 ? PALETTE.gold : PALETTE.text, 'center', i === 0));
  }

  /** Paint one frame of the whole game. */
  function draw(game) {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, view.w, view.h);
    const cam = game.camera;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.w / 2 - cam.x * view.scale, view.h / 2 - cam.y * view.scale);
    const rect = {
      x0: cam.x - view.w / view.scale / 2 - 90,
      y0: cam.y - view.h / view.scale / 2 - 90,
      x1: cam.x + view.w / view.scale / 2 + 90,
      y1: cam.y + view.h / view.scale / 2 + 90,
    };
    drawGround(game, rect);
    drawRoads(rect);
    drawBuildings(game, rect);
    const target = currentTarget(game) ?? (game.screen === SCREEN_PLAY ? nextGiver(game) : null);
    drawBeacon(game, target);
    for (const car of game.parked) drawCar(car, game);
    for (const ped of game.peds) drawPed(ped, game);
    for (const car of game.traffic) drawCar(car, game);
    for (const car of game.police) drawCar(car, game);
    if (game.player.mode === 'car' && game.player.car) drawCar(game.player.car, game);
    drawPlayer(game);

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (game.screen !== SCREEN_TITLE) {
      drawHud(game);
      drawMinimap(game);
      drawOffscreenArrow(game, target);
    }
    drawToast(game);
    drawDialogue(game);
    if (game.screen === SCREEN_TITLE) drawTitle(game);
    else if (game.screen === SCREEN_PAUSED) overlay(game, 'PAUSED', PALETTE.text, ['The harbour waits for no one. Except now.'], 'Press P to resume');
    else if (game.screen === SCREEN_BUSTED) overlay(game, 'BUSTED', PALETTE.danger, [`The pier watch takes $${game.lastFine} for its trouble.`, 'You wake up outside Sunpier Clinic.'], 'Press Enter to continue');
    else if (game.screen === SCREEN_WASTED) overlay(game, 'WASTED', PALETTE.danger, [`The clinic patches you up and bills $${game.lastFine}.`, 'The town, as ever, keeps moving.'], 'Press Enter to continue');
    else if (game.screen === SCREEN_COMPLETE) overlay(game, 'STORY COMPLETE', PALETTE.gold, ['Five chapters, one harbour, zero regrets (some regrets).', `Final cash: $${game.cash} · Sunpier is yours to roam.`], 'Press Enter to keep roaming');
  }

  return { draw };
}
