import * as THREE from "three";
import { heightAt, pathX, hash2, mulberry32 } from "./rng";

export type Bonfire = {
  x: number;
  z: number;
  y: number;
  hasTraveler: boolean;
  used: boolean;
  light: THREE.PointLight;
  embers: THREE.Points;
};

export type Scavenge = {
  x: number;
  z: number;
  y: number;
  taken: boolean;
  mesh: THREE.Object3D;
};

export type Cabin = {
  x: number;
  z: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const WORLD_Z0 = 36;
const WORLD_Z1 = -720;
const WORLD_X = 78;

export const DESTINATION_Z = -680;

function pineGeometry() {
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5);
  trunk.translate(0, 0.45, 0);
  const c1 = new THREE.ConeGeometry(1.15, 1.8, 6);
  c1.translate(0, 1.5, 0);
  const c2 = new THREE.ConeGeometry(0.85, 1.5, 6);
  c2.translate(0, 2.35, 0);
  const c3 = new THREE.ConeGeometry(0.5, 1.1, 6);
  c3.translate(0, 3.05, 0);
  return { trunk, canopy: c1, canopy2: c2, canopy3: c3 };
}

function makeCabin(x: number, z: number, rot: number, dark: THREE.Material, darker: THREE.Material) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 3.4), dark);
  body.position.y = 1.3;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 4), darker);
  roof.position.y = 3.15;
  roof.rotation.y = Math.PI / 4;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), darker);
  chimney.position.set(1.1, 3.4, -0.4);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.12), darker);
  door.position.set(0, 0.65, 1.72);
  g.add(body, roof, chimney, door);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  const c: Cabin = {
    x,
    z,
    minX: x - 2.6,
    maxX: x + 2.6,
    minZ: z - 2.2,
    maxZ: z + 2.2,
  };
  return { group: g, cabin: c };
}

