export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function fade(t: number) { return t * t * (3 - 2 * t); }
export function valueNoise(x: number, z: number) {
  const xi = Math.floor(x); const zi = Math.floor(z);
  const xf = x - xi; const zf = z - zi; const u = fade(xf); const v = fade(zf);
  const n00 = hash2(xi, zi); const n10 = hash2(xi + 1, zi);
  const n01 = hash2(xi, zi + 1); const n11 = hash2(xi + 1, zi + 1);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}
export function fbm(x: number, z: number, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq); norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}
export function heightAt(x: number, z: number) {
  return fbm(x * 0.018, z * 0.018, 4) * 7.5 + fbm(x * 0.07, z * 0.07, 2) * 1.6 + Math.pow(Math.abs(x) / 42, 1.6) * 9 - 3.2;
}
export function pathX(z: number) {
  return Math.sin(z * 0.017) * 11 + fbm(z * 0.04, 2.2, 3) * 6 - 3;
}
