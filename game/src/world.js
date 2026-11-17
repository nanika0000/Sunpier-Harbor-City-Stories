// The town itself: deterministic generation of blocks, buildings, parks, parking lots,
// trees and landmarks from a seeded random, plus the road geometry every other system
// navigates by, and circle collision against buildings and the sea.
//
// Layout: vertical and horizontal roads (see config) cut the town into block regions.
// Each region becomes buildings, a park or a parking lot, except the handful reserved for
// landmarks. The coast road runs along the beach; a pier reaches south to the lighthouse.
import {
  BEACH, COAST_Y, HROADS, LIGHTHOUSE, LANE, PIER, ROAD_W, ROOF_COLORS, SHOP_NAMES, VROADS, WORLD,
} from './config.js';

const HALF = ROAD_W / 2;

/** Block regions: the rectangles between road spans, as [left, right] and [top, bottom]. */
function regionSpans(centers, limit) {
  const spans = [];
  let edge = 0;
  for (const centre of centers) {
    spans.push([edge, centre - HALF]);
    edge = centre + HALF;
  }
  spans.push([edge, limit]);
  return spans;
}

export const XREGIONS = regionSpans(VROADS, WORLD.width);
export const YREGIONS = regionSpans(HROADS, COAST_Y - HALF);

/** Fixed places the story and the systems point at. Filled in by generateWorld. */
export const LANDMARK_KEYS = ['noodle', 'clinic', 'warehouse', 'mural', 'hideout', 'gullwingLot'];

function isRoadX(x) {
  for (const centre of VROADS) if (Math.abs(x - centre) <= HALF) return true;
  return false;
}

function isRoadY(y) {
  for (const centre of HROADS) if (Math.abs(y - centre) <= HALF) return true;
  return Math.abs(y - COAST_Y) <= HALF;
}

/** True when the point lies on any road (the beach and the pier count as ground, not road). */
export function isRoad(x, y) {
  if (y > COAST_Y + HALF) return false;
  return isRoadX(x) || isRoadY(y);
}

/** True when the point is on the pier deck. */
export function onPier(x, y) {
  return Math.abs(x - PIER.x) <= PIER.halfWidth && y >= PIER.from && y <= PIER.to;
}

/** True when the point is dry ground: town, beach or pier — anywhere but open sea. */
export function onLand(x, y) {
  if (y < BEACH.water) return true;
  return onPier(x, y);
}

/** The lane centre for travelling along a vertical road in direction dir (+1 south, -1 north). */
export function laneX(roadCentre, dir) {
  return roadCentre - dir * LANE;
}

/** The lane centre for travelling along a horizontal road in direction dir (+1 east, -1 west). */
export function laneY(roadCentre, dir) {
  return roadCentre + dir * LANE;
}

/** Intersections: every crossing of a vertical and a horizontal (or coast) road centre. */
export function intersections() {
  const points = [];
  for (const x of VROADS) {
    for (const y of HROADS) points.push({ x, y });
    points.push({ x, y: COAST_Y });
  }
  return points;
}

/** Snap a point to the nearest road centre point, for spawns that must start on a road. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const vx of VROADS) {
    const d = Math.abs(x - vx);
    if (d < bestDist) { bestDist = d; best = { x: vx, y }; }
  }
  for (const hy of [...HROADS, COAST_Y]) {
    const d = Math.abs(y - hy);
    if (d < bestDist) { bestDist = d; best = { x, y: hy }; }
  }
  best.x = Math.min(WORLD.width - 40, Math.max(40, best.x));
  best.y = Math.min(COAST_Y, Math.max(40, best.y));
  return best;
}

let shopIndex = 0;

function makeBuilding(random, x, y, w, h, name, roof) {
  return {
    x, y, w, h,
    name: name ?? null,
    roof: roof ?? ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)],
    trim: Math.floor(random() * 4),
    tank: random() < 0.4,
    acUnits: Math.floor(random() * 3),
    seed: random(),
  };
}

/**
 * Fill one block region. Landmarks are placed by the caller through `special`; otherwise the
 * region's hash picks a park, a parking lot, or one-to-four buildings with alleys between.
 */
