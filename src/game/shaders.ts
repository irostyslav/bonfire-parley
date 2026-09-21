export const DITHER_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const DITHER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float vignette;
uniform float grain;
uniform float time;
varying vec2 vUv;

float bayer4(vec2 p) {
  vec2 xy = mod(floor(p), 4.0);
  float x = xy.x;
  float y = xy.y;
  float index = x + y * 4.0;
  float m =
    index ==  0.0 ?  0.0 :
    index ==  1.0 ?  8.0 :
    index ==  2.0 ?  2.0 :
    index ==  3.0 ? 10.0 :
    index ==  4.0 ? 12.0 :
    index ==  5.0 ?  4.0 :
    index ==  6.0 ? 14.0 :
    index ==  7.0 ?  6.0 :
    index ==  8.0 ?  3.0 :
    index ==  9.0 ? 11.0 :
    index == 10.0 ?  1.0 :
    index == 11.0 ?  9.0 :
    index == 12.0 ? 15.0 :
    index == 13.0 ?  7.0 :
    index == 14.0 ? 13.0 : 5.0;
  return m / 16.0;
}

void main() {
  vec3 src = texture2D(tDiffuse, vUv).rgb;
  float l = dot(src, vec3(0.299, 0.587, 0.114));

  vec2 pv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(pv, pv) * vignette;
  l *= clamp(vig, 0.0, 1.0);

  float n = bayer4(gl_FragCoord.xy);
  float g = fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453);
  l += (g - 0.5) * grain;

  float levels = 3.0;
  float q = clamp(floor(l * levels + n) / levels, 0.0, 1.0);

  vec3 ink = vec3(0.055, 0.047, 0.039);
  vec3 umber = vec3(0.173, 0.149, 0.125);
  vec3 ash = vec3(0.478, 0.447, 0.400);
  vec3 bone = vec3(0.847, 0.816, 0.753);

  vec3 col = ink;
  if (q > 0.12) col = umber;
  if (q > 0.42) col = ash;
  if (q > 0.72) col = bone;

  gl_FragColor = vec4(col, 1.0);
}
`;