export function buildWorld(scene: THREE.Scene, seed = 1) {
  const rng = mulberry32(seed);
  const matInk = new THREE.MeshLambertMaterial({ color: 0x1a1612 });
  const matDark = new THREE.MeshLambertMaterial({ color: 0x14110e });
  const matPine = new THREE.MeshLambertMaterial({ color: 0x161410 });
  const matTrunk = new THREE.MeshLambertMaterial({ color: 0x1c1814 });
  const matSnow = new THREE.MeshLambertMaterial({ color: 0xd8d2c6 });
  const matFence = new THREE.MeshLambertMaterial({ color: 0x1a1713 });
  const matCrate = new THREE.MeshLambertMaterial({ color: 0x2a241c });

  const terrainW = WORLD_X * 2;
  const terrainD = WORLD_Z0 - WORLD_Z1;
  const segX = 72;
  const segZ = 180;
  const tGeo = new THREE.PlaneGeometry(terrainW, terrainD, segX, segZ);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + (WORLD_Z0 + WORLD_Z1) / 2;
    pos.setZ(i, z);
    pos.setY(i, heightAt(x, z));
  }
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, matSnow);
  scene.add(terrain);

  const pines = pineGeometry();
  const treeCount = 420;
  const trunks = new THREE.InstancedMesh(pines.trunk, matTrunk, treeCount);
  const can1 = new THREE.InstancedMesh(pines.canopy, matPine, treeCount);
  const can2 = new THREE.InstancedMesh(pines.canopy2, matPine, treeCount);
  const can3 = new THREE.InstancedMesh(pines.canopy3, matPine, treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  const treePos: { x: number; z: number }[] = [];
  let guard = 0;
  while (placed < treeCount && guard < 8000) {
    guard++;
    const x = (rng() - 0.5) * WORLD_X * 1.85;
    const z = WORLD_Z0 - rng() * (WORLD_Z0 - WORLD_Z1);
    const px = pathX(z);
    if (Math.abs(x - px) < 5.5 && Math.abs(x) < 28) continue;
    if (Math.hypot(x, z) < 8) continue;
    dummy.position.set(x, heightAt(x, z), z);
    const s = 0.7 + rng() * 1.15;
    dummy.scale.set(s, s * (0.85 + rng() * 0.4), s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    can1.setMatrixAt(placed, dummy.matrix);
    can2.setMatrixAt(placed, dummy.matrix);
    can3.setMatrixAt(placed, dummy.matrix);
    treePos.push({ x, z });
    placed++;
  }
  trunks.instanceMatrix.needsUpdate = true;
  can1.instanceMatrix.needsUpdate = true;
  can2.instanceMatrix.needsUpdate = true;
  can3.instanceMatrix.needsUpdate = true;
  trunks.count = placed;
  can1.count = placed;
  can2.count = placed;
  can3.count = placed;
  scene.add(trunks, can1, can2, can3);

  const postGeo = new THREE.BoxGeometry(0.12, 1.15, 0.12);
  const railGeo = new THREE.BoxGeometry(2.05, 0.08, 0.07);
  const postCount = 220;
  const posts = new THREE.InstancedMesh(postGeo, matFence, postCount);
  const rails = new THREE.InstancedMesh(railGeo, matFence, postCount * 2);
  let pi = 0;
  let ri = 0;
  for (let z = 18; z > WORLD_Z1 + 40; z -= 2.05) {
    if (hash2(3, z) < 0.28) continue;
    for (const side of [-1, 1] as const) {
      if (pi >= postCount) break;
      const x = pathX(z) + side * (4.4 + hash2(z, side) * 0.6);
      const y = heightAt(x, z);
      dummy.position.set(x, y + 0.55, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(pi, dummy.matrix);
      dummy.position.set(x, y + 0.42, z - 1);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      rails.setMatrixAt(ri++, dummy.matrix);
      dummy.position.y = y + 0.78;
      dummy.updateMatrix();
      rails.setMatrixAt(ri++, dummy.matrix);
      pi++;
    }
  }
  posts.count = pi;
  rails.count = ri;
  posts.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  scene.add(posts, rails);

  const cabins: Cabin[] = [];
  const cabinSpots = [
    { x: -14, z: -28, r: 0.4 },
    { x: 18, z: -96, r: -0.5 },
    { x: -22, z: -168, r: 0.2 },
    { x: 12, z: -248, r: 0.7 },
    { x: -16, z: -340, r: -0.3 },
    { x: 20, z: -430, r: 0.15 },
    { x: -10, z: -530, r: 0.6 },
    { x: 8, z: -620, r: 0 },
  ];
  for (const s of cabinSpots) {
    const built = makeCabin(pathX(s.z) + s.x * 0.45, s.z, s.r, matInk, matDark);
    scene.add(built.group);
    cabins.push(built.cabin);
  }

  const bonfires: Bonfire[] = [];
  const fireZs = [0, -88, -180, -275, -370, -465, -560, DESTINATION_Z];
  const emberGeo = new THREE.BufferGeometry();
  const emberCount = 40;
  const emberPos = new Float32Array(emberCount * 3);
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    color: 0xc8b49a,
    size: 0.12,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  for (let i = 0; i < fireZs.length; i++) {
    const z = fireZs[i]!;
    const x = pathX(z);
    const y = heightAt(x, z);
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.18, 8), matDark);
    pit.position.set(x, y + 0.05, z);
    const logGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.3, 5);
    for (let k = 0; k < 4; k++) {
      const log = new THREE.Mesh(logGeo, matTrunk);
      log.position.set(x, y + 0.18, z);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (k * Math.PI) / 4;
      scene.add(log);
    }
    scene.add(pit);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xe8dcc8 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.15, 5), flameMat);
    flame.position.set(x, y + 0.85, z);
    const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 5), flameMat);
    flame2.position.set(x + 0.12, y + 1.05, z - 0.05);
    scene.add(flame, flame2);
    if (i > 0) {
      const npc = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.2, 0.42, 3, 5),
        matInk,
      );
      npc.position.set(x + 1.45, y + 0.52, z + 0.35);
      scene.add(npc);
    }
    const light = new THREE.PointLight(0xffd8a8, i === 0 ? 2.4 : 1.6, 16, 1.6);
    light.position.set(x, y + 1.1, z);
    scene.add(light);
    const embers = new THREE.Points(emberGeo.clone(), emberMat);
    embers.position.set(x, y + 0.4, z);
    scene.add(embers);
    bonfires.push({
      x,
      z,
      y,
      hasTraveler: i > 0,
      used: false,
      light,
      embers,
    });
  }

  // Last fire ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.28, 6, 16), matDark);
  ring.rotation.x = Math.PI / 2;
  const rx = pathX(DESTINATION_Z);
  ring.position.set(rx, heightAt(rx, DESTINATION_Z) + 0.15, DESTINATION_Z);
  scene.add(ring);

  const scavenges: Scavenge[] = [];
  for (let i = 0; i < 18; i++) {
    const z = -40 - i * 34 - rng() * 10;
    const x = pathX(z) + (rng() > 0.5 ? 1 : -1) * (3 + rng() * 5);
    const y = heightAt(x, z);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.55), matCrate);
    crate.position.set(x, y + 0.28, z);
    crate.rotation.y = rng() * Math.PI;
    scene.add(crate);
    scavenges.push({ x, z, y, taken: false, mesh: crate });
  }

  const snowGeo = new THREE.BufferGeometry();
  const snowN = 900;
  const snowArr = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) {
    snowArr[i * 3] = (rng() - 0.5) * 90;
    snowArr[i * 3 + 1] = rng() * 18;
    snowArr[i * 3 + 2] = (rng() - 0.5) * 70;
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowArr, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({ color: 0xeee6d8, size: 0.08, transparent: true, opacity: 0.85 }),
  );
  scene.add(snow);

  function collide(x: number, z: number, radius: number) {
    for (const c of cabins) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if (Math.hypot(x - cx, z - cz) < radius) return true;
    }
    for (const t of treePos) {
      if (Math.hypot(x - t.x, z - t.z) < radius + 0.45) return true;
    }
    return false;
  }

  return { bonfires, scavenges, cabins, snow, collide, treePos };
}

export function animateEmbers(fire: Bonfire, t: number) {
  const pos = fire.embers.geometry.attributes.position;
  if (!pos) return;
  for (let i = 0; i < pos.count; i++) {
    const seed = i * 0.37;
    const life = ((t * 0.35 + seed) % 1);
    const ang = seed * 6.2;
    pos.setX(i, Math.cos(ang + t * 0.4) * life * 0.45);
    pos.setY(i, life * 2.2);
    pos.setZ(i, Math.sin(ang + t * 0.4) * life * 0.45);
  }
  pos.needsUpdate = true;
}