function fillRegion(world, random, rx, ry, special) {
  const [x0, x1] = rx;
  const [y0, y1] = ry;
  const w = x1 - x0;
  const h = y1 - y0;
  const block = { x: x0, y: y0, w, h, kind: 'buildings' };
  world.blocks.push(block);
  const inset = 16;
  const ix = x0 + inset;
  const iy = y0 + inset;
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  if (iw < 60 || ih < 60) { block.kind = 'green'; return; }

  if (special) {
    block.kind = 'landmark';
    special(world, ix, iy, iw, ih);
    return;
  }

  const roll = random();
  if (roll < 0.16) {
    block.kind = 'park';
    // Winding path cross and a pond in some parks: pure decoration, kept off the paths.
    block.pond = random() < 0.45 ? { x: ix + iw * (0.25 + random() * 0.4), y: iy + ih * (0.25 + random() * 0.4), r: 26 + random() * 20 } : null;
    const trees = 4 + Math.floor(random() * 5);
    for (let i = 0; i < trees; i += 1) {
      world.trees.push({ x: ix + random() * iw, y: iy + random() * ih, r: 13 + random() * 9 });
    }
    return;
  }
  if (roll < 0.30) {
    block.kind = 'lot';
    world.lots.push({ x: ix, y: iy, w: iw, h: ih });
    return;
  }

  // Buildings: split wider regions into two columns or two rows, with a named shop often
  // enough that the town reads as lived-in from the screenshot distance.
  const named = () => (random() < 0.55 ? SHOP_NAMES[shopIndex++ % SHOP_NAMES.length] : null);
  if (iw > 240 && random() < 0.7) {
    const gap = 26;
    const each = (iw - gap) / 2;
    world.buildings.push(makeBuilding(random, ix, iy, each, ih, named()));
    world.buildings.push(makeBuilding(random, ix + each + gap, iy, each, ih, named()));
  } else if (ih > 240 && random() < 0.6) {
    const gap = 26;
    const each = (ih - gap) / 2;
    world.buildings.push(makeBuilding(random, ix, iy, iw, each, named()));
    world.buildings.push(makeBuilding(random, ix, iy + each + gap, iw, each, named()));
  } else {
    world.buildings.push(makeBuilding(random, ix, iy, iw, ih, named()));
  }
}

/** Landmark builders: each reserves its region and records its public points in world.landmarks. */
const SPECIALS = {
  noodle(world, random) {
    return (w, ix, iy, iw, ih) => {
      w.buildings.push(makeBuilding(random, ix, iy, 210, 150, "ROSA'S NOODLES", '#d96f4a'));
      w.buildings.push(makeBuilding(random, ix + 240, iy + 40, iw - 240, ih - 40, 'TEA HOUSE UMI', '#7fa6a3'));
      w.landmarks.noodle = { x: ix + 105, y: iy + 150, doorX: ix + 105, doorY: iy + 178, name: "Rosa's Noodles" };
    };
  },
  clinic(world, random) {
    return (w, ix, iy, iw, ih) => {
      w.buildings.push(makeBuilding(random, ix + 20, iy, 230, 160, 'SUNPIER CLINIC', '#e8e6da'));
      w.landmarks.clinic = { x: ix + 135, y: iy + 160, doorX: ix + 135, doorY: iy + 190, name: 'Sunpier Clinic' };
    };
  },
  warehouse(world, random) {
    return (w, ix, iy, iw, ih) => {
      w.buildings.push(makeBuilding(random, ix, iy + 10, iw - 10, ih - 30, 'PIER 9 WAREHOUSE', '#8a8f96'));
      w.landmarks.warehouse = { x: ix + iw / 2, y: iy + ih - 20, doorX: ix + iw / 2, doorY: iy + ih - 4, name: 'Pier 9 Warehouse' };
    };
  },
  mural(world, random) {
    return (w, ix, iy, iw, ih) => {
      // A long low wall, painted end to end: the town's famous mural.
      w.buildings.push({ ...makeBuilding(random, ix, iy + 30, iw, 54, 'THE HARBOR WALL', '#4a7fa5'), mural: true });
      w.buildings.push(makeBuilding(random, ix + 30, iy + 130, iw - 60, ih - 150, 'PAINT SUPPLY', '#c4cbd4'));
      w.landmarks.mural = { x: ix + iw / 2, y: iy + 84, doorX: ix + iw / 2, doorY: iy + 112, name: 'The Harbor Wall' };
    };
  },
  hideout(world, random) {
    return (w, ix, iy, iw, ih) => {
      w.buildings.push(makeBuilding(random, ix + 10, iy + 20, 250, 170, 'SOL GARAGE', '#6f8fb4'));
      w.landmarks.hideout = { x: ix + 135, y: iy + 190, doorX: ix + 135, doorY: iy + 218, name: 'Sol Garage (hideout)' };
    };
  },
  gullwingLot(world, random) {
    return (w, ix, iy, iw, ih) => {
      w.lots.push({ x: ix, y: iy, w: iw, h: ih, special: true });
      w.landmarks.gullwingLot = { x: ix + iw / 2, y: iy + ih / 2, doorX: ix + iw / 2, doorY: iy + ih / 2, name: 'Marina Parking' };
    };
  },
};

