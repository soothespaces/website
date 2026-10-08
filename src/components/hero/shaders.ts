// GLSL for the hero scenes. Scene sizes are compiled in as #defines, so each
// scene gets its own programs.

export const SPEED = 1.15; // meters per second

const SEGMENTS = /* glsl */ `
uniform vec4 uSegA[SEG_COUNT]; // endpoints a.xy, b.xy
uniform vec2 uSegB[SEG_COUNT]; // radius, half width

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

float strokeDist(int i, vec2 p) {
  vec4 s = uSegA[i];
  vec2 shape = uSegB[i];
  float d = segDist(p, s.xy, s.zw);
  return shape.x > 0.0 ? abs(d - shape.x) - shape.y : d - shape.y;
}

float wallDist(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < WALL_COUNT; i++) d = min(d, strokeDist(i, p));
  return d;
}
`;

export const VERTEX = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Screen space, redrawn on resize: wall and furniture coverage.
export const INK_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
${SEGMENTS}
uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uPx;
out vec4 fragColor;

float coverage(float d) {
  return clamp(0.5 - d / uPx, 0.0, 1.0);
}

void main() {
  vec2 p = uOffset + vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx;
  float walls = 1e5;
  float furniture = 1e5;
  for (int i = 0; i < SEG_COUNT; i++) {
    float d = strokeDist(i, p);
    if (i < WALL_COUNT) walls = min(walls, d);
    else furniture = min(furniture, d);
  }
  fragColor = vec4(coverage(walls), coverage(furniture), 0.0, 1.0);
}
`;

// Scene space, drawn once per scene: how much of each source reaches a
// point. Sound bends around corners, so the shadows are deliberately soft.
export const VISIBILITY_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
${SEGMENTS}
uniform vec2 uWorldMin;
uniform vec2 uWorldSize;
uniform vec4 uSources[SOURCE_SLOTS];
in vec2 vUv;
out vec4 fragColor;

float visibility(vec2 p, vec2 source) {
  vec2 toSource = source - p;
  float len = length(toSource);
  if (len < 1e-3) return 1.0;
  vec2 dir = toSource / len;
  float lit = 1.0;
  float t = 0.0;
  for (int i = 0; i < 96; i++) {
    float h = wallDist(p + dir * t);
    if (h < 0.0) return 0.0;
    float along = max(min(t, len - t), 0.15);
    lit = min(lit, h / (0.32 * along));
    t += clamp(h, 0.02, 0.6);
    if (t >= len) break;
  }
  return smoothstep(0.0, 1.0, clamp(lit, 0.0, 1.0));
}

void main() {
  vec2 p = uWorldMin + vUv * uWorldSize;
  vec4 v = vec4(0.0);
  for (int i = 0; i < SOURCE_COUNT; i++) v[i] = visibility(p, uSources[i].xy);
  fragColor = v;
}
`;

// Every frame: rings from each source, under the baked walls.
export const COMPOSITE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uInk;
uniform sampler2D uVisibility;
uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uPx;
uniform vec2 uWorldMin;
uniform vec2 uWorldSize;
uniform vec4 uBounds; // min.xy, max.xy
uniform float uFade;
uniform float uTime;
uniform vec4 uSources[SOURCE_SLOTS]; // position, period, seed
uniform vec3 uFg;
uniform vec3 uAccent;
uniform vec4 uAlpha; // walls, furniture, floor grid, rings
out vec4 fragColor;

const float SPEED = ${SPEED.toFixed(3)};
const float RING_WIDTH = 0.045;
const float DECAY = 4.5;
// How far apart, in meters, rings from different sources start to merge.
const float BLEND = 0.4;
const float SILENT = 1e3;

float hash(float n) {
  return fract(sin(n * 91.3458) * 47453.5453);
}

// Speech comes in bursts: some rings are skipped, the rest vary in strength.
float burst(float k, float seed) {
  float on = step(0.32, hash(k * 1.731 + seed * 13.17));
  return on * mix(0.45, 1.0, hash(k * 0.917 + seed * 3.71));
}

float edge(float d, float halfWidth) {
  return 1.0 - smoothstep(halfWidth, halfWidth + uPx * 1.5, d);
}

// Distance from p to this source's nearest ring, and how loud that ring is.
vec2 ring(vec2 p, vec4 source, float heard) {
  float r = length(p - source.xy);
  float period = source.z;
  float wavelength = period * SPEED;
  float q = (uTime - r / SPEED) / period;
  float k = floor(q);
  float f = q - k;

  // Ring k has already passed p; ring k + 1 hasn't reached it yet.
  vec2 passed = vec2(f * wavelength, burst(k, source.w));
  vec2 coming = vec2((1.0 - f) * wavelength, burst(k + 1.0, source.w));
  passed.x += step(passed.y, 0.0) * SILENT;
  coming.x += step(coming.y, 0.0) * SILENT;
  vec2 nearest = passed.x < coming.x ? passed : coming;

  float falloff = exp(-r / DECAY) * smoothstep(0.25, 1.4, r);
  // Rings fully behind a wall leave the field, so they don't pull audible
  // rings into a blend.
  return vec2(nearest.x + step(heard, 0.03) * SILENT, nearest.y * falloff * heard);
}

// Polynomial smooth min over the distance, blending loudness by the same weight.
vec2 smin(vec2 a, vec2 b) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / BLEND, 0.0, 1.0);
  return vec2(mix(b.x, a.x, h) - BLEND * h * (1.0 - h), mix(b.y, a.y, h));
}

float boxDist(vec2 p, vec4 box) {
  vec2 center = (box.xy + box.zw) * 0.5;
  vec2 half_ = (box.zw - box.xy) * 0.5;
  vec2 q = abs(p - center) - half_;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

void over(inout vec4 dst, vec3 color, float alpha) {
  dst = vec4(color * alpha, alpha) + dst * (1.0 - alpha);
}

void main() {
  vec2 p = uOffset + vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx;
  float outside = boxDist(p, uBounds);
  float mask = 1.0 - smoothstep(0.0, uFade, outside);
  if (mask <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  vec4 ink = texture(uInk, gl_FragCoord.xy / uRes);
  vec4 heard = texture(uVisibility, (p - uWorldMin) / uWorldSize);

  vec2 sound = vec2(SILENT, 0.0);
  for (int i = 0; i < SOURCE_COUNT; i++) sound = smin(sound, ring(p, uSources[i], heard[i]));
  float halfWidth = max(RING_WIDTH, uPx * 0.75);
  float loudness = clamp(sound.y * 1.8, 0.0, 1.0);
  float ringAlpha = edge(sound.x, halfWidth) * loudness * uAlpha.w * mask;

  // A faint one-meter dot grid on the floor of the room itself.
  vec2 cell = abs(fract(p) - 0.5);
  float dot_ = edge(length(0.5 - cell), max(0.03, uPx * 0.6));
  float grid = dot_ * uAlpha.z * (1.0 - smoothstep(-1.0, 0.0, outside));

  vec4 color = vec4(0.0);
  over(color, uFg, grid);
  over(color, uAccent, ringAlpha);
  over(color, uFg, ink.g * uAlpha.y * mask);
  over(color, uFg, ink.r * uAlpha.x * mask);
  fragColor = color;
}
`;

export function withDefines(source: string, defines: Record<string, number>) {
  const header = Object.entries(defines)
    .map(([name, value]) => `#define ${name} ${value}`)
    .join("\n");
  return source.replace("#version 300 es\n", `#version 300 es\n${header}\n`);
}
