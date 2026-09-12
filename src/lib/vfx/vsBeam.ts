/**
 * VsBeam — Self-Contained WebGL2/Canvas/CSS Energy Beam Component (Chevron + Starburst)
 *
 * Requirements:
 * - Zero external assets, images, videos, fonts, or third-party libraries.
 * - 3 Layers: Pure CSS Glow, WebGL Fragment Shader (Two Chevron Wedges + Central Starburst), 2D Canvas Sparks.
 * - Score-driven API with smooth ~500ms lerp and lead-change spark burst.
 * - Mobile-first: sustained 60fps, 0.5-0.75x DPR resolution scale, zero-allocation rAF loop.
 * - Fallback to CSS linear-gradient if WebGL unavailable.
 * - Respects prefers-reduced-motion and document.visibilitychange / IntersectionObserver.
 */

export interface VsBeamOptions {
  humanColor?: string;
  humanCore?: string;
  aiColor?: string;
  aiCore?: string;
  resolutionScale?: number;
  sparkBudget?: number;
  onSplitChange?: (split: number) => void;
}

export interface VsBeamInstance {
  setScore: (humansTotal: number, aiTotal: number) => void;
  setPaused: (paused: boolean) => void;
  destroy: () => void;
  getCurrentSplit: () => number;
}

