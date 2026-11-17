// Keyboard input for a top-down town: held keys steer and drive, one-shot presses
// (interact, punch, pause, confirm) are queued and taken once by the loop, so a press
// between two frames is never lost and never counted twice. Mouse clicks count as
// confirm, for the title and end screens. Nothing here knows what the keys mean beyond
// their names — main.js maps them to the game.

export const PRESS_CONFIRM = 'confirm';
export const PRESS_INTERACT = 'interact';
export const PRESS_PUNCH = 'punch';
export const PRESS_PAUSE = 'pause';
export const PRESS_CONTINUE = 'continue';

const HELD_CODES = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'ShiftRight',
]);

const PRESS_CODES = new Map([
  ['Enter', PRESS_CONFIRM],
  ['Space', PRESS_CONFIRM],
  ['KeyE', PRESS_INTERACT],
  ['KeyF', PRESS_PUNCH],
  ['KeyP', PRESS_PAUSE],
  ['Escape', PRESS_PAUSE],
  ['KeyC', PRESS_CONTINUE],
]);

export function createInput(target) {
  const held = new Set();
  let presses = [];

  window.addEventListener('keydown', (event) => {
    if (HELD_CODES.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    const press = PRESS_CODES.get(event.code);
    if (press) {
      if (!event.repeat) presses.push(press);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    presses.push(PRESS_CONFIRM);
  });

  return {
    isHeld(code) {
      return held.has(code);
    },
    /** Steering on foot or in a car: {x, y} each in -1..1 from WASD and the arrows. */
    moveVector() {
      const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      return { x, y };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The one-shot presses since the last call, in order. */
    takePresses() {
      const taken = presses;
      presses = [];
      return taken;
    },
  };
}
