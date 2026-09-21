const GAME_CODES = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
  "Space", "KeyE", "KeyM", "Escape", "Enter",
]);

function radialDeadzone(x: number, y: number, dz = 0.18) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = ((m - dz) / (1 - dz)) / m;
  return { x: x * scale, y: y * scale };
}

export class Input {
  keys = new Set<string>();
  injected: string[] | null = null;
  touchX = 0;
  touchY = 0;
  interactQueued = false;
  muteQueued = false;
  private just = new Set<string>();
  private prev = new Set<string>();
  private prevPadA = false;

  attach() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.onVis);
  }

  detach() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.onVis);
    this.keys.clear();
  }

  private onDown = (e: KeyboardEvent) => {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private onUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private clear = () => { this.keys.clear(); this.touchX = 0; this.touchY = 0; };
  private onVis = () => { if (document.hidden) this.clear(); };

  setTouch(x: number, y: number) {
    const v = radialDeadzone(x, y, 0.12);
    this.touchX = v.x;
    this.touchY = v.y;
  }
  queueInteract() { this.interactQueued = true; }
  queueMute() { this.muteQueued = true; }

  poll() {
    const src = this.injected ?? [...this.keys];
    const now = new Set(src);
    this.just.clear();
    for (const c of now) if (!this.prev.has(c)) this.just.add(c);
    this.prev = now;
    let ax = this.touchX;
    let ay = -this.touchY;
    if (now.has("KeyA") || now.has("ArrowLeft")) ax -= 1;
    if (now.has("KeyD") || now.has("ArrowRight")) ax += 1;
    if (now.has("KeyW") || now.has("ArrowUp")) ay += 1;
    if (now.has("KeyS") || now.has("ArrowDown")) ay -= 1;
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      ax += stick.x;
      ay -= stick.y;
      if (pad.buttons[12]?.pressed) ay += 1;
      if (pad.buttons[13]?.pressed) ay -= 1;
      if (pad.buttons[14]?.pressed) ax -= 1;
      if (pad.buttons[15]?.pressed) ax += 1;
      if (pad.buttons[0]?.pressed && !this.prevPadA) this.interactQueued = true;
      this.prevPadA = !!pad.buttons[0]?.pressed;
    }
    const mag = Math.hypot(ax, ay);
    if (mag > 1) { ax /= mag; ay /= mag; }
    const interact = this.interactQueued || this.just.has("Space") || this.just.has("KeyE") || this.just.has("Enter");
    this.interactQueued = false;
    const mute = this.muteQueued || this.just.has("KeyM");
    this.muteQueued = false;
    return { moveX: ax, moveY: ay, interact, mute, pause: this.just.has("Escape") };
  }
}
