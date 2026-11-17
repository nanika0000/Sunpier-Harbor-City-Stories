// Progress saving: the story position and the cash, kept in this browser's localStorage.
// Only the arc is saved — never the player's position or the traffic — so continuing a
// game always starts cleanly at Rosa's noodle shop with the next chapter waiting.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      missionIndex: Number.isInteger(data.missionIndex) ? data.missionIndex : 0,
      cash: Number.isFinite(data.cash) ? data.cash : 0,
      storyDone: data.storyDone === true,
    };
  } catch {
    return null;
  }
}

export function storeSave(progress) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: progress.missionIndex,
      cash: progress.cash,
      storyDone: progress.storyDone,
    }));
  } catch {
    // Private windows and full storage simply mean the story lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear if storage itself is unavailable.
  }
}
