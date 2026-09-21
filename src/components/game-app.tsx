import { useCallback, useEffect, useRef, useState } from "react";
import type { BonfireGame } from "@/game/engine";
import type { GameSnapshot } from "@/game/types";

const BOOT: GameSnapshot = {
  phase: "title",
  warmth: 100,
  stamina: 100,
  food: 2,
  distance: 0,
  bestDistance: 0,
  relic: true,
  charm: false,
  muted: false,
  prompt: null,
  promptLabel: "",
  encounter: null,
  resultText: null,
  ending: null,
  epitaph: "",
};

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BonfireGame | null>(null);
  const stickRef = useRef<{ id: number; x: number; y: number; active: boolean }>({
    id: -1,
    x: 0,
    y: 0,
    active: false,
  });
  const [snap, setSnap] = useState<GameSnapshot>(BOOT);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let game: BonfireGame | null = null;
    void import("@/game/engine").then(({ BonfireGame }) => {
      if (cancelled || !canvasRef.current) return;
      game = new BonfireGame(canvasRef.current, setSnap);
      gameRef.current = game;
      game.start();
      setBooted(true);
    });
    return () => {
      cancelled = true;
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  const onStickDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    stickRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: true };
    setKnob({ x: 0, y: 0, on: true });
  }, []);

  const onStickMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = stickRef.current;
    if (!s.active || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const max = 42;
    const m = Math.hypot(dx, dy);
    const k = m > max ? max / m : 1;
    const x = (dx * k) / max;
    const y = (dy * k) / max;
    setKnob({ x: dx * k, y: dy * k, on: true });
    gameRef.current?.setTouch(x, y);
  }, []);

  const onStickUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickRef.current.id) return;
    stickRef.current.active = false;
    setKnob({ x: 0, y: 0, on: false });
    gameRef.current?.setTouch(0, 0);
  }, []);

  const playing = snap.phase === "playing" && !snap.resultText;
  const overlay = snap.phase !== "playing" || !!snap.resultText;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink text-bone">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ imageRendering: "pixelated" }}
      />

      <div
        className={`absolute inset-0 z-10 flex flex-col ${overlay ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        {playing ? <Hud snap={snap} /> : null}

        {overlay ? (
          <div className="pointer-events-auto flex flex-1 items-end justify-center p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center">
            {snap.phase === "title" ? (
              <TitleCard
                best={snap.bestDistance}
                muted={snap.muted}
                onBegin={() => gameRef.current?.beginWalk()}
                onMute={() => gameRef.current?.toggleMute()}
              />
            ) : null}
            {snap.phase === "parley" && snap.encounter ? (
              <ParleyCard
                title={snap.encounter.title}
                body={snap.encounter.body}
                choices={snap.encounter.choices}
                onChoose={(id) => gameRef.current?.choose(id)}
              />
            ) : null}
            {snap.resultText && snap.phase === "playing" ? (
              <ResultCard
                body={snap.resultText}
                onClose={() => gameRef.current?.dismissResult()}
              />
            ) : null}
            {snap.phase === "dead" || snap.phase === "ended" ? (
              <EndCard
                ending={snap.ending}
                epitaph={snap.epitaph}
                distance={snap.distance}
                best={snap.bestDistance}
                onAgain={() => gameRef.current?.beginWalk()}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {playing ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 pointer-events-none">
          <div
            className="pointer-events-auto relative size-32 touch-none rounded-full border border-bone/15 bg-ink/40"
            onPointerDown={onStickDown}
            onPointerMove={onStickMove}
            onPointerUp={onStickUp}
            onPointerCancel={onStickUp}
            aria-label="Move"
          >
            <div
              className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone/35 bg-bone/20"
              style={{
                transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
                opacity: knob.on ? 1 : 0.7,
              }}
            />
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              type="button"
              className="pointer-events-auto min-h-11 min-w-11 rounded-full border border-bone/20 bg-ink/50 px-3 text-xs tracking-widest text-ash"
              onClick={() => gameRef.current?.toggleMute()}
            >
              {snap.muted ? "Sound off" : "Sound on"}
            </button>
            <button
              type="button"
              className="pointer-events-auto min-h-16 min-w-16 rounded-full border border-bone/30 bg-bone/90 px-4 font-display text-sm tracking-wide text-ink"
              onClick={() => gameRef.current?.interact()}
            >
              {snap.promptLabel || "Act"}
            </button>
          </div>
        </div>
      ) : null}

      {!booted ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink font-display text-ash">
          Lighting the fire…
        </div>
      ) : null}
    </main>
  );
}

function Hud({ snap }: { snap: GameSnapshot }) {
  return (
    <header className="pointer-events-none flex items-start justify-between gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex w-40 flex-col gap-2">
        <Meter label="Warmth" value={snap.warmth} warn={snap.warmth < 28} />
        <Meter label="Stride" value={snap.stamina} warn={false} />
      </div>
      <div className="text-right font-display">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ash">Walked</p>
        <p className="text-2xl tabular-nums leading-none text-bone">
          {Math.floor(snap.distance)}
          <span className="ml-1 text-sm text-ash">m</span>
        </p>
        <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
          Bread {snap.food}
          {snap.relic ? " · Relic" : ""}
          {snap.charm ? " · Charm" : ""}
        </p>
      </div>
    </header>
  );
}

function Meter({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[0.65rem] uppercase tracking-[0.2em] text-ash">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-umber">
        <div
          className={`h-full rounded-sm ${warn ? "bg-ember" : "bg-bone"}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function TitleCard({
  best,
  muted,
  onBegin,
  onMute,
}: {
  best: number;
  muted: boolean;
  onBegin: () => void;
  onMute: () => void;
}) {
  return (
    <section className="w-full max-w-md rounded-3xl border border-bone/15 bg-ink/80 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
      <p className="text-[0.7rem] uppercase tracking-[0.32em] text-ash">A walk in a dead country</p>
      <h1 className="mt-3 font-display text-[2.35rem] font-medium leading-[0.95] tracking-tight text-bone sm:text-5xl">
        A Bonfire Parley
      </h1>
      <p className="mt-4 max-w-sm text-[1.05rem] leading-relaxed text-ash">
        Carry what is left through the snow. Stay near heat. When a stranger keeps a fire, sit, and speak.
      </p>
      <ul className="mt-5 space-y-1 text-sm text-muted">
        <li>Walk with WASD, the stick, or a pad.</li>
        <li>Space, E, or Act to rest, scavenge, eat, or parley.</li>
        <li>Warmth is the clock. The relic grows heavier.</li>
      </ul>
      {best > 0 ? (
        <p className="mt-4 font-display text-sm tracking-wide text-bone/80">
          Farthest walk · {Math.floor(best)} m
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onBegin}
          className="min-h-12 rounded-2xl bg-bone px-5 font-display text-lg tracking-wide text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          Begin the walk
        </button>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onMute}
            className="min-h-11 rounded-2xl border border-bone/20 px-4 text-sm text-ash"
          >
            {muted ? "Sound is off" : "Sound is on"}
          </button>
          <p className="max-w-[14rem] text-right text-xs leading-snug text-muted">
            On iPhone: Share, then Add to Home Screen.
          </p>
        </div>
      </div>
    </section>
  );
}

function ParleyCard({
  title,
  body,
  choices,
  onChoose,
}: {
  title: string;
  body: string;
  choices: { id: string; label: string }[];
  onChoose: (id: string) => void;
}) {
  return (
    <section className="w-full max-w-md rounded-3xl border border-bone/15 bg-ink/88 p-6">
      <p className="text-[0.7rem] uppercase tracking-[0.28em] text-ash">Parley</p>
      <h2 className="mt-2 font-display text-2xl font-medium text-bone">{title}</h2>
      <p className="mt-3 text-[1.02rem] leading-relaxed text-ash">{body}</p>
      <div className="mt-5 flex flex-col gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChoose(c.id)}
            className="min-h-12 rounded-2xl border border-bone/20 bg-umber/60 px-4 text-left font-display text-base text-bone transition-colors active:bg-bone active:text-ink"
          >
            {c.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ResultCard({ body, onClose }: { body: string; onClose: () => void }) {
  return (
    <section className="pointer-events-auto w-full max-w-md rounded-3xl border border-bone/15 bg-ink/88 p-6">
      <p className="text-[1.02rem] leading-relaxed text-ash">{body}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 min-h-11 w-full rounded-2xl bg-bone font-display text-ink"
      >
        Walk on
      </button>
    </section>
  );
}

function EndCard({
  ending,
  epitaph,
  distance,
  best,
  onAgain,
}: {
  ending: GameSnapshot["ending"];
  epitaph: string;
  distance: number;
  best: number;
  onAgain: () => void;
}) {
  const title =
    ending === "freeze" ? "The fire went out" : ending === "relinquish" ? "You set it down" : "Into the white";
  return (
    <section className="w-full max-w-md rounded-3xl border border-bone/15 bg-ink/88 p-7">
      <p className="text-[0.7rem] uppercase tracking-[0.28em] text-ash">An ending</p>
      <h2 className="mt-2 font-display text-3xl font-medium text-bone">{title}</h2>
      <p className="mt-4 leading-relaxed text-ash">{epitaph}</p>
      <p className="mt-5 font-display text-lg tabular-nums text-bone">
        {Math.floor(distance)} m
        <span className="ml-2 text-sm text-muted">best {Math.floor(best)} m</span>
      </p>
      <button
        type="button"
        onClick={onAgain}
        className="mt-6 min-h-12 w-full rounded-2xl bg-bone font-display text-lg text-ink"
      >
        Walk again
      </button>
    </section>
  );
}
