// Sunpier: Harbor City Stories — every tuning number, colour and fixed place in one file.
// The world is a top-down harbour town of 3840x2560 world pixels. Roads sit on a regular
// grid; the blocks between them hold buildings, parks and parking lots. South of the coast
// road lie the beach, the pier and the lighthouse. Nothing here depends on the screen size:
// the renderer keeps a camera over the world and scales it to the window.

export const WORLD = { width: 3840, height: 2560 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Vertical road centre lines (x) and horizontal ones (y), with the coast road last in HY. */
export const VROADS = [240, 720, 1200, 1680, 2160, 2640, 3120, 3600];
export const HROADS = [240, 720, 1200, 1680];
export const COAST_Y = 2040;
export const ROAD_W = 120;
/** Lane offset from a road's centre line: traffic keeps right, so the offset flips with direction. */
export const LANE = 30;

/** The beach band and the sea below it; the pier reaches into the sea at PIER.x. */
export const BEACH = { top: 2100, water: 2400 };
export const PIER = { x: 3360, halfWidth: 55, from: 2090, to: 2490 };
export const LIGHTHOUSE = { x: 3360, y: 2452, r: 34 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 215,
  runSpeed: 305,
  maxHp: 100,
  punchRange: 54,
  punchCooldown: 0.35,
  enterRange: 64,
};

export const CAR = {
  length: 78,
  width: 38,
  radius: 30,
  accel: 265,
  brake: 520,
  reverseAccel: 180,
  maxForward: 432,
  maxReverse: 138,
  drag: 0.55,
  turnRate: 2.25,
  trafficSpeed: 132,
  trafficCount: 15,
  parkedPerLot: 3,
};

export const POLICE = {
  accel: 305,
  baseSpeed: 296,
  perStar: 23,
  sight: 460,
  bustRange: 138,
  bustSeconds: 2.3,
  spawnDistance: 760,
};

/** Heat points for crimes, and the heat at which each wanted star lights up (index = stars). */
export const HEAT = {
  theftAlarm: 35,
  theftQuiet: 6,
  hitPed: 45,
  punchPed: 18,
  hitCar: 8,
  hitProp: 3,
  decay: 2.1,
  thresholds: [0, 12, 38, 75, 120, 175],
};

export const PED = { count: 26, walkSpeed: 62, fleeSpeed: 168, radius: 12 };

export const SAVE_KEY = 'sunpier.save.v1';

export const PALETTE = {
  backdrop: '#0d1520',
  pavement: '#8f979e',
  pavementLine: '#7d858c',
  parkGrass: '#5da24f',
  parkGrassDark: '#4c8a41',
  parkPath: '#cbb98d',
  lotAsphalt: '#565b61',
  lotLine: '#d8d8ce',
  road: '#33373d',
  roadEdge: '#e8e6da',
  laneDash: '#d9b84a',
  crosswalk: '#cfd2cd',
  sand: '#e6cf9a',
  sandDark: '#d9bf83',
  water: '#2e6f9e',
  waterLight: '#3d84b5',
  pierWood: '#9a7350',
  tree: '#3e7d34',
  treeDark: '#2f6128',
  lamp: '#f4e3ac',
  beacon: '#ffd94d',
  text: '#f2f4f6',
  muted: '#aeb8c2',
  panel: 'rgba(13, 20, 30, 0.95)',
  panelEdge: '#3d4c5e',
  cash: '#8fe388',
  danger: '#ff6b5e',
  gold: '#ffd94d',
  policeBlue: '#2b4bd8',
  policeRed: '#e83a30',
};

/** Roof colours cycled through the town's ordinary buildings: sun-bleached harbour pastels. */
export const ROOF_COLORS = [
  '#c96f4a', '#d9a05b', '#b7bfae', '#7fa6a3', '#c4cbd4', '#a8b8d8',
  '#d98c8c', '#8a9a5b', '#e0cfa3', '#9c7fb8', '#6f8fb4', '#cf7956',
];

/** Names painted on ordinary buildings, so the town reads as a place, not a grid. */
export const SHOP_NAMES = [
  'CAFE LUMEN', 'BAKERY SOL', 'HOTEL MARINA', 'BOOKS & CO', 'PHARMACY', 'GYM PIER 9',
  'SUSHI UMI', 'BAR LUNA', 'FLORIST MIO', 'ARCADE WAVE', 'LAUNDRY', 'DINER 8',
  'MARKET SOL', 'TAILOR REN', 'PIZZA PORTO', 'BARBER KAI', 'TOYS UMI', 'RAMEN YA',
  'HOTEL BRISA', 'CAFE NORTE', 'BIKES SOL', 'PAWN & CO', 'OPTICS', 'DELI MAR',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
