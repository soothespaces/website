// GLSL for the hero scenes. Scene sizes are compiled in as #defines, so each
// scene gets its own programs.

// The baked distance is packed into two 8-bit channels, up to this many meters.
export const MAX_DISTANCE = 100;

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

// Scene space, drawn once per scene. Everything here is static, so the whole
// field is baked: the smooth-min distance to the sound sources (packed into RG)
// the sound intensity that reaches each point (B, gamma encoded) and how
// steep the distance field is there (A).
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
// How close, in meters, two fields get before they merge. Where a wall
// blocks either source the blend shrinks to nothing, so fields only merge
// where both can be heard, never through a wall.
const float BLEND = 1.6;
// How much intensity still comes through a wall.
const float LEAK = 0.06;
const float GAMMA = 2.2;

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

// Soft shadow, sphere tracing from p to the nearest point of the source.
// A ray that enters a wall counts as fully blocked: the walls are too thin
// for the trace to go deep enough inside them on its own.
float heard(vec2 p, int i) {
  float distToSource = sourceDist(p, i);
  if (distToSource <= 0.0) return 1.0;
  vec2 rayDir = towardSource(p, i);
  float res = 1.0;
  float t = MIN_HIT_DIST;
  for (int s = 0; s < STEP_COUNT; s++) {
    float h = wallDist(p + rayDir * t);
    if (h < 0.0) return 0.0;
    res = min(res, h / (SHADOW_SOFTNESS * t));
    t += clamp(h, MIN_HIT_DIST, MAX_TRACE_DIST);
    if (t > distToSource) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

vec2 encode(float d) {
  float v = floor(clamp(d / ${MAX_DISTANCE.toFixed(1)}, 0.0, 1.0) * 65535.0 + 0.5);
  float high = floor(v / 256.0);
  return vec2(high, v - high * 256.0) / 255.0;
}

void main() {
  vec2 p = uWorldMin + vUv * uWorldSize;
  float d = 1e4;
  float shadow = 1.0;
  vec2 grad = vec2(0.0);
  float intensity = 0.0;
  for (int i = 0; i < SOURCE_COUNT; i++) {
    float raw = sourceDist(p, i);
    float di = max(raw, 0.0);
    float si = heard(p, i);
    vec2 gi = raw > 0.0 ? -towardSource(p, i) : vec2(0.0);
    // Polynomial smooth min; the same weight blends the shadows and the
    // gradients (the smooth min's gradient is exactly that blend).
    float k = max(BLEND * si * shadow, 1e-3);
    float h = clamp(0.5 + 0.5 * (d - di) / k, 0.0, 1.0);
    d = mix(d, di, h) - k * h * (1.0 - h);
    shadow = mix(shadow, si, h);
    grad = mix(grad, gi, h);

    // Inverse square law, measured from the source's center and normalized
    // to 1 at its edge. Uncorrelated sources add intensities.
    float r0 = max(uSourceBox[i].z, uSourceBox[i].w);
    float spread = r0 / (r0 + di);
    intensity += spread * spread * mix(LEAK, 1.0, si);
  }
  fragColor = vec4(
    encode(max(d, 0.0)),
    pow(clamp(intensity, 0.0, 1.0), 1.0 / GAMMA),
    min(length(grad), 1.0)
  );
}
`;

// Every frame: the baked field's contour lines, moving outward over time.
export const COMPOSITE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uInk;
uniform highp sampler2D uField;
uniform vec2 uFieldSize;
uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uPx;
uniform vec2 uWorldMin;
uniform vec2 uWorldSize;
uniform vec4 uBounds; // min.xy, max.xy
uniform float uFade;
uniform float uTime;
uniform vec3 uFg;
uniform vec3 uSound;
uniform vec4 uAlpha; // walls, furniture, floor grid, rings
out vec4 fragColor;

const float SPACING = 0.7; // meters between rings
const float SPEED = 0.55; // meters per second
const float RING_WIDTH = 0.03;

float hash(float n) {
  return fract(sin(n * 91.3458) * 47453.5453);
}

vec3 texel(ivec2 c) {
  vec4 t = texelFetch(uField, clamp(c, ivec2(0), ivec2(uFieldSize) - 1), 0) * 255.0;
  return vec3((t.x * 256.0 + t.y) / 65535.0 * ${MAX_DISTANCE.toFixed(1)}, t.zw / 255.0);
}

// Bilinear filtering by hand, since the packed bytes can't be filtered.
vec3 field(vec2 p) {
  vec2 st = (p - uWorldMin) / uWorldSize * uFieldSize - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  ivec2 c = ivec2(i);
  vec3 a = texel(c);
  vec3 b = texel(c + ivec2(1, 0));
  vec3 d = texel(c + ivec2(0, 1));
  vec3 e = texel(c + ivec2(1, 1));
  return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
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

  vec3 sample_ = field(p);
  float d = sample_.x;
  // Already gamma encoded, so linear intensity reads as perceived brightness.
  float level = sample_.y;
  // Where the fields meet, the smooth min flattens out, so a fixed band of
  // distance would cover more floor there and smear into a blob.
  float slope = max(sample_.z, 0.05);
  vec2 fromMin = p - uBounds.xy;
  vec2 fromMax = uBounds.zw - p;
  float vignette = min(
    min(smoothstep(0.0, 5.0, fromMin.x), smoothstep(0.0, 5.0, fromMin.y)),
    min(smoothstep(0.0, 5.0, fromMax.x), smoothstep(0.0, 5.0, fromMax.y))
  );

  float x = d / SPACING - uTime * (SPEED / SPACING);
  float ring = floor(x + 0.5);
  float fromRing = abs(x - ring) * SPACING / slope; // meters of floor
  float halfWidth = max(RING_WIDTH, uPx * 0.6);
  float line = 1.0 - smoothstep(halfWidth, halfWidth + uPx * 1.2, fromRing);

  float strength = mix(0.6, 1.0, hash(ring + 17.0));
  float ringAlpha = line * strength * smoothstep(0.0, 0.4, d) * level
    * uAlpha.w * mask * vignette;

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
