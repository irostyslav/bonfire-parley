import * as THREE from "three";
import { Input } from "./input";
import { GameAudio } from "./audio";
import { loadSave, writeSave } from "./save";
import { heightAt } from "./rng";
import { DITHER_FRAG, DITHER_VERT } from "./shaders";
import { animateEmbers, buildWorld, DESTINATION_Z, type Bonfire, type Scavenge } from "./world";
import { encounterForDistance, resolveParley } from "./encounters";
import type { ControlsProbe, Ending, GameSnapshot, Phase, PromptKind } from "./types";

export type SnapshotHandler = (s: GameSnapshot) => void;

const WALK_SPEED = 4.15;
const TITLE_LOOK = new THREE.Vector3(-2, 1.2, -6);

export class BonfireGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.3, 85);
  private screenScene = new THREE.Scene();
  private screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private target: THREE.WebGLRenderTarget;
  private ditherMat: THREE.ShaderMaterial;
  private input = new Input();
  private audio = new GameAudio();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private disposed = false;

  private player = new THREE.Group();
  private px = 0;
  private pz = 6;
  private py = 0;
  private facing = 0;
  private speed = 0;
  private velX = 0;
  private velZ = 0;

  private phase: Phase = "title";
  private warmth = 100;
  private stamina = 100;
  private food = 2;
  private distance = 0;
  private bestDistance = 0;
  private relic = true;
  private charm = false;
  private muted = false;
  private prompt: PromptKind = null;
  private promptLabel = "";
  private usedEncounters = new Set<string>();
  private encounter = encounterForDistance(0, this.usedEncounters);
  private resultText: string | null = null;
  private ending: Ending = null;
  private epitaph = "";
  private nearFire: Bonfire | null = null;
  private nearScavenge: Scavenge | null = null;
  private stepTimer = 0;
  private titleT = 0;
  private shake = 0;
  private cam = new THREE.Vector3(0, 14, 18);
  private look = new THREE.Vector3();
  private world: ReturnType<typeof buildWorld>;
  private snowOffset = 0;
  private hudClock = 0;
  private lastSnap: GameSnapshot | null = null;
  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    private onSnap: SnapshotHandler,
  ) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x1a1814, 1);

    const save = loadSave();
    this.bestDistance = save.bestDistance;
    this.muted = save.muted;
    this.audio.setMuted(this.muted);

    this.scene.fog = new THREE.FogExp2(0x2a2620, 0.034);
    this.scene.background = new THREE.Color(0x2a2620);

    const hemi = new THREE.HemisphereLight(0xc8c0b0, 0x1a1612, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xe8e0d0, 0.55);
    sun.position.set(18, 40, 12);
    this.scene.add(sun);
    const fill = new THREE.AmbientLight(0x6a645c, 0.25);
    this.scene.add(fill);

    this.world = buildWorld(this.scene, 7);
    this.makePlayer();
    this.px = 0;
    this.pz = 8;
    this.py = heightAt(this.px, this.pz);
    this.player.position.set(this.px, this.py, this.pz);

    const rtW = 160;
    const rtH = 220;
    this.target = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    });

    this.ditherMat = new THREE.ShaderMaterial({
      vertexShader: DITHER_VERT,
      fragmentShader: DITHER_FRAG,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        resolution: { value: new THREE.Vector2(rtW, rtH) },
        vignette: { value: 0.55 },
        grain: { value: 0.035 },
        time: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.ditherMat);
    this.screenScene.add(quad);

    this.input.attach();
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.emit(true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.loop();
    this.wireProbe();
  }

  beginWalk() {
    this.audio.unlock();
    this.audio.setMuted(this.muted);
    if (this.phase !== "title" && this.phase !== "dead" && this.phase !== "ended") return;
    this.phase = "playing";
    this.warmth = 100;
    this.stamina = 100;
    this.food = 2;
    this.distance = 0;
    this.relic = true;
    this.charm = false;
    this.ending = null;
    this.epitaph = "";
    this.resultText = null;
    this.usedEncounters = new Set();
    this.px = 0;
    this.pz = 8;
    this.facing = 0;
    this.speed = 0;
    this.py = heightAt(this.px, this.pz);
    this.player.position.set(this.px, this.py, this.pz);
    this.player.visible = true;
    for (const f of this.world.bonfires) f.used = false;
    for (const s of this.world.scavenges) {
      s.taken = false;
      s.mesh.visible = true;
    }
    this.emit(true);
  }

  choose(choiceId: string) {
    if (this.phase !== "parley" || !this.encounter) return;
    this.audio.ui();
    const r = resolveParley(this.encounter.id, choiceId, this.relic);
    this.usedEncounters.add(this.encounter.id);
    this.warmth = clamp(this.warmth + (r.warmth ?? 0), 0, 100);
    this.stamina = clamp(this.stamina + (r.stamina ?? 0), 0, 100);
    this.food = Math.max(0, this.food + (r.food ?? 0));
    if (r.relic === false) this.relic = false;
    if (r.charm) this.charm = true;
    this.resultText = r.body;
    this.encounter = null;
    if (r.ending) {
      this.finish(r.ending, r.body);
      return;
    }
    this.phase = "playing";
    this.emit(true);
  }

  dismissResult() {
    this.resultText = null;
    this.emit(true);
  }

  setTouch(x: number, y: number) {
    this.input.setTouch(x, y);
  }

  interact() {
    this.input.queueInteract();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    writeSave({ muted: this.muted });
    this.emit(true);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.input.detach();
    this.audio.dispose();
    this.target.dispose();
    this.ditherMat.dispose();
    this.renderer.dispose();
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("qa")) {
      delete window.__controlsTest;
    }
  }

  private makePlayer() {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.55, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x14110e }),
    );
    body.position.y = 0.55;
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.32, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x1c1814 }),
    );
    pack.position.set(0, 0.7, 0.22);
    pack.name = "pack";
    this.player.add(body, pack);
    this.scene.add(this.player);
  }

  private onResize = () => this.resize();

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    const short = Math.min(w, h);
    const scale = Math.max(2, Math.floor(short / 150));
    const iw = Math.max(96, Math.floor(w / scale));
    const ih = Math.max(128, Math.floor(h / scale));
    this.target.setSize(iw, ih);
    this.ditherMat.uniforms.resolution.value.set(iw, ih);
    this.camera.aspect = iw / ih;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(dt, 0.1);
    this.acc += dt;
    const step = 1 / 60;
    while (this.acc >= step) {
      this.simulate(step);
      this.acc -= step;
    }
    this.draw(now / 1000);
    this.hudClock += dt;
    if (this.hudClock > 0.12) {
      this.hudClock = 0;
      this.emit(false);
    }
  };

  private simulate(dt: number) {
    const act = this.input.poll();
    if (act.mute) this.toggleMute();

    this.titleT += dt;
    for (const f of this.world.bonfires) animateEmbers(f, this.titleT);

    const snow = this.world.snow;
    const spos = snow.geometry.attributes.position;
    if (spos) {
      this.snowOffset += dt;
      for (let i = 0; i < spos.count; i++) {
        let y = spos.getY(i) - dt * (1.4 + (i % 5) * 0.15);
        if (y < 0) y = 16;
        spos.setY(i, y);
        spos.setX(i, spos.getX(i) + Math.sin(this.snowOffset + i) * dt * 0.2);
      }
      spos.needsUpdate = true;
    }
    snow.position.set(this.px, 0, this.pz);

    if (this.phase === "title") {
      const t = this.titleT * 0.12;
      this.cam.set(Math.sin(t) * 4 + 6, 11.5, 16 + Math.cos(t) * 2);
      this.look.copy(TITLE_LOOK);
      this.look.y = heightAt(TITLE_LOOK.x, TITLE_LOOK.z) + 1.4;
      this.player.visible = false;
      return;
    }

    if (this.phase === "parley" || this.phase === "dead" || this.phase === "ended" || this.resultText) {
      this.followCam(dt);
      return;
    }

    // Camera-relative on-foot: W = world −Z (up on screen), A = −X (left)
    const ax = act.moveX;
    const az = -act.moveY;
    const moving = Math.hypot(ax, az) > 0.08;
    const burden = this.relic ? 1 / (1 + this.distance / (this.charm ? 720 : 420)) : 1.08;
    const tired = this.stamina < 8 ? 0.55 : 1;
    const targetSpeed = moving ? WALK_SPEED * burden * tired : 0;
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-10 * dt));

    if (moving) {
      const len = Math.hypot(ax, az);
      const nx = ax / len;
      const nz = az / len;
      this.facing = Math.atan2(nx, nz);
      const stepX = nx * this.speed * dt;
      const stepZ = nz * this.speed * dt;
      let nxPos = this.px + stepX;
      let nzPos = this.pz + stepZ;
      if (this.world.collide(nxPos, this.pz, 0.42)) nxPos = this.px;
      if (this.world.collide(this.px, nzPos, 0.42)) nzPos = this.pz;
      const walked = Math.hypot(nxPos - this.px, nzPos - this.pz);
      this.px = nxPos;
      this.pz = nzPos;
      this.distance += walked;
      this.stamina = clamp(this.stamina - walked * 1.7, 0, 100);
      this.stepTimer += walked;
      if (this.stepTimer > 1.35) {
        this.stepTimer = 0;
        this.audio.step();
      }
    } else {
      this.speed *= Math.exp(-6 * dt);
      this.stamina = clamp(this.stamina + 8 * dt, 0, 100);
    }

    this.py = heightAt(this.px, this.pz);
    this.player.position.set(this.px, this.py, this.pz);
    this.player.rotation.y = this.facing;
    const pack = this.player.getObjectByName("pack");
    if (pack) pack.visible = this.relic;

    this.velX = ax;
    this.velZ = az;

    this.nearFire = null;
    let fireHeat = 0;
    for (const f of this.world.bonfires) {
      const d = Math.hypot(this.px - f.x, this.pz - f.z);
      if (d < 14) fireHeat = Math.max(fireHeat, 1 - d / 14);
      if (d < 3.6) this.nearFire = f;
    }
    this.audio.setNearFire(fireHeat);
    this.audio.setWind(this.nearFire ? 0.2 : 1);

    this.nearScavenge = null;
    for (const s of this.world.scavenges) {
      if (s.taken) continue;
      if (Math.hypot(this.px - s.x, this.pz - s.z) < 1.8) this.nearScavenge = s;
    }

    if (this.nearFire) {
      this.warmth = clamp(this.warmth + 22 * dt, 0, 100);
      this.stamina = clamp(this.stamina + 14 * dt, 0, 100);
    } else {
      const wind = 2.45 + (this.stamina < 5 ? 1.6 : 0) + (this.relic ? 0.25 : 0);
      this.warmth = clamp(this.warmth - wind * dt, 0, 100);
    }

    if (this.warmth <= 0) {
      this.shake = 0.6;
      this.finish("freeze", "The cold came in through the hands first, then the name of the road, then you.");
      return;
    }

    this.prompt = null;
    this.promptLabel = "";
    if (this.nearFire) {
      const ready = this.nearFire.hasTraveler && !this.nearFire.used;
      if (ready) {
        this.prompt = "parley";
        this.promptLabel = "Parley";
      } else {
        this.prompt = "rest";
        this.promptLabel = "Rest";
      }
    } else if (this.nearScavenge) {
      this.prompt = "scavenge";
      this.promptLabel = "Scavenge";
    } else if (this.food > 0 && this.warmth < 70) {
      this.prompt = "eat";
      this.promptLabel = "Eat";
    }

    if (act.interact) this.doInteract();

    if (this.pz < DESTINATION_Z + 4 && this.distance > 40) {
      const dest = this.world.bonfires[this.world.bonfires.length - 1];
      if (dest && !dest.used) {
        dest.used = true;
        this.openParley();
      }
    }

    this.followCam(dt);
    this.shake *= Math.exp(-3 * dt);
  }

  private doInteract() {
    if (this.nearFire) {
      this.audio.rest();
      this.warmth = clamp(this.warmth + 18, 0, 100);
      this.stamina = clamp(this.stamina + 25, 0, 100);
      if (this.nearFire.hasTraveler && !this.nearFire.used) {
        this.nearFire.used = true;
        this.openParley();
      }
      this.emit(true);
      return;
    }
    if (this.nearScavenge && !this.nearScavenge.taken) {
      this.nearScavenge.taken = true;
      this.nearScavenge.mesh.visible = false;
      this.food += 1;
      this.warmth = clamp(this.warmth + 8, 0, 100);
      this.audio.ui();
      this.emit(true);
      return;
    }
    if (this.food > 0 && this.warmth < 92) {
      this.food -= 1;
      this.warmth = clamp(this.warmth + 28, 0, 100);
      this.stamina = clamp(this.stamina + 12, 0, 100);
      this.audio.ui();
      this.emit(true);
    }
  }

  private openParley() {
    const enc = encounterForDistance(this.distance, this.usedEncounters);
    if (!enc) return;
    this.encounter = enc;
    this.phase = "parley";
    this.audio.parley();
    this.emit(true);
  }

  private finish(ending: Ending, epitaph: string) {
    this.ending = ending;
    this.epitaph = epitaph;
    this.phase = ending === "freeze" ? "dead" : "ended";
    if (this.distance > this.bestDistance) {
      this.bestDistance = this.distance;
      writeSave({ bestDistance: this.bestDistance });
    }
    if (ending === "freeze") this.audio.death();
    else this.audio.ending();
    this.emit(true);
  }

  private followCam(dt: number) {
    const desired = new THREE.Vector3(this.px + 0.4, this.py + 13.5, this.pz + 16.5);
    this.cam.x += (desired.x - this.cam.x) * (1 - Math.exp(-2.4 * dt));
    this.cam.y += (desired.y - this.cam.y) * (1 - Math.exp(-2.4 * dt));
    this.cam.z += (desired.z - this.cam.z) * (1 - Math.exp(-2.4 * dt));
    this.look.set(this.px, this.py + 1.1, this.pz - 2.5);
  }

  private draw(t: number) {
    const trauma = this.shake * this.shake;
    const ox = (Math.sin(t * 37) * trauma) * 0.35;
    const oy = (Math.cos(t * 29) * trauma) * 0.25;
    this.camera.position.set(this.cam.x + ox, this.cam.y + oy, this.cam.z);
    this.camera.lookAt(this.look.x, this.look.y, this.look.z);
    this.ditherMat.uniforms.time.value = t;

    const gl = this.renderer;
    gl.setRenderTarget(this.target);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(null);
    gl.render(this.screenScene, this.screenCam);
  }

  private snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      warmth: this.warmth,
      stamina: this.stamina,
      food: this.food,
      distance: this.distance,
      bestDistance: this.bestDistance,
      relic: this.relic,
      charm: this.charm,
      muted: this.muted,
      prompt: this.prompt,
      promptLabel: this.promptLabel,
      encounter: this.encounter,
      resultText: this.resultText,
      ending: this.ending,
      epitaph: this.epitaph,
    };
  }

  private emit(force: boolean) {
    const s = this.snapshot();
    if (!force && this.lastSnap && cheapEqual(this.lastSnap, s)) return;
    this.lastSnap = s;
    this.onSnap(s);
  }

  private wireProbe() {
    const qa = import.meta.env.DEV || new URLSearchParams(location.search).has("qa");
    if (!qa) return;
    window.__controlsTest = {
      getYaw: () => this.facing,
      getSpeed: () => this.speed,
      setKeys: (codes: string[]) => {
        this.input.injected = codes.length ? codes : null;
      },
      getX: () => this.px,
      getZ: () => this.pz,
    } as ControlsProbe;
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function cheapEqual(a: GameSnapshot, b: GameSnapshot) {
  return (
    a.phase === b.phase &&
    a.prompt === b.prompt &&
    a.resultText === b.resultText &&
    a.muted === b.muted &&
    a.food === b.food &&
    a.relic === b.relic &&
    Math.abs(a.warmth - b.warmth) < 1.5 &&
    Math.abs(a.stamina - b.stamina) < 1.5 &&
    Math.abs(a.distance - b.distance) < 1
  );
}
