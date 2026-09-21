export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private wind: AudioBufferSourceNode | null = null;
  private fire: AudioBufferSourceNode | null = null;
  private fireGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  muted = false;
  private unlocked = false;

  unlock() {
    if (this.unlocked && this.ctx?.state === "running") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.gain.value = 0.45;
      this.sfx.gain.value = 0.7;
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.startDrones();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
    document.addEventListener("visibilitychange", this.onVis);
  }

  private onVis = () => {
    if (!this.ctx) return;
    if (!document.hidden && this.ctx.state === "suspended") void this.ctx.resume();
  };

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  setNearFire(amount: number) {
    if (!this.fireGain || !this.ctx) return;
    this.fireGain.gain.setTargetAtTime(Math.min(0.35, amount * 0.35), this.ctx.currentTime, 0.08);
  }

  setWind(amount: number) {
    if (!this.windGain || !this.ctx) return;
    this.windGain.gain.setTargetAtTime(0.08 + amount * 0.12, this.ctx.currentTime, 0.2);
  }

  step() {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx) return;
    const buf = this.noise(0.07);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.85 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900 + Math.random() * 400;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    src.connect(f);
    f.connect(g);
    g.connect(sfx);
    src.start();
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  rest() {
    this.tone(180, 0.15, 0.6, "sine");
    this.tone(270, 0.08, 0.9, "sine");
  }

  parley() {
    this.tone(110, 0.2, 1.2, "sine");
    this.tone(165, 0.1, 1.6, "triangle");
  }

  death() {
    this.tone(70, 0.25, 2.4, "sine");
    this.tone(52, 0.18, 3.2, "sine");
  }

  ending() {
    this.tone(196, 0.12, 2, "sine");
    this.tone(247, 0.08, 2.6, "sine");
    this.tone(294, 0.06, 3.4, "sine");
  }

  ui() {
    this.tone(420, 0.05, 0.12, "square");
  }

  dispose() {
    document.removeEventListener("visibilitychange", this.onVis);
    try {
      this.wind?.stop();
      this.fire?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
  }

  private startDrones() {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;

    const windBuf = this.noise(4);
    this.wind = ctx.createBufferSource();
    this.wind.buffer = windBuf;
    this.wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 380;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.1;
    this.wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.music);
    this.wind.start();

    const fireBuf = this.noise(3);
    this.fire = ctx.createBufferSource();
    this.fire.buffer = fireBuf;
    this.fire.loop = true;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = "highpass";
    fireFilter.frequency.value = 700;
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    this.fire.connect(fireFilter);
    fireFilter.connect(this.fireGain);
    this.fireGain.connect(this.music);
    this.fire.start();

    // Distant low cello-like pad
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 55;
    const og = ctx.createGain();
    og.gain.value = 0.04;
    osc.connect(og);
    og.connect(this.music);
    osc.start();
  }

  private noise(seconds: number) {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  private tone(freq: number, vol: number, dur: number, type: OscillatorType) {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime + 0.04, dur * 0.25);
    osc.connect(g);
    g.connect(sfx);
    osc.start();
    osc.stop(ctx.currentTime + dur);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
}
