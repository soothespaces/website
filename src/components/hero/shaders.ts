// GLSL for the hero scenes. Scene sizes are compiled in as #defines, so each
// scene gets its own programs.

const TAU = Math.PI * 2;
// Every source hums at this one wavelength, in meters, so the waves interfere.
// About a quarter of the tables' spacing, so the pattern has a few broad
// interference lines rather than dozens of fine ones.
export const WAVELENGTH = 1.8;
// Meters per second the crests travel outward.
export const WAVE_SPEED = 0.8;

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
  float fadedFurniture = 1e5;
  float highlightedFurniture = 1e5;
  for (int i = 0; i < SEG_COUNT; i++) {
    float d = strokeDist(i, p);
    if (i < WALL_COUNT) walls = min(walls, d);
    else if (i < FADE_FURNITURE_START) furniture = min(furniture, d);
    else if (i < HIGHLIGHT_FURNITURE_START) fadedFurniture = min(fadedFurniture, d);
    else highlightedFurniture = min(highlightedFurniture, d);
  }
  fragColor = vec4(
    coverage(walls),
    coverage(furniture),
    coverage(fadedFurniture),
    coverage(highlightedFurniture)
  );
}
`;

// Scene space, drawn once per scene. Every source hums at the same
// wavelength, so all of its paths to a point (direct, and reflected once off
// each wall) sum into one complex amplitude: its length is the pressure
// amplitude there, its angle the phase. Each pass bakes two sources, one per
// RG and BA pair. Everything here is static, so frames only have to rotate
// each source's amplitude by its current phase and add them up.
export const FIELD_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
${SEGMENTS}
uniform vec4 uSourceBox[SOURCE_SLOTS]; // center.xy, half size
uniform float uSourceRounding[SOURCE_SLOTS];
uniform vec2 uWorldMin;
uniform vec2 uWorldSize;
in vec2 vUv;
out vec4 fragColor;

const int STEP_COUNT = 128;
const float MIN_HIT_DIST = 0.01;
const float MAX_TRACE_DIST = 0.4;
const float SHADOW_SOFTNESS = 0.3; // the lower, the sharper
const float WAVENUMBER = ${(TAU / WAVELENGTH).toFixed(6)};
// Share of the pressure a wall reflects. Library partitions are usually
// treated with absorbing panels, which take about 90% of the intensity.
const float REFLECTION = 0.3;
// Meters around a wall's end over which its reflection fades in, standing in
// for diffraction at the edge.
const float EDGE = 0.6;

float sourceDist(vec2 p, int i) {
  float r = uSourceRounding[i];
  vec2 q = abs(p - uSourceBox[i].xy) - uSourceBox[i].zw + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 towardSource(vec2 p, int i) {
  vec2 e = vec2(0.01, 0.0);
  return -normalize(vec2(
    sourceDist(p + e.xy, i) - sourceDist(p - e.xy, i),
    sourceDist(p + e.yx, i) - sourceDist(p - e.yx, i)
  ));
}

float wallDistExcept(vec2 p, int skip) {
  float d = 1e5;
  for (int i = 0; i < WALL_COUNT; i++) {
    if (i != skip) d = min(d, strokeDist(i, p));
  }
  return d;
}

// Soft shadow, sphere tracing from p along dir for dist meters. A ray that
// enters a wall counts as fully blocked: the walls are too thin for the trace
// to go deep enough inside them on its own. The skipped wall is the one a
// reflection bounces off, which the ray ends at by design.
float trace(vec2 p, vec2 dir, float dist, int skip) {
  float res = 1.0;
  float t = MIN_HIT_DIST;
  for (int s = 0; s < STEP_COUNT; s++) {
    float h = wallDistExcept(p + dir * t, skip);
    if (h < 0.0) return 0.0;
    res = min(res, h / (SHADOW_SOFTNESS * t));
    t += clamp(h, MIN_HIT_DIST, MAX_TRACE_DIST);
    if (t > dist) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float heard(vec2 p, int i, int skip) {
  float dist = sourceDist(p, i);
  if (dist <= 0.0) return 1.0;
  return trace(p, towardSource(p, i), dist, skip);
}

// One path from source i: raw meters from its edge, heardBy how much gets
// past the walls. Pressure falls off as 1 / r from the source's center
// (intensity as 1 / r^2), normalized to 1 at its edge.
vec2 path(int i, float raw, float heardBy, float gain) {
  float r0 = max(uSourceBox[i].z, uSourceBox[i].w);
  float travel = max(raw, 0.0);
  float amplitude = gain * heardBy * r0 / (r0 + travel);
  return amplitude * vec2(cos(WAVENUMBER * travel), sin(WAVENUMBER * travel));
}

vec2 amplitude(vec2 p, int i) {
  if (i >= SOURCE_COUNT) return vec2(0.0);
  vec2 z = path(i, sourceDist(p, i), heard(p, i, -1), 1.0);

  // Image sources: mirroring p across a wall turns the bounced path into a
  // straight one to the real source.
  vec2 center = uSourceBox[i].xy;
  for (int j = 0; j < WALL_COUNT; j++) {
    if (uSegB[j].x > 0.0) continue;
    vec2 a = uSegA[j].xy;
    vec2 b = uSegA[j].zw;
    float len = length(b - a);
    vec2 along = (b - a) / len;
    vec2 n = vec2(-along.y, along.x);
    float face = uSegB[j].y;
    float sideP = dot(p - a, n);
    float sideS = dot(center - a, n);
    if (sideP * sideS <= 0.0 || abs(sideP) < face) continue;

    // Where the path from p to the image source crosses the wall.
    vec2 image = center - 2.0 * sideS * n;
    vec2 bounce = mix(p, image, sideP / (sideP + sideS));
    float u = dot(bounce - a, along);
    float onWall = smoothstep(-EDGE, EDGE, u) * smoothstep(-EDGE, EDGE, len - u);
    if (onWall <= 0.0) continue;

    vec2 atWall = bounce + n * sign(sideP) * (face + 0.05);
    vec2 toWall = atWall - p;
    float wallDistance = length(toWall);
    float legs = heard(atWall, i, j);
    if (wallDistance > 1e-3) legs *= trace(p, toWall / wallDistance, wallDistance, j);

    z += path(i, sourceDist(p - 2.0 * sideP * n, i), onWall * legs, REFLECTION);
  }
  // Nothing is drawn over the table that is talking.
  return z * smoothstep(0.0, 0.4, sourceDist(p, i));
}

void main() {
  vec2 p = uWorldMin + vUv * uWorldSize;
  fragColor = vec4(amplitude(p, PAIR * 2), amplitude(p, PAIR * 2 + 1));
}
`;