/** Which region (by XREGIONS/YREGIONS index) hosts which landmark. */
const SPECIAL_MAP = {
  '1,1': 'noodle',
  '7,1': 'clinic',
  '1,3': 'warehouse',
  '3,2': 'mural',
  '6,3': 'hideout',
  '4,2': 'gullwingLot',
};

export function generateWorld(random) {
  shopIndex = 0;
  const world = {
    buildings: [], blocks: [], lots: [], trees: [], lamps: [], boats: [], umbrellas: [],
    landmarks: {},
  };
  for (let xi = 0; xi < XREGIONS.length; xi += 1) {
    for (let yi = 0; yi < YREGIONS.length; yi += 1) {
      const key = `${xi},${yi}`;
      const specialName = SPECIAL_MAP[key];
      const special = specialName ? SPECIALS[specialName](world, random) : null;
      fillRegion(world, random, XREGIONS[xi], YREGIONS[yi], special ? (w, ix, iy, iw, ih) => special(w, ix, iy, iw, ih) : null);
    }
  }

  // Street trees along the sidewalks: a dotted green rhythm the screenshots read as a town.
  for (const vx of VROADS) {
    for (let y = 90; y < COAST_Y - 60; y += 118) {
      if (isRoadY(y)) continue;
      world.trees.push({ x: vx - HALF - 22, y: y + (random() * 30 - 15), r: 11 + random() * 5 });
      world.trees.push({ x: vx + HALF + 22, y: y + (random() * 30 - 15), r: 11 + random() * 5 });
    }
  }
  // Lamps at intersections.
  for (const point of intersections()) {
    world.lamps.push({ x: point.x - HALF - 10, y: point.y - HALF - 10 });
    world.lamps.push({ x: point.x + HALF + 10, y: point.y + HALF + 10 });
  }
  // Beach dressing: umbrellas on the sand, boats rocking in the shallows.
  for (let i = 0; i < 16; i += 1) {
    world.umbrellas.push({ x: 200 + random() * (WORLD.width - 400), y: 2160 + random() * 190, color: ROOF_COLORS[i % ROOF_COLORS.length] });
  }
  for (let i = 0; i < 7; i += 1) {
    world.boats.push({ x: 300 + i * 480 + random() * 160, y: 2445 + random() * 70, angle: random() * 0.6 - 0.3, color: ROOF_COLORS[(i * 3) % ROOF_COLORS.length] });
  }
  world.landmarks.lighthouse = { x: LIGHTHOUSE.x, y: LIGHTHOUSE.y, doorX: LIGHTHOUSE.x, doorY: LIGHTHOUSE.y - 62, name: 'Sunpier Lighthouse' };
  return world;
}

/**
 * Push a circle (centre + radius) out of every building and out of the sea. Returns the
 * corrected centre; callers keep their own velocity, so sliding along walls comes free.
 */
export function collideCircle(world, x, y, r) {
  for (const b of world.buildings) {
    const nx = Math.min(b.x + b.w, Math.max(b.x, x));
    const ny = Math.min(b.y + b.h, Math.max(b.y, y));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
    } else {
      // Centre inside the box: leave by the shortest side.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = b.x - r;
      else if (min === right) x = b.x + b.w + r;
      else if (min === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  // The sea is a wall, except along the pier deck.
  if (y > BEACH.water - r && !onPier(x, Math.min(y, PIER.to))) {
    y = BEACH.water - r;
  }
  x = Math.min(WORLD.width - r, Math.max(r, x));
  y = Math.min(WORLD.height - r, Math.max(r, y));
  return { x, y };
}

/** True when a circle at (x, y) overlaps any building (for spawn checks). */
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}
