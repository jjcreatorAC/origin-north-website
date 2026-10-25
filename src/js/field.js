import { gsap, ScrollTrigger, reduceMotion, scrollTop } from './core.js';
import { onPaletteChange } from './palette.js';

/*
  The halftone field behind the whole page.

  The dots sit on a layer that drifts up with the page at a slower pace, so
  the field reads as a surface behind the content rather than a pattern
  sliding across the screen. The surface behaves like water: a soft glow
  glides after the pointer, and as the pointer moves it drops ripples that
  run outward and fade, leaving a wake. Clicks drop a stone.

  Pass 1 turns slow noise, the glow and the ripples into one size per dot, in
  a texture with one pixel per dot. Pass 2 draws round dots from that texture.

  It runs on GSAP's ticker, after Lenis has moved the page, and never reads
  the page itself, so it adds no layout work to a frame.
*/

const RINGS = 12;
const PARALLAX = 0.32; // the dot layer moves at about a third of the page's speed
const RING_SPEED = 22; // cells per second, about 260 px/s on desktop
const RING_LIFE = 1.4; // seconds
const SPRING = 90; // the glow follows the pointer on a critically damped spring
const IDLE_FRAME = 1 / 24; // the slow drift alone needs only a few frames a second

const QUAD = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const SIZES = `
precision highp float;
#define RINGS ${RINGS}
uniform float uRows;
uniform float uTime;
uniform vec2 uShift;
uniform vec3 uGlow;
uniform vec4 uRings[RINGS];

// 2D simplex noise by Ian McEwan and Stefan Gustavson (MIT).
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  // Texel row r holds the dot in screen slot r - 1. The layer has moved uShift.x
  // whole cells and uShift.y of a cell, so that dot's centre sits uShift.y higher.
  vec2 slot = gl_FragCoord.xy - vec2(0.5, 1.5);
  vec2 screen = slot + vec2(0.5, 0.5 + uShift.y);
  vec2 q = (slot + 0.5 - vec2(0.0, uShift.x)) / uRows;
  float t = uTime * 0.035;

  float n = snoise(q * 1.1 + vec2(0.0, -t)) * 0.62 + snoise(q * 2.7 + vec2(t * 0.5, -t * 1.5)) * 0.38;
  float base = smoothstep(-0.1, 0.95, n);

  vec2 d = (screen - uGlow.xy) / uRows;
  float glow = uGlow.z * 0.6 * exp(-dot(d, d) * 46.0);

  // Each ripple is a short wave packet riding outward on its ring, fading as it spreads.
  float wave = 0.0;
  for (int i = 0; i < RINGS; i++) {
    vec4 r = uRings[i];
    if (r.w <= 0.0) continue;
    float radius = r.z * ${RING_SPEED.toFixed(1)};
    float x = length(screen - r.xy) - radius;
    wave += r.w * exp(-r.z * 1.8) / (1.0 + radius * 0.035) * sin(x * 1.1) * exp(-x * x * 0.07);
  }

  float size = max(base, glow) + wave;
  gl_FragColor = vec4(clamp(size, 0.0, 1.0), clamp(max(glow, abs(wave) * 1.6), 0.0, 1.0), 0.0, 1.0);
}
`;

const DOTS = `
precision highp float;
uniform sampler2D uSizes;
uniform vec2 uGrid;
uniform float uCell;
uniform float uFrac;
uniform vec3 uColor;
uniform vec3 uAccent;

void main() {
  vec2 pos = gl_FragCoord.xy / uCell - vec2(0.0, uFrac);
  vec2 slot = floor(pos);
  vec4 cell = texture2D(uSizes, (slot + vec2(0.5, 1.5)) / uGrid);
  float r = cell.r * uCell * 0.44;
  float a = (1.0 - smoothstep(r - 0.8, r + 0.8, length(pos - slot - 0.5) * uCell)) * step(0.75, r);
  gl_FragColor = vec4(mix(uColor, uAccent, cell.g) * a, a);
}
`;

function program(gl, fragment) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed to compile');
    return shader;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, QUAD));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Program failed to link');
  return p;
}

const uniformsOf = (gl, p, names) => Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(p, name)]));

