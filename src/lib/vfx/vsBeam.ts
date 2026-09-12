/**
 * VsBeam — Self-Contained WebGL2/Canvas/CSS Energy Beam Component
 *
 * Requirements:
 * - Zero external assets, images, videos, fonts, or third-party libraries.
 * - 3 Layers: Pure CSS Glow, WebGL Fragment Shader Beam, 2D Canvas Particle Sparks.
 * - Score-driven API with smooth ~500ms lerp and lead-change spark burst.
 * - Mobile-first: <30KB, sustained 60fps, 0.5-0.75x DPR resolution scale, zero-allocation rAF loop.
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
}

export interface VsBeamInstance {
  setScore: (humansTotal: number, aiTotal: number) => void;
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}

// Named Constants
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

  // Root wrapper
  container.style.position = 'relative';
  container.style.overflow = 'visible';

  // ---------------------------------------------------------------------------
  // LAYER 1: PURE CSS GLOW (No filter: blur() for mobile GPU friendliness)
  // ---------------------------------------------------------------------------
  const glowLayer = document.createElement('div');
  glowLayer.style.position = 'absolute';
  glowLayer.style.inset = '-18px -8px';
  glowLayer.style.pointerEvents = 'none';
  glowLayer.style.borderRadius = '9999px';
  glowLayer.style.background = `radial-gradient(ellipse 65% 50% at 50% 50%, rgba(255, 140, 26, 0.22) 0%, rgba(77, 107, 255, 0.22) 100%)`;
  glowLayer.style.boxShadow = `0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 15px rgba(255, 255, 255, 0.15)`;
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

  // Fallback CSS element if WebGL is unavailable
  let cssFallbackEl: HTMLElement | null = null;

  // WebGL Context & Shaders
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

  // GLSL Shader Code
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

  const fsSource = isWebGL2
    ? `#version 300 es
      precision mediump float;
      in vec2 vUv;
      out vec4 fragColor;
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
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.55 * noise(p);
        p = p * 2.05 + vec2(1.3, -2.1);
        v += 0.30 * noise(p);
        p = p * 2.1;
        v += 0.15 * noise(p);
        return v;
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        
        // Electric noise boundary
        float edgeNoise = (fbm(vec2(uv.y * 7.0, uTime * 4.0)) - 0.5) * 0.09;
        float edge = uSplit + edgeNoise;

        // Vertical envelope & hot core
        float dY = abs(uv.y - 0.5);
        float envelope = smoothstep(0.48, 0.05, dY);
        float core = pow(smoothstep(0.20, 0.0, dY), 2.8);
        float flicker = 0.92 + 0.08 * sin(uTime * 18.0 + uv.x * 25.0);

        // Sides
        float side = smoothstep(edge - 0.02, edge + 0.02, uv.x);
        vec3 humanShade = mix(uHumanColor, uHumanCore, core * flicker);
        vec3 aiShade = mix(uAiColor, uAiCore, core * flicker);
        vec3 color = mix(humanShade, aiShade, side);

        // Clash Point Burst
        vec2 clashPt = vec2(edge, 0.5);
        vec2 delta = (uv - clashPt) * vec2(aspect, 1.0);
        float dist = length(delta);
        float clashFlash = exp(-dist * 14.0) * (0.85 + 0.15 * sin(uTime * 28.0));
        float clashWide = exp(-dist * 4.5) * 0.45;
        vec3 flashColor = vec3(1.0, 1.0, 1.0) * clashFlash + mix(uHumanCore, uAiCore, 0.5) * clashWide;
        color += flashColor;

        float alpha = clamp(envelope * (0.65 + core * 0.35) + clashFlash * 0.9, 0.0, 1.0);
        fragColor = vec4(color * alpha, alpha);
      }`
    : `precision mediump float;
      varying vec2 vUv;
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
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.55 * noise(p);
        p = p * 2.05 + vec2(1.3, -2.1);
        v += 0.30 * noise(p);
        p = p * 2.1;
        v += 0.15 * noise(p);
        return v;
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        float edgeNoise = (fbm(vec2(uv.y * 7.0, uTime * 4.0)) - 0.5) * 0.09;
        float edge = uSplit + edgeNoise;

        float dY = abs(uv.y - 0.5);
        float envelope = smoothstep(0.48, 0.05, dY);
        float core = pow(smoothstep(0.20, 0.0, dY), 2.8);
        float flicker = 0.92 + 0.08 * sin(uTime * 18.0 + uv.x * 25.0);

        float side = smoothstep(edge - 0.02, edge + 0.02, uv.x);
        vec3 humanShade = mix(uHumanColor, uHumanCore, core * flicker);
        vec3 aiShade = mix(uAiColor, uAiCore, core * flicker);
        vec3 color = mix(humanShade, aiShade, side);

        vec2 clashPt = vec2(edge, 0.5);
        vec2 delta = (uv - clashPt) * vec2(aspect, 1.0);
        float dist = length(delta);
        float clashFlash = exp(-dist * 14.0) * (0.85 + 0.15 * sin(uTime * 28.0));
        float clashWide = exp(-dist * 4.5) * 0.45;
        vec3 flashColor = vec3(1.0, 1.0, 1.0) * clashFlash + mix(uHumanCore, uAiCore, 0.5) * clashWide;
        color += flashColor;

        float alpha = clamp(envelope * (0.65 + core * 0.35) + clashFlash * 0.9, 0.0, 1.0);
        gl_FragColor = vec4(color * alpha, alpha);
      }`;

  // Shader Compile Helper
  let uSplitLoc: WebGLUniformLocation | null = null;
  let uTimeLoc: WebGLUniformLocation | null = null;
  let uResolutionLoc: WebGLUniformLocation | null = null;
  let uHumanColorLoc: WebGLUniformLocation | null = null;
  let uHumanCoreLoc: WebGLUniformLocation | null = null;
  let uAiColorLoc: WebGLUniformLocation | null = null;
  let uAiCoreLoc: WebGLUniformLocation | null = null;
  let quadBuffer: WebGLBuffer | null = null;

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
      uHumanColorLoc = gl.getUniformLocation(program, 'uHumanColor');
      uHumanCoreLoc = gl.getUniformLocation(program, 'uHumanCore');
      uAiColorLoc = gl.getUniformLocation(program, 'uAiColor');
      uAiCoreLoc = gl.getUniformLocation(program, 'uAiCore');

      gl.uniform3fv(uHumanColorLoc, humanColor);
      gl.uniform3fv(uHumanCoreLoc, humanCore);
      gl.uniform3fv(uAiColorLoc, aiColor);
      gl.uniform3fv(uAiCoreLoc, aiCore);

      // Full quad buffer
      const aPosLoc = gl.getAttribLocation(program, 'aPosition');
      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
    }
  }

  // Engage CSS Fallback if WebGL unavailable
  if (!gl) {
    beamCanvas.style.display = 'none';
    cssFallbackEl = document.createElement('div');
    cssFallbackEl.style.position = 'absolute';
    cssFallbackEl.style.inset = '0';
    cssFallbackEl.style.borderRadius = '9999px';
    cssFallbackEl.style.background = `linear-gradient(90deg, ${humanColorHex} 0%, ${humanColorHex} calc(var(--split, 50%) - 20px), #ffffff calc(var(--split, 50%)), ${aiColorHex} calc(var(--split, 50%) + 20px), ${aiColorHex} 100%)`;
    cssFallbackEl.style.boxShadow = `0 0 20px rgba(255, 140, 26, 0.5), inset 0 2px 4px rgba(255,255,255,0.6)`;
    container.appendChild(cssFallbackEl);
  }

  // ---------------------------------------------------------------------------
  // PARTICLE SYSTEM (Zero Allocation in Animation Loop)
  // ---------------------------------------------------------------------------
  const particles: Particle[] = new Array(sparkBudget);
  for (let i = 0; i < sparkBudget; i++) {
    particles[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, isHuman: true };
  }

  function spawnParticle(x: number, y: number, isBurst = false) {
    for (let i = 0; i < sparkBudget; i++) {
      if (particles[i].life <= 0) {
        const isHuman = Math.random() < 0.5;
        const speed = isBurst ? 2.5 + Math.random() * 4.5 : 1.2 + Math.random() * 2.8;
        const angle = isHuman
          ? Math.PI + (Math.random() - 0.5) * 1.6 // drift left
          : (Math.random() - 0.5) * 1.6;          // drift right

        particles[i].x = x;
        particles[i].y = y + (Math.random() - 0.5) * 12;
        particles[i].vx = Math.cos(angle) * speed;
        particles[i].vy = Math.sin(angle) * speed;
        particles[i].maxLife = 300 + Math.random() * 500;
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

  // ---------------------------------------------------------------------------
  // ANIMATION & STATE (Lerp, Observers, rAF)
  // ---------------------------------------------------------------------------
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
  let frameCount = 0;
  let lastFpsCheck = performance.now();

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

  // Animation Loop
  function loop(now: number) {
    if (!isVisible || isPaused) {
      rAFId = 0;
      return;
    }

    const dt = now - lastTime;
    lastTime = now;

    // Adaptive Performance check (Drop resScale if frame time consistently degrades)
    frameCount++;
    if (now - lastFpsCheck >= 1500) {
      const fps = (frameCount * 1000) / (now - lastFpsCheck);
      if (fps < 45 && resScale > 0.45) {
        resScale = Math.max(0.4, resScale - 0.1);
        updateDimensions();
      }
      frameCount = 0;
      lastFpsCheck = now;
    }

    // Smooth Lerp Split over ~500ms
    if (isLerping) {
      const elapsed = now - lerpStartTime;
      const progress = Math.min(1.0, elapsed / LERP_DURATION_MS);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      currentSplit = startSplit + (targetSplit - startSplit) * ease;
      if (progress >= 1.0) {
        currentSplit = targetSplit;
        isLerping = false;
      }
    }

    const clashX = currentSplit * width;
    const clashY = height * 0.5;

    // Render WebGL Beam
    if (gl && program) {
      gl.uniform1f(uSplitLoc, currentSplit);
      gl.uniform1f(uTimeLoc, reducedMotion ? 0.0 : now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (cssFallbackEl) {
      cssFallbackEl.style.setProperty('--split', `${Math.round(currentSplit * 100)}%`);
    }

    // Render 2D Canvas Sparks
    if (sparksCtx && !reducedMotion) {
      sparksCtx.clearRect(0, 0, width, height);
      sparksCtx.globalCompositeOperation = 'lighter';

      // Spawn idle embers from clash point
      if (Math.random() < 0.45) {
        spawnParticle(clashX, clashY);
      }

      for (let i = 0; i < sparkBudget; i++) {
        const p = particles[i];
        if (p.life > 0) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= dt;

          const lifeRatio = Math.max(0, p.life / p.maxLife);
          const alpha = lifeRatio;
          sparksCtx.fillStyle = p.isHuman
            ? `rgba(255, 180, 50, ${alpha})`
            : `rgba(80, 160, 255, ${alpha})`;

          sparksCtx.beginPath();
          sparksCtx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
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

  // ---------------------------------------------------------------------------
  // OBSERVERS & LIFECYCLE
  // ---------------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
  });
  resizeObserver.observe(container);

  const intersectionObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    isVisible = entry.isIntersecting && !document.hidden;
    if (isVisible) startLoop();
  });
  intersectionObserver.observe(container);

  const handleVisibilityChange = () => {
    isVisible = !document.hidden;
    if (isVisible) startLoop();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial sizing & kick-off
  updateDimensions();
  startLoop();

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  return {
    setScore(humansTotal: number, aiTotal: number) {
      const total = humansTotal + aiTotal;
      let rawSplit = total <= 0 ? 0.5 : humansTotal / total;
      const clamped = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, rawSplit));

      // Detect lead change
      const isHumanLeading = clamped >= 0.5;
      if (prevLeadHuman !== null && prevLeadHuman !== isHumanLeading) {
        fireBurst(currentSplit * width, height * 0.5, 35);
      }
      prevLeadHuman = isHumanLeading;

      // Start lerp transition
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        gl = null;
      }

      beamCanvas.remove();
      sparksCanvas.remove();
      glowLayer.remove();
      if (cssFallbackEl) cssFallbackEl.remove();
    },
  };
}
