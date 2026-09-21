export type Phase = "title" | "playing" | "parley" | "dead" | "ended";

export type Ending = "freeze" | "relinquish" | "endure" | null;

export type Choice = {
  id: string;
  label: string;
};

export type Encounter = {
  id: string;
  title: string;
  body: string;
  choices: Choice[];
};

export type ParleyResult = {
  body: string;
  warmth?: number;
  food?: number;
  stamina?: number;
  relic?: boolean;
  charm?: boolean;
  ending?: Exclude<Ending, null>;
};

export type PromptKind = "rest" | "scavenge" | "parley" | "eat" | null;

export type GameSnapshot = {
  phase: Phase;
  warmth: number;
  stamina: number;
  food: number;
  distance: number;
  bestDistance: number;
  relic: boolean;
  charm: boolean;
  muted: boolean;
  prompt: PromptKind;
  promptLabel: string;
  encounter: Encounter | null;
  resultText: string | null;
  ending: Ending;
  epitaph: string;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
  getX?: () => number;
  getZ?: () => number;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}
