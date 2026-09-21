export type Phase = "title" | "playing" | "parley" | "dead" | "ended";
export type Ending = "freeze" | "relinquish" | "endure" | null;
export type Choice = { id: string; label: string };
export type Encounter = { id: string; title: string; body: string; choices: Choice[] };
