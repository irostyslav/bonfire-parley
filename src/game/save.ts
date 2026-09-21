const KEY = "bonfire-parley-v1";
const SAVE_VERSION = 1;

type SaveData = {
  version: number;
  bestDistance: number;
  muted: boolean;
};

const defaults: SaveData = {
  version: SAVE_VERSION,
  bestDistance: 0,
  muted: false,
};

function migrate(raw: SaveData): SaveData {
  const s = { ...defaults, ...raw };
  s.version = SAVE_VERSION;
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return { ...defaults };
  }
}

export function writeSave(partial: Partial<SaveData>) {
  try {
    const next = { ...loadSave(), ...partial, version: SAVE_VERSION };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}