export function initField() {
  const canvas = document.querySelector('[data-field]');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) {
    canvas.remove();
    return;
  }

  let sizesProgram;
  let dotsProgram;
  try {
    sizesProgram = program(gl, SIZES);
    dotsProgram = program(gl, DOTS);
  } catch (error) {
    console.warn('[field]', error);
    canvas.remove();
    return;
  }

  const su = uniformsOf(gl, sizesProgram, ['uRows', 'uTime', 'uShift', 'uGlow', 'uRings']);
  const du = uniformsOf(gl, dotsProgram, ['uSizes', 'uGrid', 'uCell', 'uFrac', 'uColor', 'uAccent']);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const sizes = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sizes);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();

  const still = reduceMotion();
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, glow: 0, glowTarget: 0, travelled: 0, seen: false };
  // Ripples live on the moving layer: position in layer cells, birth time and strength.
  const rings = Array.from({ length: RINGS }, () => ({ x: 0, y: 0, born: -Infinity, strength: 0 }));
  const ringData = new Float32Array(RINGS * 4);
  const dotColor = new Float32Array(3);
  const accentColor = new Float32Array(3);
  let nextRing = 0;
  let dpr = 1;
  let cell = 12;
  let cols = 1;
  let rows = 1;
  let clock = 0;
  let layer = 0;
  let rippling = false;
  let sinceDraw = 0;
  let covered = false;
  let dirty = true;

  const resize = () => {
    // The dots are soft, so 1.5 device pixels per CSS pixel is plenty, even on sharper screens.
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    cell = (window.innerWidth < 768 ? 10 : 12) * dpr;
    cols = Math.ceil(canvas.width / cell);
    rows = Math.ceil(canvas.height / cell);
    // One spare row below the screen for dots that are sliding in.
    gl.bindTexture(gl.TEXTURE_2D, sizes);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows + 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sizes, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    dirty = true;
  };

  // Pointer positions are kept in dot units, origin bottom-left like the GPU.
  const toCells = (clientX, clientY) => [(clientX * dpr) / cell, (canvas.height - clientY * dpr) / cell];

  const ripple = (x, y, strength, delay = 0) => {
    Object.assign(rings[nextRing], { x, y: y - layer, born: clock + delay, strength });
    nextRing = (nextRing + 1) % RINGS;
  };

  const draw = () => {
    const whole = Math.floor(layer);
    rippling = false;
    for (let i = 0; i < RINGS; i++) {
      const ring = rings[i];
      const age = clock - ring.born;
      const alive = age < RING_LIFE;
      if (alive) rippling = true;
      ringData[i * 4] = ring.x;
      ringData[i * 4 + 1] = ring.y + layer;
      ringData[i * 4 + 2] = alive ? age : 0;
      // Rings dropped with a delay wait at zero strength until their moment comes.
      ringData[i * 4 + 3] = alive && age >= 0 ? ring.strength : 0;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, cols, rows + 1);
    gl.useProgram(sizesProgram);
    gl.uniform1f(su.uRows, rows);
    gl.uniform1f(su.uTime, clock);
    gl.uniform2f(su.uShift, whole, layer - whole);
    gl.uniform3f(su.uGlow, pointer.x, pointer.y, pointer.glow);
    gl.uniform4fv(su.uRings, ringData);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(dotsProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sizes);
    gl.uniform1i(du.uSizes, 0);
    gl.uniform2f(du.uGrid, cols, rows + 1);
    gl.uniform1f(du.uCell, cell);
    gl.uniform1f(du.uFrac, layer - whole);
    gl.uniform3fv(du.uColor, dotColor);
    gl.uniform3fv(du.uAccent, accentColor);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    dirty = false;
    sinceDraw = 0;
  };

  const tick = (time, deltaTime) => {
    if (document.hidden || covered) return;
    const dt = Math.min(deltaTime, 50) / 1000;

    // The dot layer follows the page at a slower pace.
    const previous = layer;
    layer = still ? 0 : (scrollTop() * dpr * PARALLAX) / cell;
    if (layer !== previous) dirty = true;

    let active = false;
    if (!still && dt) {
      clock += dt;

      // The glow glides after the pointer and fades in and out with it.
      const damper = 2 * Math.sqrt(SPRING);
      pointer.vx += (SPRING * (pointer.tx - pointer.x) - damper * pointer.vx) * dt;
      pointer.vy += (SPRING * (pointer.ty - pointer.y) - damper * pointer.vy) * dt;
      pointer.x += pointer.vx * dt;
      pointer.y += pointer.vy * dt;
      pointer.glow += (pointer.glowTarget - pointer.glow) * (1 - Math.exp(-dt * 4));

      // Moving drops a ripple every few cells. Faster moves space them further
      // apart and make them stronger, so a quick sweep stays clean, not busy.
      const speed = Math.hypot(pointer.vx, pointer.vy);
      if (pointer.glow > 0.05 && speed > 0.5) {
        pointer.travelled += speed * dt;
        if (pointer.travelled > Math.max(4.5, (speed * RING_LIFE) / RINGS)) {
          pointer.travelled = 0;
          ripple(pointer.x, pointer.y, pointer.glow * Math.min(0.75, 0.25 + speed / 120));
        }
      }

      active = rippling || speed > 0.05 || Math.abs(pointer.glow - pointer.glowTarget) > 0.01;
    }

    sinceDraw += dt;
    if (dirty || active || (!still && sinceDraw > IDLE_FRAME)) draw();
  };

  onPaletteChange(({ dot, accent }) => {
    dot.forEach((c, i) => (dotColor[i] = c / 255));
    accent.forEach((c, i) => (accentColor[i] = c / 255));
    dirty = true;
  });

  new ResizeObserver(resize).observe(canvas);
  resize();
  gsap.ticker.add(tick);

  // Nothing to draw while the dark footer covers the screen.
  const footer = document.querySelector('[data-footer]');
  if (footer) ScrollTrigger.create({ trigger: footer, start: 'top top', refreshPriority: -1, onToggle: (self) => (covered = self.isActive) });

  if (still) return;

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      [pointer.tx, pointer.ty] = toCells(event.clientX, event.clientY);
      if (!pointer.seen) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        pointer.seen = true;
      }
      pointer.glowTarget = 1;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => (pointer.glowTarget = 0));

  // A click or tap drops a stone: three rings in quick succession.
  window.addEventListener(
    'pointerdown',
    (event) => {
      const [x, y] = toCells(event.clientX, event.clientY);
      [0, 0.14, 0.3].forEach((delay, i) => ripple(x, y, 1.3 - i * 0.3, delay));
    },
    { passive: true },
  );

  canvas.addEventListener('webglcontextlost', (event) => event.preventDefault());
}