export const SPLIT_MIN = 0.15;
export const SPLIT_MAX = 0.85;
const DEFAULT_HUMAN_COLOR = '#ff8c1a';
const DEFAULT_HUMAN_CORE = '#ffd9a0';
const DEFAULT_AI_COLOR = '#4d6bff';
const DEFAULT_AI_CORE = '#a0b8ff';
const LERP_DURATION_MS = 500;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  isHuman: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export function createVsBeam(
  container: HTMLElement,
  options: VsBeamOptions = {}
): VsBeamInstance {
  const humanColorHex = options.humanColor || DEFAULT_HUMAN_COLOR;
  const humanCoreHex = options.humanCore || DEFAULT_HUMAN_CORE;
  const aiColorHex = options.aiColor || DEFAULT_AI_COLOR;
  const aiCoreHex = options.aiCore || DEFAULT_AI_CORE;

  const humanColor = hexToRgb(humanColorHex);
  const humanCore = hexToRgb(humanCoreHex);
  const aiColor = hexToRgb(aiColorHex);
  const aiCore = hexToRgb(aiCoreHex);

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const sparkBudget = options.sparkBudget || (isTouch ? 100 : 200);
  let resScale = options.resolutionScale || (isTouch ? 0.6 : 0.75);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  container.style.position = 'relative';
  container.style.overflow = 'visible';

  // ---------------------------------------------------------------------------
  // LAYER 1: PURE CSS GLOW (No filter: blur() for mobile GPU friendliness)
  // ---------------------------------------------------------------------------
  const glowLayer = document.createElement('div');
  glowLayer.style.position = 'absolute';
  glowLayer.style.inset = '-16px 0';
  glowLayer.style.pointerEvents = 'none';
  glowLayer.style.background = `radial-gradient(ellipse 65% 50% at 50% 50%, rgba(255, 140, 26, 0.25) 0%, rgba(77, 107, 255, 0.25) 100%)`;
  glowLayer.style.boxShadow = `0 0 24px rgba(0, 0, 0, 0.7)`;
  container.appendChild(glowLayer);

  // ---------------------------------------------------------------------------
  // LAYER 2: BEAM CANVAS (WebGL2 with WebGL1 fallback)
  // ---------------------------------------------------------------------------
  const beamCanvas = document.createElement('canvas');
  beamCanvas.style.position = 'absolute';
  beamCanvas.style.inset = '0';
  beamCanvas.style.width = '100%';
  beamCanvas.style.height = '100%';
  beamCanvas.style.display = 'block';
  beamCanvas.style.pointerEvents = 'none';
  container.appendChild(beamCanvas);

  // ---------------------------------------------------------------------------
  // LAYER 3: SPARKS CANVAS (2D Canvas Overlay)
  // ---------------------------------------------------------------------------
  const sparksCanvas = document.createElement('canvas');
  sparksCanvas.style.position = 'absolute';
  sparksCanvas.style.inset = '0';
  sparksCanvas.style.width = '100%';
  sparksCanvas.style.height = '100%';
  sparksCanvas.style.display = 'block';
  sparksCanvas.style.pointerEvents = 'none';
  container.appendChild(sparksCanvas);

  const sparksCtx = sparksCanvas.getContext('2d');
  let cssFallbackEl: HTMLElement | null = null;

  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let isWebGL2 = false;

  try {
    gl = beamCanvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (gl) isWebGL2 = true;
    else gl = beamCanvas.getContext('webgl', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
  } catch {
    gl = null;
  }

  // GLSL Shader Code — Chevron Wedges + Starburst
  const vsSource = isWebGL2
    ? `#version 300 es
      in vec2 aPosition;
      out vec2 vUv;
      void main() {
        vUv = (aPosition + 1.0) * 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }`
    : `attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = (aPosition + 1.0) * 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }`;

  const fsBody = `
    uniform float uSplit;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uHumanColor;
    uniform vec3 uHumanCore;
    uniform vec3 uAiColor;
    uniform vec3 uAiCore;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / max(uResolution.y, 1.0);
      float dY = abs(uv.y - 0.5);

      // Beam vertical bounds
      float halfH = 0.32;
      float beamMask = smoothstep(halfH + 0.05, halfH - 0.03, dY);

      // Chevron pointed tips meeting at uSplit
      float gap = 0.024;
      float chevronSlope = 0.042;
      float slopeOffset = (1.0 - (dY / halfH)) * chevronSlope;

      // Left human wedge edge (points right)
      float edgeLeft = (uSplit - gap * 0.5) + slopeOffset;
      // Right AI wedge edge (points left)
      float edgeRight = (uSplit + gap * 0.5) - slopeOffset;

      // Noise shimmer on boundary
      float nShimmer = (noise(vec2(uv.y * 12.0, uTime * 6.0)) - 0.5) * 0.016;
      edgeLeft += nShimmer;
      edgeRight += nShimmer;

      // Hot core line along vertical center
      float core = pow(clamp(1.0 - (dY / 0.16), 0.0, 1.0), 2.6);
      float flicker = 0.92 + 0.08 * sin(uTime * 20.0 + uv.x * 30.0);

      // Human wedge (left)
      float humanMask = (1.0 - smoothstep(edgeLeft - 0.012, edgeLeft + 0.012, uv.x)) * beamMask;
      vec3 humanBase = mix(uHumanColor, uHumanCore, core * flicker);
      // Top bevel highlight
      humanBase += vec3(0.35, 0.25, 0.1) * smoothstep(halfH, halfH - 0.06, uv.y - 0.5 + halfH);

      // AI wedge (right)
      float aiMask = smoothstep(edgeRight - 0.012, edgeRight + 0.012, uv.x) * beamMask;
      vec3 aiBase = mix(uAiColor, uAiCore, core * flicker);
      // Top bevel highlight
      aiBase += vec3(0.2, 0.3, 0.45) * smoothstep(halfH, halfH - 0.06, uv.y - 0.5 + halfH);

      vec3 finalColor = humanBase * humanMask + aiBase * aiMask;
      float finalAlpha = clamp(humanMask + aiMask, 0.0, 1.0);

      // =======================================================================
      // STARBURST COLLISION FLASH (IN THE GAP)
      // =======================================================================
      vec2 clashCenter = vec2(uSplit, 0.5);
      vec2 delta = (uv - clashCenter) * vec2(aspect, 1.0);
      float r = length(delta);
      float angle = atan(delta.y, delta.x);

      // 10-12 dynamic light rays
      float nRay = noise(vec2(angle * 2.5, uTime * 1.5));
      float rayWaves = sin(angle * 10.0 + uTime * 4.0 + nRay * 3.5);
      float rayIntensity = pow(clamp(rayWaves * 0.5 + 0.5, 0.0, 1.0), 3.5);
      float rayFade = exp(-r * 7.5);

      // Pure white hot center core
      float coreBurst = exp(-r * 22.0) * 1.6;
      float ambientBurst = exp(-r * 4.5) * 0.55;

      // Tint rays: warm on left (delta.x < 0), cool on right (delta.x > 0)
      vec3 warmRay = mix(uHumanCore, vec3(1.0, 0.85, 0.4), 0.6);
      vec3 coolRay = mix(uAiCore, vec3(0.5, 0.85, 1.0), 0.6);
      vec3 rayTint = mix(warmRay, coolRay, smoothstep(-0.06, 0.06, delta.x));

      vec3 starburst = vec3(1.0) * coreBurst + rayTint * (rayIntensity * rayFade * 2.2 + ambientBurst);
      float burstAlpha = clamp(coreBurst + rayFade * rayIntensity * 1.5 + ambientBurst * 0.8, 0.0, 1.0);

      finalColor += starburst;
      finalAlpha = clamp(finalAlpha + burstAlpha, 0.0, 1.0);
  `;

  const fsSource = isWebGL2
    ? `#version 300 es
      precision mediump float;
      in vec2 vUv;
      out vec4 fragColor;
      ${fsBody}
      fragColor = vec4(finalColor * finalAlpha, finalAlpha);
    }`
    : `precision mediump float;
      varying vec2 vUv;
      ${fsBody}
      gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
    }`;

  let uSplitLoc: WebGLUniformLocation | null = null;
  let uTimeLoc: WebGLUniformLocation | null = null;
  let uResolutionLoc: WebGLUniformLocation | null = null;

  if (gl) {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl = null;
    } else {
      gl.useProgram(program);
      uSplitLoc = gl.getUniformLocation(program, 'uSplit');
      uTimeLoc = gl.getUniformLocation(program, 'uTime');
      uResolutionLoc = gl.getUniformLocation(program, 'uResolution');

      gl.uniform3fv(gl.getUniformLocation(program, 'uHumanColor'), humanColor);
      gl.uniform3fv(gl.getUniformLocation(program, 'uHumanCore'), humanCore);
      gl.uniform3fv(gl.getUniformLocation(program, 'uAiColor'), aiColor);
      gl.uniform3fv(gl.getUniformLocation(program, 'uAiCore'), aiCore);

      const aPosLoc = gl.getAttribLocation(program, 'aPosition');
      const quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
    }
  }

  // Fallback if WebGL unavailable
  if (!gl) {
    beamCanvas.style.display = 'none';
    cssFallbackEl = document.createElement('div');
    cssFallbackEl.style.position = 'absolute';
    cssFallbackEl.style.inset = '0';
    cssFallbackEl.style.borderRadius = '9999px';
    cssFallbackEl.style.background = `linear-gradient(90deg, ${humanColorHex} 0%, ${humanColorHex} calc(var(--split, 50%) - 15px), #ffffff calc(var(--split, 50%)), ${aiColorHex} calc(var(--split, 50%) + 15px), ${aiColorHex} 100%)`;
    container.appendChild(cssFallbackEl);
  }

  // Particle System Pool
  const particles: Particle[] = new Array(sparkBudget);
  for (let i = 0; i < sparkBudget; i++) {
    particles[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, isHuman: true };
  }

  function spawnParticle(x: number, y: number, isBurst = false) {
    for (let i = 0; i < sparkBudget; i++) {
      if (particles[i].life <= 0) {
        const isHuman = Math.random() < 0.5;
        const speed = isBurst ? 2.5 + Math.random() * 5.0 : 1.2 + Math.random() * 3.0;
        const angle = isHuman ? Math.PI + (Math.random() - 0.5) * 1.8 : (Math.random() - 0.5) * 1.8;

        particles[i].x = x;
        particles[i].y = y + (Math.random() - 0.5) * 14;
        particles[i].vx = Math.cos(angle) * speed;
        particles[i].vy = Math.sin(angle) * speed;
        particles[i].maxLife = 350 + Math.random() * 450;
        particles[i].life = particles[i].maxLife;
        particles[i].size = 1.5 + Math.random() * 2.5;
        particles[i].isHuman = isHuman;
        return;
      }
    }
  }

  function fireBurst(x: number, y: number, count = 35) {
    for (let i = 0; i < count; i++) {
      spawnParticle(x, y, true);
    }
  }

  let currentSplit = 0.5;
  let targetSplit = 0.5;
  let startSplit = 0.5;
  let lerpStartTime = 0;
  let isLerping = false;
  let prevLeadHuman: boolean | null = null;

  let width = container.clientWidth || 300;
  let height = container.clientHeight || 50;
  let isVisible = true;
  let isPaused = false;
  let rAFId = 0;
  let lastTime = performance.now();

  function updateDimensions() {
    width = container.clientWidth;
    height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const internalW = Math.max(64, Math.floor(width * dpr * resScale));
    const internalH = Math.max(16, Math.floor(height * dpr * resScale));

    if (gl) {
      if (beamCanvas.width !== internalW || beamCanvas.height !== internalH) {
        beamCanvas.width = internalW;
        beamCanvas.height = internalH;
        gl.viewport(0, 0, internalW, internalH);
        gl.uniform2f(uResolutionLoc, internalW, internalH);
      }
    }

    if (sparksCanvas.width !== width || sparksCanvas.height !== height) {
      sparksCanvas.width = width;
      sparksCanvas.height = height;
    }
  }

  function loop(now: number) {
    if (!isVisible || isPaused) {
      rAFId = 0;
      return;
    }

    const dt = now - lastTime;
    lastTime = now;

    if (isLerping) {
      const elapsed = now - lerpStartTime;
      const progress = Math.min(1.0, elapsed / LERP_DURATION_MS);
      const ease = 1 - Math.pow(1 - progress, 3);
      currentSplit = startSplit + (targetSplit - startSplit) * ease;
      if (options.onSplitChange) options.onSplitChange(currentSplit);
      if (progress >= 1.0) {
        currentSplit = targetSplit;
        isLerping = false;
      }
    }

    const clashX = currentSplit * width;
    const clashY = height * 0.5;

    if (gl && program) {
      gl.uniform1f(uSplitLoc, currentSplit);
      gl.uniform1f(uTimeLoc, reducedMotion ? 0.0 : now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (cssFallbackEl) {
      cssFallbackEl.style.setProperty('--split', `${Math.round(currentSplit * 100)}%`);
    }

    if (sparksCtx && !reducedMotion) {
      sparksCtx.clearRect(0, 0, width, height);
      sparksCtx.globalCompositeOperation = 'lighter';

      if (Math.random() < 0.45) {
        spawnParticle(clashX, clashY);
      }

      for (let i = 0; i < sparkBudget; i++) {
        const p = particles[i];
        if (p.life > 0) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= dt;
          const ratio = Math.max(0, p.life / p.maxLife);
          sparksCtx.fillStyle = p.isHuman
            ? `rgba(255, 180, 50, ${ratio})`
            : `rgba(80, 160, 255, ${ratio})`;
          sparksCtx.beginPath();
          sparksCtx.arc(p.x, p.y, p.size * ratio, 0, Math.PI * 2);
          sparksCtx.fill();
        }
      }
    }

    rAFId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!rAFId && isVisible && !isPaused) {
      lastTime = performance.now();
      rAFId = requestAnimationFrame(loop);
    }
  }

  const resizeObserver = new ResizeObserver(() => updateDimensions());
  resizeObserver.observe(container);

  const intersectionObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    isVisible = entry.isIntersecting && !document.hidden;
    if (isVisible) startLoop();
  });
  intersectionObserver.observe(container);

  const onVis = () => {
    isVisible = !document.hidden;
    if (isVisible) startLoop();
  };
  document.addEventListener('visibilitychange', onVis);

  updateDimensions();
  startLoop();

  return {
    setScore(humansTotal: number, aiTotal: number) {
      const total = humansTotal + aiTotal;
      let rawSplit = total <= 0 ? 0.5 : humansTotal / total;
      const clamped = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, rawSplit));

      const isHumanLeading = clamped >= 0.5;
      if (prevLeadHuman !== null && prevLeadHuman !== isHumanLeading) {
        fireBurst(currentSplit * width, height * 0.5, 35);
      }
      prevLeadHuman = isHumanLeading;

      if (Math.abs(clamped - targetSplit) > 0.001) {
        startSplit = currentSplit;
        targetSplit = clamped;
        lerpStartTime = performance.now();
        isLerping = true;
      }
    },

    setPaused(paused: boolean) {
      isPaused = paused;
      if (!isPaused) startLoop();
    },

    destroy() {
      if (rAFId) cancelAnimationFrame(rAFId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        gl = null;
      }
      beamCanvas.remove();
      sparksCanvas.remove();
      glowLayer.remove();
      if (cssFallbackEl) cssFallbackEl.remove();
    },

    getCurrentSplit() {
      return currentSplit;
    },
  };
}