// Every frame: the summed pressure wave. Rings are its crests, and their
// brightness is the local intensity, so they fade out where the sources
// interfere destructively and peak where they reinforce each other.
export const COMPOSITE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uInk;
uniform sampler2D uWave0; // sources 0 and 1
uniform sampler2D uWave1; // sources 2 and 3
uniform vec2 uSpin[SOURCE_SLOTS]; // each source's gain and phase, as a complex number
uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uPx;
uniform vec2 uWorldMin;
uniform vec2 uWorldSize;
uniform vec4 uBounds; // min.xy, max.xy
uniform float uFade;
uniform vec3 uFg;
uniform vec3 uSound;
uniform vec4 uAlpha; // walls, furniture, floor grid, rings
out vec4 fragColor;

const float GAMMA = 2.2;

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
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
  float mask = (1.0 - smoothstep(0.0, uFade, outside)) * step(p.x, uBounds.z);
  if (mask <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 fromMin = p - uBounds.xy;
  vec2 fromMax = uBounds.zw - p;
  float vignette = min(
    min(smoothstep(0.0, 5.0, fromMin.x), smoothstep(0.0, 5.0, fromMin.y)),
    min(smoothstep(0.0, 5.0, fromMax.x), smoothstep(0.0, 5.0, fromMax.y))
  );

  vec2 uv = (p - uWorldMin) / uWorldSize;
  vec4 wave = texture(uWave0, uv);
  vec2 z = cmul(wave.xy, uSpin[0]) + cmul(wave.zw, uSpin[1]);
  float loudest = length(wave.xy) * length(uSpin[0]) + length(wave.zw) * length(uSpin[1]);
#if SOURCE_COUNT > 2
  wave = texture(uWave1, uv);
  z += cmul(wave.xy, uSpin[2]) + cmul(wave.zw, uSpin[3]);
  loudest += length(wave.xy) * length(uSpin[2]) + length(wave.zw) * length(uSpin[3]);
#endif

  // Shaded like a ripple tank: the pressure Re(z), relative to the most it
  // could reach here if every wave lined up. Where waves cancel it rests at
  // a neutral half tone; where they reinforce it swings between bright
  // crests and dark troughs. Brightness overall follows the loudest it gets.
  float pressure = z.x / max(loudest, 1e-6);
  float level = pow(min(loudest * loudest, 1.0), 1.0 / GAMMA);
  float ringAlpha = (0.5 + 0.5 * pressure) * level * uAlpha.w * mask * vignette;

  // A faint one-meter dot grid on the floor of the room itself.
  vec2 cell = abs(fract(p) - 0.5);
  float dotDist = length(0.5 - cell);
  float dotRadius = max(0.03, uPx * 0.6);
  float grid = (1.0 - smoothstep(dotRadius, dotRadius + uPx * 1.5, dotDist)) * uAlpha.z
    * (1.0 - smoothstep(-1.0, 0.0, outside));

  vec4 ink = texture(uInk, gl_FragCoord.xy / uRes);
  vec4 color = vec4(0.0);
  over(color, uFg, grid);
  over(color, uSound, ringAlpha);
  over(color, uFg, ink.b * uAlpha.y * mask * vignette);
  over(color, uFg, ink.g * uAlpha.y * mask);
  over(color, uFg, ink.a * min(uAlpha.y * 2.5, 0.65) * mask);
  over(color, uFg, ink.r * uAlpha.x * mask * vignette);
  fragColor = color;
}
`;

export function withDefines(source: string, defines: Record<string, number>) {
  const header = Object.entries(defines)
    .map(([name, value]) => `#define ${name} ${value}`)
    .join("\n");
  return source.replace("#version 300 es\n", `#version 300 es\n${header}\n`);
}
