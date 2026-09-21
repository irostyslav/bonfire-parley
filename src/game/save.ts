const KEY = "bonfire-parley-v1";
const SAVE_VERSION = 1;
type SaveData = { version: number; bestDistance: number; muted: boolean };
const defaults: SaveData = { version: SAVE_VERSION, bestDistance: 0, muted: false };
function migrate(raw: SaveData): SaveData {
  return { ...defaults, ...raw, version: SAVE_VERSION };
}
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return migrate(JSON.parse(raw) as SaveData);
  } catch { return { ...defaults }; }
}
export function writeSave(partial: Partial<SaveData>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadSave(), ...partial, version: SAVE_VERSION }));
  } catch { /* quota / private */ }
}
