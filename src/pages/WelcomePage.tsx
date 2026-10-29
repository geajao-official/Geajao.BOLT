import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Users, Shield,
  MessageCircle, Sparkles, Layers3, Heart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';

// A real WebGL crystal mesh: beveled geometry, perspective projection, per-face lighting,
// textured insignia plate, depth-tested orbital rings, and draggable 3D rotation.
type CrystalVec3 = [number, number, number];
type CrystalVec2 = [number, number];
type CrystalGeometry = { positions: number[]; normals: number[]; colors: number[]; uvs: number[] };
type CrystalMesh = { positions: WebGLBuffer; normals: WebGLBuffer; colors: WebGLBuffer; uvs: WebGLBuffer; count: number };

function crystalNormalize(v: CrystalVec3): CrystalVec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function crystalCross(a: CrystalVec3, b: CrystalVec3): CrystalVec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function crystalGeometry(): CrystalGeometry {
  return { positions: [], normals: [], colors: [], uvs: [] };
}

function crystalTriangle(
  g: CrystalGeometry,
  a: CrystalVec3,
  b: CrystalVec3,
  c: CrystalVec3,
  color: CrystalVec3,
  uvA: CrystalVec2 = [0, 0],
  uvB: CrystalVec2 = [0, 0],
  uvC: CrystalVec2 = [0, 0],
  forcedNormal?: CrystalVec3,
) {
  const ab: CrystalVec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: CrystalVec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = forcedNormal ?? crystalNormalize(crystalCross(ab, ac));
  for (const [point, uv] of [[a, uvA], [b, uvB], [c, uvC]] as Array<[CrystalVec3, CrystalVec2]>) {
    g.positions.push(point[0], point[1], point[2]);
    g.normals.push(normal[0], normal[1], normal[2]);
    g.colors.push(color[0], color[1], color[2]);
    g.uvs.push(uv[0], uv[1]);
  }
}

function crystalQuad(g: CrystalGeometry, a: CrystalVec3, b: CrystalVec3, c: CrystalVec3, d: CrystalVec3, color: CrystalVec3) {
  crystalTriangle(g, a, c, b, color);
  crystalTriangle(g, a, d, c, color);
}

function buildCrystalBody(): CrystalGeometry {
  const g = crystalGeometry();
  const sides = 8;
  const palette: CrystalVec3[] = [
    [0.96, 0.62, 0.04], [0.85, 0.47, 0.02], [0.10, 0.20, 0.50],
    [0.98, 0.75, 0.14], [0.72, 0.38, 0.02], [0.06, 0.12, 0.34],
    [0.99, 0.83, 0.30], [0.08, 0.16, 0.42],
  ];
  const rings = [
    { radius: 0.56, z: 0.48 },
    { radius: 0.79, z: 0.38 },
    { radius: 1.00, z: 0.14 },
    { radius: 0.98, z: -0.17 },
    { radius: 0.77, z: -0.39 },
    { radius: 0.55, z: -0.48 },
  ].map((ring) => Array.from({ length: sides }, (_, i): CrystalVec3 => {
    const angle = (i / sides) * Math.PI * 2 + Math.PI / 8;
    return [Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius * 1.04, ring.z];
  }));

  for (let layer = 0; layer < rings.length - 1; layer++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const color = palette[(i * 3 + layer * 2) % palette.length];
      crystalQuad(g, rings[layer][i], rings[layer][next], rings[layer + 1][next], rings[layer + 1][i], color);
    }
  }

  const frontCenter: CrystalVec3 = [0, 0, 0.485];
  const backCenter: CrystalVec3 = [0, 0, -0.485];
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    crystalTriangle(g, frontCenter, rings[0][i], rings[0][next], palette[(i + 1) % palette.length], [0, 0], [0, 0], [0, 0], [0, 0, 1]);
    crystalTriangle(g, backCenter, rings[rings.length - 1][next], rings[rings.length - 1][i], palette[(i + 4) % palette.length], [0, 0], [0, 0], [0, 0], [0, 0, -1]);
  }
  return g;
}

function buildCrystalFace(): CrystalGeometry {
  const g = crystalGeometry();
  const sides = 8;
  const radius = 0.535;
  const z = 0.515;
  const center: CrystalVec3 = [0, 0, z];
  const points = Array.from({ length: sides }, (_, i): { p: CrystalVec3; uv: CrystalVec2 } => {
    const a = (i / sides) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius * 1.04;
    return { p: [x, y, z], uv: [0.5 + x / (radius * 2.02), 0.5 + y / (radius * 2.08)] };
  });
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    crystalTriangle(g, center, points[i].p, points[next].p, [1, 1, 1], [0.5, 0.5], points[i].uv, points[next].uv, [0, 0, 1]);
  }
  return g;
}

function buildCrystalTorus(majorRadius: number, tubeRadius: number, color: CrystalVec3, majorSegments = 120, tubeSegments = 8): CrystalGeometry {
  const g = crystalGeometry();
  const point = (u: number, v: number): CrystalVec3 => {
    const ring = majorRadius + tubeRadius * Math.cos(v);
    return [ring * Math.cos(u), ring * Math.sin(u), tubeRadius * Math.sin(v)];
  };
  for (let i = 0; i < majorSegments; i++) {
    const u0 = (i / majorSegments) * Math.PI * 2;
    const u1 = ((i + 1) / majorSegments) * Math.PI * 2;
    for (let j = 0; j < tubeSegments; j++) {
      const v0 = (j / tubeSegments) * Math.PI * 2;
      const v1 = ((j + 1) / tubeSegments) * Math.PI * 2;
      const a = point(u0, v0), b = point(u1, v0), c = point(u1, v1), d = point(u0, v1);
      crystalQuad(g, a, b, c, d, color);
    }
  }
  return g;
}

function buildCrystalSphere(radius: number, color: CrystalVec3, longitude = 14, latitude = 9): CrystalGeometry {
  const g = crystalGeometry();
  const point = (u: number, v: number): CrystalVec3 => [
    radius * Math.sin(v) * Math.cos(u),
    radius * Math.cos(v),
    radius * Math.sin(v) * Math.sin(u),
  ];
  for (let y = 0; y < latitude; y++) {
    const v0 = (y / latitude) * Math.PI, v1 = ((y + 1) / latitude) * Math.PI;
    for (let x = 0; x < longitude; x++) {
      const u0 = (x / longitude) * Math.PI * 2, u1 = ((x + 1) / longitude) * Math.PI * 2;
      const a = point(u0, v0), b = point(u1, v0), c = point(u1, v1), d = point(u0, v1);
      crystalTriangle(g, a, b, c, color);
      crystalTriangle(g, a, c, d, color);
    }
  }
  return g;
}

function buildCrystalPlatform(radius: number, height: number, color: CrystalVec3, segments = 64): CrystalGeometry {
  const g = crystalGeometry();
  const bottom = -height / 2, top = height / 2;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
    const b0: CrystalVec3 = [Math.cos(a0) * radius, bottom, Math.sin(a0) * radius];
    const b1: CrystalVec3 = [Math.cos(a1) * radius, bottom, Math.sin(a1) * radius];
    const t0: CrystalVec3 = [b0[0], top, b0[2]], t1: CrystalVec3 = [b1[0], top, b1[2]];
    crystalQuad(g, b0, b1, t1, t0, color);
    crystalTriangle(g, [0, top, 0], t1, t0, [0.55, 0.32, 0.03], [0, 0], [0, 0], [0, 0], [0, 1, 0]);
    crystalTriangle(g, [0, bottom, 0], b0, b1, [0.015, 0.06, 0.16], [0, 0], [0, 0], [0, 0], [0, -1, 0]);
  }
  return g;
}

function createCrystalLogoCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const cx = 256, cy = 256;
  const octagon = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.save();
  octagon(248); ctx.clip();
  const bg = ctx.createLinearGradient(20, 20, 480, 490);
  bg.addColorStop(0, '#1c2447'); bg.addColorStop(.32, '#121a3a'); bg.addColorStop(.7, '#0c1128'); bg.addColorStop(1, '#070a18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 512);
  const glow = ctx.createRadialGradient(145, 125, 5, 250, 250, 310);
  glow.addColorStop(0, 'rgba(245,158,11,.42)'); glow.addColorStop(.52, 'rgba(217,119,6,.10)'); glow.addColorStop(1, 'rgba(8,12,28,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(252,211,77,.09)'; ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
  for (let y = 0; y < 512; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  const diskGlow = ctx.createRadialGradient(cx - 35, cy - 45, 4, cx, cy, 205);
  diskGlow.addColorStop(0, 'rgba(217,119,6,.30)'); diskGlow.addColorStop(.72, 'rgba(10,15,34,.65)'); diskGlow.addColorStop(1, 'rgba(9,13,30,.96)');
  ctx.fillStyle = diskGlow; ctx.fillRect(35, 35, 442, 442);
  for (const [radius, color, width] of [[190, 'rgba(245,158,11,.18)', 2], [166, 'rgba(245,158,11,.42)', 3], [144, 'rgba(252,211,77,.22)', 1]] as Array<[number, string, number]>) {
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  ctx.restore();
  octagon(244); ctx.strokeStyle = 'rgba(253,230,138,.95)'; ctx.lineWidth = 5; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
  octagon(229); ctx.strokeStyle = 'rgba(245,158,11,.58)'; ctx.lineWidth = 2; ctx.stroke();
  return canvas;
}

function crystalMat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
  }
  return out;
}

function crystalPerspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}

function crystalRotateX(angle: number): Float32Array {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
function crystalRotateY(angle: number): Float32Array {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
function crystalRotateZ(angle: number): Float32Array {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function crystalTranslate(x: number, y: number, z: number): Float32Array {
  const out = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  out[12] = x; out[13] = y; out[14] = z; return out;
}
function crystalLookAt(eye: CrystalVec3, center: CrystalVec3, up: CrystalVec3): Float32Array {
  const z = crystalNormalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
  const x = crystalNormalize(crystalCross(up, z));
  const y = crystalCross(z, x);
  const out = new Float32Array(16);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]); out[15] = 1;
  return out;
}
function crystalNormalMatrix(m: Float32Array): Float32Array {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}

function makeCrystalShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create WebGL shader');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed'; gl.deleteShader(shader); throw new Error(message);
  }
  return shader;
}

function makeCrystalMesh(gl: WebGLRenderingContext, data: CrystalGeometry): CrystalMesh {
  const upload = (values: number[]): WebGLBuffer => {
    const buffer = gl.createBuffer(); if (!buffer) throw new Error('Could not create WebGL mesh buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW); return buffer;
  };
  return { positions: upload(data.positions), normals: upload(data.normals), colors: upload(data.colors), uvs: upload(data.uvs), count: data.positions.length / 3 };
}

function WebGLCrystal({ rotationX, rotationY, dragging, overlayRef }: { rotationX: number; rotationY: number; dragging: boolean; overlayRef: RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef({ x: rotationX, y: rotationY, dragging });
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => { rotationRef.current.x = rotationX; rotationRef.current.y = rotationY; }, [rotationX, rotationY]);
  useEffect(() => { rotationRef.current.dragging = dragging; }, [dragging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: false });
    if (!gl) { setWebglUnavailable(true); return; }

    let animationFrame = 0;
    let disposed = false;
    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;
    const meshes: CrystalMesh[] = [];
    let positionLocation = -1, normalLocation = -1, colorLocation = -1, uvLocation = -1;
    let mvpLocation: WebGLUniformLocation | null = null;
    let modelLocation: WebGLUniformLocation | null = null;
    let normalLocationUniform: WebGLUniformLocation | null = null;
    let useTextureLocation: WebGLUniformLocation | null = null;
    let samplerLocation: WebGLUniformLocation | null = null;
    let crystal: CrystalMesh, face: CrystalMesh, rim: CrystalMesh, orbitA: CrystalMesh, orbitB: CrystalMesh, platform: CrystalMesh, satellite: CrystalMesh;
    let currentX = rotationX * Math.PI / 180, currentY = rotationY * Math.PI / 180;

    const vertexSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec3 aColor;
      attribute vec2 aUv;
      uniform mat4 uMvp;
      uniform mat4 uModel;
      uniform mat3 uNormalMatrix;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vec4 worldPosition = uModel * vec4(aPosition, 1.0);
        vPosition = worldPosition.xyz;
        vNormal = normalize(uNormalMatrix * aNormal);
        vColor = aColor;
        vUv = aUv;
        gl_Position = uMvp * vec4(aPosition, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform float uUseTexture;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(uTexture, vUv);
        if (uUseTexture > 0.5 && texel.a < 0.04) discard;
        vec3 baseColor = mix(vColor, texel.rgb, uUseTexture);
        vec3 normal = normalize(vNormal);
        vec3 lightDirection = normalize(vec3(-0.55, 0.82, 1.0));
        vec3 viewDirection = normalize(vec3(0.0, 0.0, 4.1) - vPosition);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float fill = max(dot(normal, normalize(vec3(0.7, -0.25, 0.55))), 0.0);
        float rimLight = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.35);
        float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 34.0);
        vec3 lit = baseColor * (0.24 + diffuse * 0.9 + fill * 0.16);
        lit += vec3(0.04, 0.16, 0.50) * rimLight * 0.72;
        lit += vec3(1.0, 0.88, 0.55) * specular * 0.75;
        if (uUseTexture > 0.5) lit = mix(lit, baseColor, 0.28);
        gl_FragColor = vec4(lit, mix(1.0, texel.a, uUseTexture));
      }
    `;

    try {
      const vertexShader = makeCrystalShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = makeCrystalShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error('Could not create WebGL program');
      gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
      gl.deleteShader(vertexShader); gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL program linking failed');
      gl.useProgram(program);

      positionLocation = gl.getAttribLocation(program, 'aPosition');
      normalLocation = gl.getAttribLocation(program, 'aNormal');
      colorLocation = gl.getAttribLocation(program, 'aColor');
      uvLocation = gl.getAttribLocation(program, 'aUv');
      mvpLocation = gl.getUniformLocation(program, 'uMvp');
      modelLocation = gl.getUniformLocation(program, 'uModel');
      normalLocationUniform = gl.getUniformLocation(program, 'uNormalMatrix');
      useTextureLocation = gl.getUniformLocation(program, 'uUseTexture');
      samplerLocation = gl.getUniformLocation(program, 'uTexture');

      crystal = makeCrystalMesh(gl, buildCrystalBody()); meshes.push(crystal);
      face = makeCrystalMesh(gl, buildCrystalFace()); meshes.push(face);
      rim = makeCrystalMesh(gl, buildCrystalTorus(0.48, 0.012, [0.98, 0.75, 0.14], 100, 8)); meshes.push(rim);
      orbitA = makeCrystalMesh(gl, buildCrystalTorus(1.12, 0.009, [0.99, 0.83, 0.30], 128, 7)); meshes.push(orbitA);
      orbitB = makeCrystalMesh(gl, buildCrystalTorus(1.18, 0.0075, [0.85, 0.47, 0.02], 128, 7)); meshes.push(orbitB);
      platform = makeCrystalMesh(gl, buildCrystalPlatform(0.78, 0.055, [0.45, 0.26, 0.02])); meshes.push(platform);
      satellite = makeCrystalMesh(gl, buildCrystalSphere(0.045, [0.99, 0.83, 0.30])); meshes.push(satellite);

      const logoCanvas = createCrystalLogoCanvas();
      texture = gl.createTexture();
      if (!texture) throw new Error('Could not create WebGL texture');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logoCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(samplerLocation, 0);
      setWebglUnavailable(false);

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0);

      const view = crystalLookAt([0, 0.02, 4.15], [0, 0, 0], [0, 1, 0]);
      const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const drawMesh = (mesh: CrystalMesh, model: Float32Array, textured = false) => {
        if (!program || !mvpLocation || !modelLocation || !normalLocationUniform || !useTextureLocation) return;
        const aspect = canvas.width / Math.max(1, canvas.height);
        const projection = crystalPerspective(39 * Math.PI / 180, aspect, 0.1, 30);
        const viewModel = crystalMat4Multiply(view, model);
        const mvp = crystalMat4Multiply(projection, viewModel);
        gl.uniformMatrix4fv(mvpLocation, false, mvp);
        gl.uniformMatrix4fv(modelLocation, false, model);
        gl.uniformMatrix3fv(normalLocationUniform, false, crystalNormalMatrix(model));
        gl.uniform1f(useTextureLocation, textured ? 1 : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions); gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals); gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(normalLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colors); gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(colorLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvs); gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(uvLocation);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      };

      const render = (now: number) => {
        if (disposed) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const seconds = motionAllowed ? now * 0.001 : 0;
        const idleX = motionAllowed && !rotationRef.current.dragging ? Math.sin(seconds * 0.48) * 0.035 : 0;
        const idleY = motionAllowed && !rotationRef.current.dragging ? Math.sin(seconds * 0.32) * 0.075 : 0;
        const targetX = rotationRef.current.x * Math.PI / 180 + idleX;
        const targetY = rotationRef.current.y * Math.PI / 180 + idleY;
        currentX += (targetX - currentX) * (rotationRef.current.dragging ? 0.22 : 0.055);
        currentY += (targetY - currentY) * (rotationRef.current.dragging ? 0.22 : 0.055);

        const focalPixels = canvas.clientHeight / (2 * Math.tan((39 * Math.PI / 180) / 2));
        const faceDepthPixels = focalPixels * (0.515 / 4.15);
        const structureElement = canvas.closest<HTMLElement>('.webgl-crystal-structure');
        if (structureElement) structureElement.style.setProperty('perspective', `${focalPixels}px`, 'important');
        if (overlayRef.current) {
          overlayRef.current.style.transform = `rotateY(${currentY * 180 / Math.PI}deg) rotateX(${currentX * 180 / Math.PI}deg) translateZ(${faceDepthPixels}px)`;
        }

        const model = crystalMat4Multiply(crystalRotateY(currentY), crystalRotateX(currentX));

        const platformModel = crystalMat4Multiply(model, crystalTranslate(0, -1.035, 0));
        drawMesh(platform, platformModel);
        drawMesh(crystal, model);
        drawMesh(face, model, true);
        const faceRimModel = crystalMat4Multiply(model, crystalTranslate(0, 0, 0.526));
        drawMesh(rim, faceRimModel);
        const orbitModelA = crystalMat4Multiply(model, crystalMat4Multiply(crystalRotateZ(seconds * 0.23), crystalRotateX(0.98)));
        const orbitModelB = crystalMat4Multiply(model, crystalMat4Multiply(crystalRotateZ(-seconds * 0.17), crystalMat4Multiply(crystalRotateX(0.5), crystalRotateY(0.82))));
        drawMesh(orbitA, orbitModelA);
        drawMesh(orbitB, orbitModelB);
        const satAngle = seconds * 0.82;
        const satA = crystalMat4Multiply(model, crystalTranslate(Math.cos(satAngle) * 1.25, Math.sin(satAngle * 0.68) * 0.75, Math.sin(satAngle) * 0.55));
        const satB = crystalMat4Multiply(model, crystalTranslate(Math.cos(-satAngle * 0.72) * 1.18, Math.sin(-satAngle * 0.86) * 0.88, Math.sin(-satAngle * 0.72) * 0.36));
        drawMesh(satellite, satA);
        drawMesh(satellite, satB);
        animationFrame = window.requestAnimationFrame(render);
      };
      animationFrame = window.requestAnimationFrame(render);
    } catch (error) {
      console.error('WebGL crystal renderer unavailable:', error);
      setWebglUnavailable(true);
      if (program) gl.deleteProgram(program);
      meshes.forEach((mesh) => { gl.deleteBuffer(mesh.positions); gl.deleteBuffer(mesh.normals); gl.deleteBuffer(mesh.colors); gl.deleteBuffer(mesh.uvs); });
      if (texture) gl.deleteTexture(texture);
      return;
    }

    const handleContextLost = (event: Event) => { event.preventDefault(); disposed = true; window.cancelAnimationFrame(animationFrame); setWebglUnavailable(true); };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    return () => {
      disposed = true; window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      meshes.forEach((mesh) => { gl.deleteBuffer(mesh.positions); gl.deleteBuffer(mesh.normals); gl.deleteBuffer(mesh.colors); gl.deleteBuffer(mesh.uvs); });
      if (texture) gl.deleteTexture(texture);
      if (program) gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="webgl-crystal-renderer" aria-hidden="true">
      <canvas ref={canvasRef} className={`crystal-webgl-canvas${webglUnavailable ? ' is-unavailable' : ''}`} />
      {webglUnavailable && <div className="crystal-webgl-fallback" />}
    </div>
  );
}

interface WelcomePageProps {
  onGetIn: () => void;
}

export default function WelcomePage({ onGetIn }: WelcomePageProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  // EGRESS FIX (edit 1/4): track the current slide AND the one fading out, so only those
  // (plus the next one) are ever downloaded instead of every slideshow photo at once.
  const [slide, setSlide] = useState({ cur: 0, prev: -1 });
  const [artifactRotation, setArtifactRotation] = useState({ x: -12, y: -28 });
  const [isArtifactDragging, setIsArtifactDragging] = useState(false);
  const artifactDragRef = useRef({ x: 0, y: 0, rotationX: -12, rotationY: -28 });
  const artifactOverlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchPhotos = async () => {
      try {
        const { data, error } = await supabase
          .from('slideshow_photos')
          .select('photo_url')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (error) throw error;
        if (!cancelled && data?.length) setPhotos(data.map((p) => p.photo_url));
      } catch {
        // Fallback animated background is active when offline.
      }
    };
    fetchPhotos();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (photos.length <= 1) return;
    // EGRESS FIX (edit 2/4): skip advancing while the tab is hidden, and use the new slide state.
    const interval = window.setInterval(() => {
      if (document.hidden) return; // don't advance (or download) while the tab is in the background
      setSlide((s) => ({ cur: (s.cur + 1) % photos.length, prev: s.cur }));
    }, 6000);
    return () => window.clearInterval(interval);
  }, [photos.length]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.welcome-auto-reveal'));
    if (!elements.length) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-in-view'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -36px 0px' });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
// Speed up every logo disk's spinning rings/satellites while any logo is hovered
useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DISK_ANIMS = new Set([
    'geajao-disc-spin',
    'geajao-disc-spin-reverse',
    'geajao-satellite-orbit',
    'geajao-disc-breathe',
  ]);
  const FAST = 4; // 4x speed on hover, change to taste
  let target = 1;
  let current = 1;
  let raf = 0;

  const apply = (rate: number) => {
    document.querySelectorAll<HTMLElement>('.geajao-logo-disk').forEach((disk) => {
      disk.getAnimations({ subtree: true }).forEach((anim) => {
        const name = (anim as Animation & { animationName?: string }).animationName;
        if (name && DISK_ANIMS.has(name)) anim.playbackRate = rate;
      });
    });
  };

  const tick = () => {
    current += (target - current) * 0.12; // smooth ease toward the target speed
    if (Math.abs(target - current) < 0.01) current = target;
    apply(current);
    raf = current === target ? 0 : window.requestAnimationFrame(tick);
  };

  const setTarget = (value: number) => {
    target = value;
    if (!raf) raf = window.requestAnimationFrame(tick);
  };

  const onOver = (e: MouseEvent) => {
    if ((e.target as Element).closest?.('.geajao-logo-disk')) setTarget(FAST);
  };
  const onOut = (e: MouseEvent) => {
    const to = e.relatedTarget as Element | null;
    if (!to?.closest?.('.geajao-logo-disk')) setTarget(1);
  };

  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);
  return () => {
    document.removeEventListener('mouseover', onOver);
    document.removeEventListener('mouseout', onOut);
    if (raf) window.cancelAnimationFrame(raf);
    apply(1);
  };
}, []);
  const goPrev = () => setSlide((s) => ({ cur: (s.cur - 1 + photos.length) % photos.length, prev: s.cur }));
  const goNext = () => setSlide((s) => ({ cur: (s.cur + 1) % photos.length, prev: s.cur }));
  const hasPhotos = photos.length > 0;
  // EGRESS FIX (edit 3/4): only these slides are downloaded: current, the one fading out, and the next one (preload).
  const nextIdx = photos.length > 1 ? (slide.cur + 1) % photos.length : -1;
  const shouldLoad = (idx: number) => idx === slide.cur || idx === slide.prev || idx === nextIdx;

  const handleArtifactPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    artifactDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotationX: artifactRotation.x,
      rotationY: artifactRotation.y,
    };
    setIsArtifactDragging(true);
  };

  const handleArtifactPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isArtifactDragging) return;
    const dx = event.clientX - artifactDragRef.current.x;
    const dy = event.clientY - artifactDragRef.current.y;
    setArtifactRotation({
      x: Math.max(-55, Math.min(55, artifactDragRef.current.rotationX - dy * 0.45)),
      y: artifactDragRef.current.rotationY + dx * 0.55,
    });
  };

  const stopArtifactDrag = () => setIsArtifactDragging(false);

  const rotateArtifact = () => {
    setArtifactRotation((rotation) => ({ x: rotation.x, y: rotation.y + 120 }));
  };

  return (
    <div className="welcome-shell relative flex min-h-screen flex-col overflow-hidden bg-[#080c1c] text-[#fef3c7] selection:bg-[#f59e0b]/40">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Orbitron:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Teko:wght@400;500;600;700&display=swap');
        @keyframes welcome-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,-20px,0)}}
        @keyframes welcome-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes welcome-orbit{from{rotate:0deg}to{rotate:360deg}}
        @keyframes welcome-float{0%,100%{translate:0 0}50%{translate:0 -12px}}
        @keyframes welcome-scan{0%{transform:translateY(-110%);opacity:0}15%,85%{opacity:.26}100%{transform:translateY(110%);opacity:0}}
        @keyframes welcome-shine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes welcome-pulse{0%,100%{opacity:.45;transform:scale(.96)}50%{opacity:.9;transform:scale(1.05)}}
        .welcome-shell{font-family:'Manrope',system-ui,sans-serif;background:#080c1c;font-synthesis:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
        .geajao-wordmark{font-family:'Space Grotesk','Manrope',sans-serif;letter-spacing:-.055em;text-transform:none;text-shadow:0 0 20px rgba(245,158,11,.16)}
        .welcome-display,.welcome-shell h2,.welcome-shell h3{font-family:'Space Grotesk','Manrope',sans-serif;letter-spacing:-.055em;font-weight:700;text-wrap:balance}
        .welcome-hero-title{display:flex;flex-direction:column;align-items:flex-start;font-family:'Teko','Arial Narrow',sans-serif!important;font-size:clamp(5.6rem,11.7vw,9.6rem)!important;line-height:.72!important;letter-spacing:-.012em!important;font-weight:700!important;text-transform:uppercase;text-wrap:balance;filter:drop-shadow(0 14px 35px rgba(0,0,0,.25))}
        .welcome-hero-title>span:not(.welcome-bengali){display:block;font-family:'Teko','Arial Narrow',sans-serif;line-height:.78;letter-spacing:.005em;-webkit-text-stroke:.35px rgba(253,230,138,.2);transform:scaleX(.96) skewX(-2deg);transform-origin:left center}
        .welcome-hero-title>span:first-child{filter:drop-shadow(0 0 24px rgba(253,230,138,.11))}
        .welcome-hero-title>span:nth-child(2){filter:drop-shadow(0 0 32px rgba(245,158,11,.17))}
        .welcome-bengali{font-family:'Noto Sans Bengali','Manrope',sans-serif;letter-spacing:0!important;font-weight:800;line-height:1.42!important;font-size:clamp(1.55rem,3vw,2.55rem)!important;text-shadow:0 0 25px rgba(245,158,11,.18)}
        .welcome-eyebrow{font-family:'Orbitron','Chakra Petch',sans-serif;letter-spacing:.17em!important;font-weight:700!important}
        .welcome-shell button,.welcome-shell a{font-family:'Chakra Petch','Manrope',sans-serif;font-weight:600}
        .welcome-shell p{font-feature-settings:'kern' 1}
        .welcome-shell :is(h1,h2,h3,p,.geajao-wordmark,.welcome-eyebrow,.welcome-section-title,.welcome-bengali,.artifact-brand,.artifact-tagline){transition:color .28s ease,text-shadow .3s ease,filter .3s ease,letter-spacing .3s ease,translate .3s ease}
        .welcome-shell h2:hover,.welcome-shell h3:hover{color:#fef3c7;text-shadow:0 0 22px rgba(245,158,11,.22);translate:2px -1px}
        .welcome-shell .welcome-section-title:hover{color:#fff8e1;text-shadow:0 0 28px rgba(217,119,6,.32),0 0 2px rgba(251,191,36,.35);letter-spacing:-.045em}
        .welcome-shell .welcome-hero-title:hover{filter:drop-shadow(0 0 28px rgba(217,119,6,.25)) drop-shadow(0 14px 35px rgba(0,0,0,.25))}
        .welcome-shell .welcome-hero-title:hover>span:first-child{filter:drop-shadow(0 0 26px rgba(219,234,254,.28))}
        .welcome-shell .welcome-hero-title:hover>span:nth-child(2){filter:drop-shadow(0 0 38px rgba(245,158,11,.36))}
        .welcome-shell .welcome-bengali:hover{color:#fcd34d;text-shadow:0 0 24px rgba(245,158,11,.32)}
        .welcome-shell p:hover{color:#fef3c7;text-shadow:0 0 16px rgba(245,158,11,.13);translate:1px 0}
        .welcome-shell .welcome-eyebrow:hover{color:#fff;text-shadow:0 0 18px rgba(251,191,36,.4);letter-spacing:.22em!important}
        .welcome-shell .geajao-wordmark:hover{color:#fcd34d;text-shadow:0 0 24px rgba(245,158,11,.5);letter-spacing:-.025em}
        .welcome-shell .welcome-feature:hover h3{color:#fcd34d;text-shadow:0 0 18px rgba(245,158,11,.2)}
        .welcome-shell .welcome-feature:hover p{color:#e2e8f0;text-shadow:0 0 12px rgba(245,158,11,.1)}
        .welcome-shell .welcome-feature:hover .text-xs{color:#fcd34d;text-shadow:0 0 15px rgba(245,158,11,.2)}
        .welcome-shell .welcome-art-shell:hover :is(h2,.artifact-brand,.artifact-tagline){text-shadow:0 0 22px rgba(245,158,11,.36)}
        .welcome-shell .artifact-status:hover p,.welcome-shell .artifact-status:hover span{color:#fef3c7;text-shadow:0 0 13px rgba(245,158,11,.2)}
        .welcome-shell a:not(.welcome-cta):hover{text-shadow:0 0 16px rgba(251,191,36,.3)}
        .welcome-shell .welcome-cta:hover{color:#fff;text-shadow:0 0 15px rgba(255,255,255,.2)}
        @media(hover:none){.welcome-shell h2:hover,.welcome-shell h3:hover,.welcome-shell p:hover,.welcome-shell .welcome-section-title:hover,.welcome-shell .welcome-bengali:hover,.welcome-shell .welcome-eyebrow:hover{translate:0 0;letter-spacing:inherit;text-shadow:none}}
        .welcome-shell h2{letter-spacing:-.045em}
        .welcome-shell h3{letter-spacing:-.035em}
        .welcome-section-title{font-family:'Space Grotesk','Manrope',sans-serif;font-weight:700;letter-spacing:-.065em;line-height:1.02}
        .welcome-footer{position:relative;z-index:10;width:100%;margin-top:auto;flex-shrink:0;min-height:164px;display:flex;align-items:center;justify-content:center;padding:34px 24px calc(34px + env(safe-area-inset-bottom));border-top:1px solid rgba(245,158,11,.18);background:linear-gradient(180deg,rgba(11,16,36,.92),rgba(8,12,28,.98));box-shadow:0 -18px 60px rgba(0,0,0,.2),0 -1px 25px rgba(217,119,6,.05);}
        .welcome-footer > *{width:100%;max-width:1280px;}
        .welcome-footer a{font-size:clamp(.82rem,1vw,.98rem)!important;line-height:1.6!important;}
        .welcome-footer p,.welcome-footer span{line-height:1.65;}
        .welcome-footer :is(a,button){transition:color .2s ease,opacity .2s ease,transform .2s ease;}
        .welcome-footer :is(a,button):hover{color:#fcd34d;}
        @media(max-width:640px){.welcome-footer{min-height:142px;padding:26px 18px calc(26px + env(safe-area-inset-bottom));}}
        .welcome-rise{animation:welcome-rise .75s cubic-bezier(.2,.75,.25,1) both}
        .welcome-delay-1{animation-delay:.1s}.welcome-delay-2{animation-delay:.2s}.welcome-delay-3{animation-delay:.3s}
        .welcome-orb{animation:welcome-drift 14s ease-in-out infinite}.welcome-orb-slow{animation:welcome-drift 18s ease-in-out infinite reverse}
        .welcome-orbit{animation:welcome-orbit 36s linear infinite;transform-origin:center}
        .welcome-glass{background:linear-gradient(145deg,rgba(16,23,51,.88),rgba(10,14,32,.92));border:1px solid rgba(245,158,11,.18);box-shadow:0 22px 70px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.055);backdrop-filter:blur(20px)}
        .welcome-feature{transition:transform .32s ease,border-color .32s ease,box-shadow .32s ease}
        .welcome-feature:hover{transform:translateY(-5px);border-color:rgba(245,158,11,.42);box-shadow:0 22px 55px rgba(217,119,6,.14)}
        .welcome-cta{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 12px 38px rgba(217,119,6,.28),inset 0 1px 0 rgba(255,255,255,.22)}
        .welcome-cta:before{content:'';position:absolute;inset:-2px;z-index:-1;background:linear-gradient(110deg,transparent 20%,rgba(255,255,255,.4) 45%,transparent 70%);transform:translateX(-130%);transition:transform .8s ease}
        .welcome-cta:hover:before{transform:translateX(130%)}.welcome-cta:hover{box-shadow:0 18px 48px rgba(217,119,6,.4),0 0 28px rgba(245,158,11,.12)}
        .welcome-hero-title{text-shadow:0 0 55px rgba(217,119,6,.17)}
        .welcome-art-shell{background:linear-gradient(135deg,rgba(217,119,6,.16),rgba(12,17,40,.82) 40%,rgba(166,122,31,.09));box-shadow:0 35px 100px rgba(0,0,0,.48),0 0 90px rgba(217,119,6,.1);transition:transform .45s ease,border-color .45s ease}
        .welcome-art-shell:hover{transform:translateY(-4px);border-color:rgba(245,158,11,.35)}
        .community-3d-stage{position:relative;perspective:1200px;isolation:isolate;background:radial-gradient(ellipse at 50% 44%,rgba(30,64,175,.24),transparent 58%),linear-gradient(145deg,#0b1a45 0%,#090d1f 70%,#080c1c 100%)}
        .community-3d-stage:before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.26;background-image:linear-gradient(rgba(245,158,11,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.18) 1px,transparent 1px);background-size:34px 34px;mask-image:radial-gradient(ellipse at center,#000,transparent 78%)}
        .community-3d-stage>*{z-index:1}
        .artifact-drag-area{transform-style:preserve-3d;touch-action:pan-y;cursor:grab;user-select:none;filter:drop-shadow(0 30px 34px rgba(0,0,0,.4))}
        .artifact-drag-area.is-dragging{cursor:grabbing}
        .artifact-structure{position:relative;width:250px;height:270px;transform-style:preserve-3d;transition:transform .24s ease-out;animation:welcome-float 6s ease-in-out infinite}
        .artifact-orbit-ring{position:absolute;left:50%;top:48%;width:340px;height:132px;border:1px solid rgba(245,158,11,.65);border-radius:50%;transform:translate(-50%,-50%) rotate(-25deg) rotateX(65deg);box-shadow:0 0 24px rgba(217,119,6,.16);pointer-events:none}
        .artifact-orbit-ring.ring-two{width:390px;height:165px;border-color:rgba(245,158,11,.26);transform:translate(-50%,-50%) rotate(36deg) rotateX(68deg)}
        .artifact-orbit-ring.ring-three{width:300px;height:350px;border-color:rgba(180,83,9,.24);transform:translate(-50%,-50%) rotate(-32deg) rotateY(65deg)}
        .artifact-node{position:absolute;display:flex;align-items:center;gap:9px;min-width:142px;padding:10px 12px;border:1px solid rgba(245,158,11,.22);border-radius:14px;background:linear-gradient(145deg,rgba(17,24,54,.94),rgba(10,14,32,.92));color:#fcd34d;box-shadow:0 15px 38px rgba(0,0,0,.35),0 0 26px rgba(217,119,6,.1);backdrop-filter:blur(14px);transform:translateZ(68px)}
        .artifact-node .node-icon{display:flex;height:30px;width:30px;flex:none;align-items:center;justify-content:center;border-radius:10px;background:rgba(217,119,6,.18);color:#fbbf24}
        .artifact-node strong{display:block;font-size:10px;line-height:1.4;color:#fff8e1}.artifact-node small{display:block;margin-top:2px;font-size:8px;color:#94a3b8}
        .artifact-node.node-a{left:-28px;top:23%;animation:welcome-float 5.5s ease-in-out infinite}
        .artifact-node.node-b{right:-36px;top:34%;animation:welcome-float 6.4s ease-in-out infinite reverse}
        .artifact-node.node-c{left:-8px;bottom:16%;animation:welcome-float 6s ease-in-out infinite .7s}
        .artifact-status{border:1px solid rgba(245,158,11,.2);background:rgba(10,15,34,.76);backdrop-filter:blur(12px)}
        .community-emblem-control{border:1px solid rgba(245,158,11,.28);background:rgba(15,22,48,.82);color:#fef3c7;transition:all .2s ease}
        .community-emblem-control:hover{border-color:rgba(251,191,36,.62);background:rgba(12,40,100,.35);color:white}
        .welcome-shell button,.welcome-shell a{-webkit-tap-highlight-color:transparent;outline-offset:4px}
        .welcome-shell button:not(:disabled),.welcome-shell a{transition-property:color,background-color,border-color,box-shadow,opacity,translate,scale,filter;transition-duration:.24s;transition-timing-function:cubic-bezier(.2,.75,.25,1)}
        .welcome-shell button:not(:disabled):active,.welcome-shell a:active{scale:.97}
        .welcome-shell :is(button,a):focus-visible{outline:2px solid rgba(251,191,36,.9);box-shadow:0 0 0 5px rgba(217,119,6,.18)}
        .welcome-shell nav a{position:relative;padding:8px 0;color:rgba(203,213,225,.78);transition:color .25s ease,text-shadow .25s ease}
        .welcome-shell nav a:after{content:'';position:absolute;left:0;right:0;bottom:1px;height:1.5px;border-radius:99px;background:linear-gradient(90deg,#f59e0b,#fbbf24);transform:scaleX(0);transform-origin:left;transition:transform .28s cubic-bezier(.2,.75,.25,1);box-shadow:0 0 12px rgba(245,158,11,.6)}
        .welcome-shell nav a:hover{color:#fef3c7;text-shadow:0 0 18px rgba(245,158,11,.35)}
        .welcome-shell nav a:hover:after,.welcome-shell nav a:focus-visible:after{transform:scaleX(1)}
        .welcome-shell header .geajao-wordmark{transition:color .3s ease,text-shadow .3s ease,letter-spacing .3s ease}
        .welcome-shell header .geajao-wordmark:hover{color:#fef3c7;text-shadow:0 0 24px rgba(245,158,11,.5);letter-spacing:-.025em}
        .welcome-shell header .flex.h-11.w-11{transition:transform .35s cubic-bezier(.2,.75,.25,1),border-color .35s ease,box-shadow .35s ease}
        .welcome-shell header .flex.h-11.w-11:hover{transform:translateY(-2px) rotate(-5deg) scale(1.055);border-color:rgba(251,191,36,.62);box-shadow:0 0 38px rgba(217,119,6,.34),inset 0 0 18px rgba(245,158,11,.12)}
        .welcome-feature{position:relative;isolation:isolate;overflow:hidden;will-change:transform}
        .welcome-feature:before{content:'';position:absolute;z-index:0;pointer-events:none;inset:0;background:linear-gradient(115deg,transparent 15%,rgba(245,158,11,.09) 42%,rgba(251,191,36,.04) 50%,transparent 68%);background-size:230% 100%;background-position:100% 50%;opacity:0;transition:background-position .65s ease,opacity .35s ease}
        .welcome-feature:after{content:'';position:absolute;z-index:0;pointer-events:none;left:8%;right:8%;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(251,191,36,.9),rgba(245,158,11,.4),transparent);transform:scaleX(.15);opacity:0;transition:transform .35s ease,opacity .35s ease}
        .welcome-feature>*{position:relative;z-index:1}
        .welcome-feature:hover{transform:translateY(-7px) scale(1.012);border-color:rgba(251,191,36,.52);box-shadow:0 25px 65px rgba(0,20,70,.42),0 0 32px rgba(217,119,6,.15),inset 0 1px 0 rgba(251,191,36,.11)}
        .welcome-feature:hover:before{opacity:1;background-position:0% 50%}
        .welcome-feature:hover:after{transform:scaleX(1);opacity:1}
        .welcome-feature>div:first-child{transition:transform .38s cubic-bezier(.2,.75,.25,1),border-color .3s ease,background-color .3s ease,box-shadow .3s ease}
        .welcome-feature:hover>div:first-child{transform:translateY(-3px) rotate(-6deg) scale(1.08);border-color:rgba(251,191,36,.5);background-color:rgba(217,119,6,.2);box-shadow:0 8px 28px rgba(217,119,6,.18)}
        .welcome-feature>div:last-child{transition:gap .25s ease,color .25s ease}
        .welcome-feature>div:last-child svg{transition:transform .25s ease,filter .25s ease}
        .welcome-feature:hover>div:last-child svg{transform:translateX(5px);filter:drop-shadow(0 0 5px rgba(251,191,36,.7))}
        .welcome-cta{transform:translateZ(0);transition:translate .25s ease,box-shadow .3s ease,filter .3s ease,border-color .3s ease}
        .welcome-cta:hover{translate:0 -3px;filter:saturate(1.13) brightness(1.08);border-color:rgba(253,230,138,.62);box-shadow:0 20px 55px rgba(217,119,6,.44),0 0 36px rgba(245,158,11,.17),inset 0 1px 0 rgba(255,255,255,.3)}
        .welcome-cta:active{translate:0 0;filter:brightness(.98)}
        .welcome-cta svg,.welcome-cta span{transition:transform .3s cubic-bezier(.2,.75,.25,1)}
        .welcome-cta:hover svg{transform:translateX(4px)}
        .welcome-art-shell{position:relative;isolation:isolate}
        .welcome-art-shell:after{content:'';position:absolute;inset:0;z-index:5;pointer-events:none;border-radius:inherit;opacity:0;background:linear-gradient(120deg,transparent 25%,rgba(251,191,36,.07) 45%,transparent 65%);background-size:230% 100%;background-position:100% 50%;transition:opacity .35s ease,background-position .7s ease}
        .welcome-art-shell:hover:after{opacity:1;background-position:0% 50%}
        .artifact-drag-area{transition:filter .35s ease}
        .artifact-drag-area:hover{filter:drop-shadow(0 0 24px rgba(217,119,6,.18))}
        .artifact-node{cursor:default;transition:translate .28s cubic-bezier(.2,.75,.25,1),border-color .28s ease,box-shadow .28s ease,background .28s ease,filter .28s ease}
        .artifact-node:hover{translate:0 -5px;border-color:rgba(251,191,36,.58);background:linear-gradient(145deg,rgba(22,30,66,.98),rgba(11,16,38,.97));box-shadow:0 22px 48px rgba(0,0,0,.43),0 0 32px rgba(217,119,6,.24);filter:brightness(1.12)}
        .artifact-node .node-icon{transition:transform .3s cubic-bezier(.2,.75,.25,1),background .3s ease,color .3s ease,box-shadow .3s ease}
        .artifact-node:hover .node-icon{transform:rotate(-8deg) scale(1.1);background:rgba(245,158,11,.18);color:#fde68a;box-shadow:0 0 18px rgba(245,158,11,.14)}
        .community-emblem-control{position:relative;overflow:hidden;box-shadow:0 0 0 rgba(217,119,6,0);transition:translate .25s ease,border-color .25s ease,background .25s ease,color .25s ease,box-shadow .25s ease}
        .community-emblem-control:hover{translate:0 -2px;border-color:rgba(251,191,36,.72);background:rgba(12,40,100,.42);color:white;box-shadow:0 8px 26px rgba(217,119,6,.2),0 0 22px rgba(245,158,11,.1)}
        .community-emblem-control svg{transition:transform .35s ease,filter .35s ease}
        .community-emblem-control:hover svg{transform:rotate(45deg) scale(1.12);filter:drop-shadow(0 0 5px rgba(251,191,36,.7))}
        .artifact-status{transition:border-color .3s ease,box-shadow .3s ease,background .3s ease}
        .community-3d-stage:hover .artifact-status{border-color:rgba(245,158,11,.35);box-shadow:0 8px 28px rgba(0,0,0,.2),0 0 18px rgba(217,119,6,.08)}
        .welcome-shell footer a:hover,.welcome-shell footer button:hover{translate:0 -2px;text-shadow:0 0 16px rgba(245,158,11,.35)}
        @media(hover:none){.welcome-feature:hover,.welcome-cta:hover,.welcome-art-shell:hover,.artifact-node:hover{transform:none;translate:0 0}.welcome-feature:hover{box-shadow:0 22px 55px rgba(217,119,6,.14)}}
        .welcome-shell ::selection{background:rgba(217,119,6,.45);color:white}
        @media(max-width:640px){.welcome-hero-title{font-size:clamp(5rem,19vw,6.4rem)!important;line-height:.76!important}.welcome-hero-title>span:not(.welcome-bengali){transform:scaleX(.94) skewX(-1.5deg)}.artifact-structure{width:194px;height:216px}.artifact-logo-frame{width:80px;height:80px;border-radius:24px}.artifact-brand{font-size:16px}.artifact-node{min-width:0;padding:8px}.artifact-node.node-a{left:-14px;top:19%}.artifact-node.node-b{right:-14px;top:35%}.artifact-node.node-c{left:0;bottom:13%}.artifact-node small{display:none}.artifact-orbit-ring{width:270px;height:110px}.artifact-orbit-ring.ring-two{width:300px;height:130px}.artifact-orbit-ring.ring-three{height:280px}}
        @media(prefers-reduced-motion:reduce){.welcome-rise,.welcome-orb,.welcome-orb-slow,.welcome-orbit,.artifact-structure,.artifact-node{animation:none!important}.welcome-shell *,.welcome-shell *:before,.welcome-shell *:after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}

        @keyframes welcome-depth-arrive{from{opacity:0;transform:perspective(1300px) rotateX(8deg) translateY(22px) translateZ(-35px)}to{opacity:1;transform:perspective(1300px) rotateX(0) translateY(0) translateZ(0)}}
        @keyframes welcome-card-bob{0%,100%{translate:0 0}50%{translate:0 -3px}}
        @keyframes welcome-icon-bob{0%,100%{translate:0 0}50%{translate:0 -2px}}
        @keyframes welcome-text-sheen{0%,100%{filter:drop-shadow(0 0 0 rgba(245,158,11,0))}50%{filter:drop-shadow(0 0 10px rgba(245,158,11,.16))}}
        @keyframes welcome-edge-pulse{0%,100%{box-shadow:0 0 0 rgba(217,119,6,0),inset 0 1px 0 rgba(255,255,255,.05)}50%{box-shadow:0 0 24px rgba(217,119,6,.11),inset 0 1px 0 rgba(251,191,36,.1)}}
        @keyframes welcome-footer-glow{0%,100%{box-shadow:0 -18px 60px rgba(0,0,0,.2),0 -1px 25px rgba(217,119,6,.05)}50%{box-shadow:0 -20px 65px rgba(0,0,0,.25),0 -1px 34px rgba(217,119,6,.1)}}
        .welcome-shell{perspective:1700px;perspective-origin:50% 35%;transform-style:preserve-3d}
        .welcome-shell>header,.welcome-shell>main,.welcome-shell>section,.welcome-shell>.welcome-footer{transform-style:preserve-3d}
        .welcome-shell>header{animation:welcome-depth-arrive .9s cubic-bezier(.2,.75,.25,1) both;backface-visibility:hidden}
        .welcome-shell nav a{transform-style:preserve-3d;transform-origin:center bottom;transition:transform .3s cubic-bezier(.2,.75,.25,1),color .25s ease,text-shadow .25s ease}
        .welcome-shell nav a:hover{transform:perspective(650px) rotateX(-8deg) translateZ(12px) translateY(-2px)}
        .welcome-shell header button{transform-style:preserve-3d}
        .welcome-shell header button:hover{transform:perspective(700px) rotateX(-5deg) translateY(-2px) translateZ(8px)}
        .welcome-shell header .flex.h-11.w-11{transform-style:preserve-3d;animation:welcome-edge-pulse 6s ease-in-out infinite}
        .welcome-hero-title{perspective:1000px;transform-style:preserve-3d}
        .welcome-hero-title>span:not(.welcome-bengali){transform-style:preserve-3d;backface-visibility:hidden;background-size:180% auto;animation:welcome-shine 9s linear infinite,welcome-text-sheen 7s ease-in-out infinite;transition:transform .45s cubic-bezier(.2,.75,.25,1),filter .35s ease,text-shadow .35s ease}
        .welcome-hero-title>span:first-child{animation-delay:0s,-1s}
        .welcome-hero-title>span:nth-child(2){animation-delay:-2.5s,0s}
        .welcome-hero-title:hover>span:first-child{transform:perspective(900px) rotateX(4deg) translateZ(16px) scaleX(.98) skewX(-1deg)}
        .welcome-hero-title:hover>span:nth-child(2){transform:perspective(900px) rotateX(-3deg) translateZ(23px) scaleX(.98) skewX(-1deg)}
        .welcome-hero-title .welcome-bengali{display:block;transform-style:preserve-3d;transition:transform .35s ease,color .3s ease,text-shadow .3s ease}
        .welcome-hero-title:hover .welcome-bengali{transform:perspective(800px) rotateX(3deg) translateZ(10px)}
        .welcome-shell :is(h2,h3,.welcome-section-title){transform-style:preserve-3d;backface-visibility:hidden;transition:transform .35s cubic-bezier(.2,.75,.25,1),color .28s ease,text-shadow .3s ease,letter-spacing .3s ease}
        .welcome-shell h2:hover,.welcome-shell h3:hover{transform:perspective(850px) rotateX(3deg) translateZ(12px) translateY(-1px)}
        .welcome-shell .welcome-section-title:hover{transform:perspective(1100px) rotateX(2.5deg) translateZ(16px)}
        .welcome-shell p{transform-style:preserve-3d;transition:transform .3s ease,color .28s ease,text-shadow .3s ease,translate .3s ease}
        .welcome-shell p:hover{transform:perspective(700px) translateZ(5px)}
        .welcome-shell .geajao-wordmark{display:inline-block;transform-style:preserve-3d;transition:transform .35s cubic-bezier(.2,.75,.25,1),color .3s ease,text-shadow .3s ease,letter-spacing .3s ease}
        .welcome-shell .geajao-wordmark:hover{transform:perspective(500px) rotateY(-10deg) translateZ(12px) scale(1.035)}
        .welcome-shell .welcome-eyebrow{transform-style:preserve-3d;transition:transform .3s ease,color .28s ease,text-shadow .3s ease,letter-spacing .3s ease}
        .welcome-shell .welcome-eyebrow:hover{transform:perspective(700px) rotateX(4deg) translateZ(8px)}
        .welcome-feature{transform-style:preserve-3d;perspective:1000px;animation:welcome-card-bob 9s ease-in-out infinite;backface-visibility:hidden}
        .welcome-feature:nth-child(2){animation-delay:-2.5s}.welcome-feature:nth-child(3){animation-delay:-5s}
        .welcome-feature:hover{transform:perspective(1000px) rotateX(5deg) rotateY(-2deg) translateY(-7px) translateZ(14px) scale(1.012)}
        .welcome-feature>div:first-child{transform-style:preserve-3d;animation:welcome-icon-bob 6s ease-in-out infinite}
        .welcome-feature:nth-child(2)>div:first-child{animation-delay:-2s}.welcome-feature:nth-child(3)>div:first-child{animation-delay:-4s}
        .welcome-feature:hover h3{transform:perspective(600px) translateZ(17px) rotateX(2deg)}
        .welcome-feature:hover p{transform:translateZ(8px)}
        .welcome-feature:hover>div:last-child{transform:translateZ(20px)}
        .welcome-cta{transform-style:preserve-3d;backface-visibility:hidden}
        .welcome-cta:hover{transform:perspective(750px) rotateX(-6deg) translateY(-4px) translateZ(14px) scale(1.015)}
        .welcome-cta:active{transform:perspective(750px) rotateX(2deg) translateY(0) translateZ(2px) scale(.985)}
        .welcome-cta>span{transform:translateZ(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.17)}
        .welcome-shell button:not(.welcome-cta):not(.community-emblem-control):hover{transform:perspective(650px) rotateX(-5deg) translateY(-2px) translateZ(9px)}
        .welcome-shell a:not(.welcome-cta):hover{transform:perspective(650px) rotateX(-3deg) translateY(-2px) translateZ(8px)}
        .welcome-shell svg{transform-style:preserve-3d;backface-visibility:visible}
        .welcome-shell button:not(.welcome-cta):not(.community-emblem-control):hover svg,.welcome-shell a:not(.welcome-cta):hover svg{transform:perspective(500px) rotateY(18deg) rotateX(-5deg) translateZ(7px);filter:drop-shadow(0 0 7px rgba(251,191,36,.45))}
        .welcome-art-shell{transform-style:preserve-3d;perspective:1400px;backface-visibility:hidden}
        .welcome-art-shell:hover{transform:perspective(1400px) rotateX(1.8deg) rotateY(-1.8deg) translateY(-5px) translateZ(8px)}
        .community-3d-stage{transform-style:preserve-3d}
        .artifact-status{transform:translateZ(20px);animation:welcome-edge-pulse 7s ease-in-out infinite}
        .artifact-status:last-child{animation-delay:-3.5s}
        .artifact-node{transform-style:preserve-3d;backface-visibility:hidden}
        .artifact-node:hover{transform:perspective(700px) rotateY(-5deg) rotateX(4deg) translateZ(84px) translateY(-5px)}
        .artifact-node.node-b:hover{transform:perspective(700px) rotateY(5deg) rotateX(4deg) translateZ(84px) translateY(-5px)}
        .artifact-node strong,.artifact-node small{transition:color .25s ease,text-shadow .25s ease,transform .3s ease}
        .artifact-node:hover strong{color:#fff;text-shadow:0 0 12px rgba(251,191,36,.35);transform:translateZ(7px)}
        .artifact-node:hover small{color:#fcd34d;transform:translateZ(4px)}
        .community-emblem-control:hover{transform:perspective(550px) rotateX(-5deg) translateZ(10px)}
        #features{perspective:1500px;transform-style:preserve-3d}
        #features>div:first-child{animation:welcome-depth-arrive .85s .08s both}
        #why-geajao{perspective:1300px;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.2,.75,.25,1),border-color .35s ease,box-shadow .35s ease}
        #why-geajao:hover{transform:perspective(1300px) rotateX(2deg) rotateY(-1deg) translateY(-4px) translateZ(10px);border-color:rgba(245,158,11,.34);box-shadow:0 35px 100px rgba(0,0,0,.35),0 0 36px rgba(217,119,6,.12)}
        #why-geajao h2:hover{transform:perspective(700px) rotateX(3deg) translateZ(15px)}
        .welcome-footer{transform-style:preserve-3d;perspective:1200px;animation:welcome-footer-glow 10s ease-in-out infinite}
        .welcome-footer a,.welcome-footer button{transform-style:preserve-3d;transition:transform .3s ease,color .25s ease,text-shadow .25s ease}
        .welcome-footer a:hover,.welcome-footer button:hover{transform:perspective(550px) rotateX(-5deg) translateY(-3px) translateZ(8px);text-shadow:0 0 18px rgba(245,158,11,.4)}
        .welcome-shell :is(header,#community,#features,#why-geajao,.welcome-footer){backface-visibility:hidden}
        @media(hover:none){.welcome-feature,.welcome-feature:hover{animation:none;transform:none;translate:0 0}.welcome-feature:hover{box-shadow:0 22px 55px rgba(217,119,6,.14)}.welcome-shell button:hover,.welcome-shell a:hover,.welcome-art-shell:hover,#why-geajao:hover{transform:none;translate:0 0}.welcome-shell p:hover{transform:none}.welcome-feature>div:first-child{animation:none}}
        @media(max-width:640px){.welcome-shell{perspective:1000px}.welcome-feature:hover{transform:translateY(-3px) scale(1.005)}.welcome-hero-title:hover>span:first-child,.welcome-hero-title:hover>span:nth-child(2){transform:none}#why-geajao:hover{transform:translateY(-2px)}}
        @media(prefers-reduced-motion:reduce){.welcome-shell>header,#features>div:first-child{animation:none!important}.welcome-feature,.welcome-feature>div:first-child,.artifact-status,.welcome-footer{animation:none!important}.welcome-shell *,.welcome-shell *:before,.welcome-shell *:after{transform:none!important;translate:none!important;rotate:none!important;scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}

        @keyframes welcome-ambient-breathe{0%,100%{opacity:.58;filter:brightness(.9)}50%{opacity:.9;filter:brightness(1.16)}}
        @keyframes welcome-grid-pan{0%{background-position:0 0,0 0}100%{background-position:54px 54px,-54px 54px}}
        @keyframes welcome-stage-atmosphere{0%,100%{background-position:0% 45%;filter:saturate(.96)}50%{background-position:100% 55%;filter:saturate(1.12)}}
        @keyframes welcome-stage-scan{0%{transform:translate3d(-12%,-120%,0) rotate(9deg);opacity:0}12%{opacity:.22}62%{opacity:.11}100%{transform:translate3d(12%,190%,0) rotate(9deg);opacity:0}}
        @keyframes welcome-dust-rise{0%{transform:translate3d(0,14vh,0) scale(.65);opacity:0}12%{opacity:.55}78%{opacity:.24}100%{transform:translate3d(28px,-56vh,0) scale(1.15);opacity:0}}
        @keyframes welcome-artifact-sway{0%,100%{transform:perspective(1100px) rotateY(-7deg) rotateX(2deg) translateY(0)}50%{transform:perspective(1100px) rotateY(7deg) rotateX(-2deg) translateY(-5px)}}
        @keyframes welcome-rail-glow{0%,100%{opacity:.35;transform:scaleX(.42)}50%{opacity:.9;transform:scaleX(1)}}
        @keyframes welcome-status-ping{0%,100%{opacity:.68;box-shadow:0 0 0 0 rgba(251,191,36,0)}50%{opacity:1;box-shadow:0 0 0 5px rgba(251,191,36,.08),0 0 13px rgba(251,191,36,.28)}}
        @keyframes welcome-cta-breath{0%,100%{box-shadow:0 12px 38px rgba(217,119,6,.25),inset 0 1px 0 rgba(255,255,255,.22)}50%{box-shadow:0 16px 46px rgba(217,119,6,.38),0 0 20px rgba(245,158,11,.09),inset 0 1px 0 rgba(255,255,255,.27)}}
        @keyframes welcome-title-light-pass{0%,65%,100%{background-position:0% 50%}84%{background-position:100% 50%}}
        .welcome-shell .welcome-orb{animation:welcome-drift 14s ease-in-out infinite,welcome-ambient-breathe 8s ease-in-out infinite}
        .welcome-shell .welcome-orb-slow{animation:welcome-drift 18s ease-in-out infinite reverse,welcome-ambient-breathe 10s ease-in-out infinite reverse}
        .welcome-shell .welcome-shell-grid{animation:welcome-grid-pan 42s linear infinite}
        .welcome-dust{opacity:0;animation:welcome-dust-rise 18s linear infinite;will-change:transform,opacity}
        .community-3d-stage{background-size:150% 150%;animation:welcome-stage-atmosphere 18s ease-in-out infinite}
        .community-3d-stage:after{content:'';position:absolute;inset:-65% -25%;z-index:0;pointer-events:none;opacity:0;background:linear-gradient(180deg,transparent 32%,rgba(245,158,11,.025) 43%,rgba(251,191,36,.16) 50%,rgba(217,119,6,.055) 55%,transparent 68%);animation:welcome-stage-scan 13s cubic-bezier(.55,0,.4,1) infinite}
        .welcome-art-shell:before{content:'';position:absolute;z-index:2;pointer-events:none;left:12%;right:12%;top:0;height:1px;transform-origin:center;background:linear-gradient(90deg,transparent,rgba(251,191,36,.9),rgba(245,158,11,.65),transparent);animation:welcome-rail-glow 5.6s ease-in-out infinite}
        .artifact-auto-sway{position:relative;width:250px;height:270px;flex:none;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d;animation:welcome-artifact-sway 10s ease-in-out infinite}
        .artifact-drag-area.is-dragging .artifact-auto-sway{animation-play-state:paused}
        .artifact-structure{width:250px;height:270px}
        .artifact-node.node-a{animation:welcome-float 5.5s ease-in-out infinite,welcome-edge-pulse 7.8s ease-in-out infinite}
        .artifact-node.node-b{animation:welcome-float 6.4s ease-in-out infinite reverse,welcome-edge-pulse 8.2s ease-in-out infinite -2.8s}
        .artifact-node.node-c{animation:welcome-float 6s ease-in-out infinite .7s,welcome-edge-pulse 7.2s ease-in-out infinite -4s}
        .artifact-status .rounded-full{animation:welcome-status-ping 2.8s ease-in-out infinite}
        .welcome-shell button.welcome-cta:not(:hover):not(:focus-visible){animation:welcome-cta-breath 7s ease-in-out infinite}
        .welcome-hero-title>span:not(.welcome-bengali){background-size:210% 100%;animation:welcome-title-light-pass 10s ease-in-out infinite,welcome-text-sheen 7s ease-in-out infinite}
        .welcome-auto-reveal{opacity:0;filter:blur(5px);clip-path:inset(0 0 14% 0 round 1.2rem);transition:opacity .8s ease,filter .8s ease,clip-path .9s cubic-bezier(.2,.75,.25,1)}
        .welcome-auto-reveal.is-in-view{opacity:1;filter:blur(0);clip-path:inset(0 0 0 0 round 1.2rem)}
        .welcome-auto-reveal-delay-1{transition-delay:.08s}
        .welcome-auto-reveal-delay-2{transition-delay:.16s}
        .welcome-auto-reveal-delay-3{transition-delay:.24s}
        .welcome-feature:after{animation:welcome-rail-glow 7s ease-in-out infinite}
        .welcome-feature:nth-child(2):after{animation-delay:-2.3s}
        .welcome-feature:nth-child(3):after{animation-delay:-4.6s}
        .welcome-footer{animation:welcome-footer-glow 10s ease-in-out infinite}
        @keyframes geajao-disc-spin{to{transform:rotate(360deg)}}
        @keyframes geajao-disc-spin-reverse{to{transform:rotate(-360deg)}}
        @keyframes geajao-disc-breathe{0%,100%{opacity:.58;filter:brightness(.9) saturate(.95)}50%{opacity:.94;filter:brightness(1.25) saturate(1.2)}}
        @keyframes geajao-logo-glow{0%,100%{filter:drop-shadow(0 0 8px rgba(217,119,6,.30))}50%{filter:drop-shadow(0 0 15px rgba(251,191,36,.62))}}
        @keyframes geajao-satellite-orbit{from{transform:rotate(0deg) translateX(48px) rotate(0deg)}to{transform:rotate(360deg) translateX(48px) rotate(-360deg)}}
        @keyframes geajao-feature-icon-bloom{0%,100%{box-shadow:0 0 0 rgba(217,119,6,0)}50%{box-shadow:0 0 24px rgba(217,119,6,.2),inset 0 0 15px rgba(251,191,36,.06)}}
        @keyframes geajao-box-breathe{0%,100%{border-color:rgba(245,158,11,.14)}50%{border-color:rgba(245,158,11,.30)}}
        @keyframes geajao-icon-orbit{0%,100%{rotate:0deg;scale:1}50%{rotate:4deg;scale:1.055}}
        @keyframes geajao-panel-scan{0%,8%{background-position:0% 0%;opacity:0}24%{opacity:.48}45%,100%{background-position:180% 0%;opacity:0}}
        @keyframes geajao-text-glint{0%,76%,100%{background-position:120% 50%}88%{background-position:-20% 50%}}
        .geajao-logo-disk{position:relative;isolation:isolate;overflow:visible;transform-style:preserve-3d}
        .geajao-logo-disk:before{content:'';position:absolute;z-index:0;inset:-4px;pointer-events:none;border-radius:inherit;background:conic-gradient(from 0deg,transparent 0deg 42deg,rgba(217,119,6,.05) 65deg,rgba(245,158,11,.92) 105deg,rgba(251,191,36,.98) 132deg,rgba(217,119,6,.22) 166deg,transparent 205deg 270deg,rgba(217,119,6,.6) 315deg,transparent 360deg);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2.1px),#000 calc(100% - 1.2px));mask:radial-gradient(farthest-side,transparent calc(100% - 2.1px),#000 calc(100% - 1.2px));animation:geajao-disc-spin 4.8s linear infinite;filter:drop-shadow(0 0 5px rgba(217,119,6,.35))}
        .geajao-logo-disk:after{content:'';position:absolute;z-index:0;inset:3px;border-radius:inherit;pointer-events:none;background:conic-gradient(from 30deg,transparent 0deg 190deg,rgba(251,191,36,.25) 220deg,transparent 252deg 360deg);animation:geajao-disc-spin-reverse 7.4s linear infinite,geajao-disc-breathe 5s ease-in-out infinite}
        .geajao-logo-disk>img,.geajao-logo-disk>svg{position:relative;z-index:3;animation:geajao-logo-glow 5.4s ease-in-out infinite}
        .geajao-logo-disk-header{border-color:rgba(245,158,11,.28);box-shadow:0 0 26px rgba(217,119,6,.18),inset 0 0 14px rgba(217,119,6,.08)}
        .geajao-logo-disk-header:before{inset:-5px;border-radius:20px;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 1.8px),#000 calc(100% - 1px));mask:radial-gradient(farthest-side,transparent calc(100% - 1.8px),#000 calc(100% - 1px))}
        .geajao-logo-disk-header:after{inset:3px;border-radius:14px}
        .geajao-logo-disk-emblem{overflow:visible}
        .geajao-logo-disk-emblem:before{inset:-3px;border-radius:34px}
        .geajao-logo-disk-emblem:after{inset:5px;border-radius:26px}
        .geajao-disk-face{position:absolute;z-index:0;inset:8px;border:1px solid rgba(252,211,77,.24);border-radius:50%;background:repeating-radial-gradient(circle at center,transparent 0 5px,rgba(245,158,11,.18) 6px,transparent 7px 12px),conic-gradient(from 0deg,rgba(217,119,6,.06),rgba(251,191,36,.33),rgba(217,119,6,.08),rgba(245,158,11,.32),rgba(217,119,6,.06)),radial-gradient(circle at 35% 28%,rgba(245,158,11,.22),rgba(8,12,28,.86) 72%);animation:geajao-disc-spin 11s linear infinite,geajao-disc-breathe 5.5s ease-in-out infinite;box-shadow:inset 0 0 18px rgba(217,119,6,.24)}
        .geajao-disk-track{position:absolute;z-index:1;inset:11px;border:1px dashed rgba(252,211,77,.52);border-radius:50%;pointer-events:none}
        .geajao-disk-track-one{animation:geajao-disc-spin 7s linear infinite}
        .geajao-disk-track-two{inset:16px;border-color:rgba(180,83,9,.55);border-style:solid;border-left-color:transparent;border-bottom-color:rgba(251,191,36,.4);animation:geajao-disc-spin-reverse 5.6s linear infinite}
        .geajao-disk-satellite{position:absolute;z-index:2;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border:1px solid rgba(224,242,254,.95);border-radius:50%;background:#fbbf24;box-shadow:0 0 10px rgba(251,191,36,.9),0 0 18px rgba(217,119,6,.7);pointer-events:none}
        .geajao-disk-satellite-one{animation:geajao-satellite-orbit 5.4s linear infinite}
        .geajao-disk-satellite-two{width:4px;height:4px;background:#818cf8;box-shadow:0 0 10px rgba(245,158,11,.95);animation:geajao-satellite-orbit 7.2s linear infinite reverse}
        .welcome-feature:before{opacity:.18;animation:geajao-panel-scan 12s ease-in-out infinite}
        .welcome-feature:nth-child(2):before{animation-delay:-4s}
        .welcome-feature:nth-child(3):before{animation-delay:-8s}
        .welcome-feature>div:first-child{animation:geajao-feature-icon-bloom 6s ease-in-out infinite}
        .welcome-feature:nth-child(2)>div:first-child{animation-delay:-2s}
        .welcome-feature:nth-child(3)>div:first-child{animation-delay:-4s}
        .welcome-feature>div:first-child svg{transform-origin:center;animation:geajao-icon-orbit 7s ease-in-out infinite}
        .artifact-node{animation:welcome-float 5.5s ease-in-out infinite,geajao-box-breathe 7s ease-in-out infinite}
        .artifact-node.node-b{animation-delay:-2.8s,-3s}
        .artifact-node.node-c{animation-delay:.7s,-4s}
        .artifact-node .node-icon{animation:geajao-feature-icon-bloom 5.5s ease-in-out infinite}
        .artifact-status{animation:geajao-box-breathe 8s ease-in-out infinite}
        .artifact-status:nth-of-type(2){animation-delay:-3s}
        .welcome-shell .community-emblem-control{background-image:linear-gradient(110deg,transparent 0%,rgba(245,158,11,.13) 48%,transparent 60%);background-size:220% 100%;animation:geajao-panel-scan 8s ease-in-out infinite}
        .welcome-shell .welcome-section-title{background-image:linear-gradient(110deg,#fff 0%,#fef3c7 38%,#fbbf24 50%,#fff 62%,#fff 100%);background-size:230% 100%;background-repeat:no-repeat;background-clip:text;-webkit-background-clip:text;animation:geajao-text-glint 12s ease-in-out infinite}
        #why-geajao{animation:welcome-depth-arrive .85s .08s both,geajao-box-breathe 9s 1s ease-in-out infinite}
        .welcome-footer{background-image:linear-gradient(110deg,rgba(10,14,32,.98),rgba(14,20,46,.98),rgba(10,14,32,.98));background-size:200% 100%;animation:welcome-footer-glow 10s ease-in-out infinite,welcome-title-light-pass 20s ease-in-out infinite}

        @keyframes geajao-insignia-orbit-a{from{transform:translate(-50%,-50%) rotateX(67deg) rotateZ(0deg)}to{transform:translate(-50%,-50%) rotateX(67deg) rotateZ(360deg)}}
        @keyframes geajao-insignia-orbit-b{from{transform:translate(-50%,-50%) rotateY(63deg) rotateZ(0deg)}to{transform:translate(-50%,-50%) rotateY(63deg) rotateZ(-360deg)}}
        @keyframes geajao-insignia-orbit-c{0%,100%{transform:translate(-50%,-50%) rotateX(8deg) rotateY(8deg) scale(.94);opacity:.36}50%{transform:translate(-50%,-50%) rotateX(-8deg) rotateY(-8deg) scale(1.08);opacity:.88}}
        @keyframes geajao-insignia-spark{0%,100%{opacity:.16;scale:.65}50%{opacity:1;scale:1.35}}
        @keyframes geajao-emblem-core-breathe{0%,100%{box-shadow:0 0 34px rgba(217,119,6,.26),inset 0 0 18px rgba(251,191,36,.08)}50%{box-shadow:0 0 62px rgba(217,119,6,.48),0 0 25px rgba(251,191,36,.22),inset 0 0 28px rgba(251,191,36,.18)}}
        @keyframes geajao-emblem-glisten{0%,58%,100%{transform:translateX(-145%) skewX(-16deg);opacity:0}67%{opacity:.8}82%{transform:translateX(145%) skewX(-16deg);opacity:0}}
        @keyframes geajao-card-idle{0%,100%{transform:translateY(0) rotateX(0deg)}50%{transform:translateY(-3px) rotateX(.5deg)}}
        @keyframes geajao-feature-icon-idle{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-2px) rotate(2deg)}}
        @keyframes geajao-stage-glow{0%,100%{opacity:.45;transform:scale(.92)}50%{opacity:.8;transform:scale(1.06)}}

        .welcome-shell{overflow-x:clip}
        .welcome-shell>header{flex-shrink:0}
        .welcome-shell>main{width:100%;grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);column-gap:clamp(1.75rem,3.2vw,3rem);row-gap:clamp(2rem,4vh,3rem);padding-top:clamp(1.5rem,4vh,3rem);padding-bottom:clamp(2.25rem,4vh,3.5rem)}
        .welcome-shell>main>section{min-width:0}
        .welcome-hero-title{max-width:100%;font-size:clamp(4.8rem,8.2vw,8.5rem)!important;line-height:.78!important}
        .welcome-hero-title>span:not(.welcome-bengali){max-width:100%;white-space:nowrap;transform:scaleX(.9) skewX(-1.5deg)}
        .welcome-hero-title>span:nth-child(2){letter-spacing:-.005em}
        #community{width:100%;min-width:0;max-width:680px;align-self:start}
        .welcome-art-shell{width:100%;min-width:0;border-radius:1.6rem}
        .community-3d-stage{min-width:0;padding:18px 12px 12px!important;background-size:150% 150%;min-height:0!important;height:auto!important;display:flex;flex-direction:column;justify-content:flex-start!important;gap:0!important}
        .community-3d-stage>.relative.flex{width:100%;min-width:0;height:clamp(228px,39vw,315px)!important;flex:0 0 clamp(228px,39vw,315px)!important;min-height:0!important;margin:0!important}
        .community-3d-stage>.relative.flex+.relative.z-10{margin-top:0!important;flex:0 0 auto}
        .community-3d-stage>.relative.z-10 h2{margin-top:0;line-height:1.12}
        .community-3d-stage>.relative.z-10 p{margin-top:3px!important;line-height:1.45}
        .community-3d-stage>.relative.z-10 .community-emblem-control{padding:7px 11px}
        .artifact-drag-area{width:100%;min-width:0;overflow:visible;contain:layout style}
        .artifact-auto-sway,.artifact-structure{width:clamp(190px,30vw,250px);height:clamp(205px,32.5vw,270px)}
        .artifact-orbit-ring{width:min(340px,calc(100vw - 70px))}
        .artifact-orbit-ring.ring-two{width:min(390px,calc(100vw - 56px))}
        .artifact-orbit-ring.ring-three{width:min(300px,calc(100vw - 84px));height:min(350px,calc(100vw - 58px))}
        .artifact-node{max-width:42%;min-width:0;padding:9px 10px;gap:7px;z-index:8}
        .artifact-node strong{font-size:9px}
        .artifact-node small{font-size:8px}
        .artifact-node.node-a{left:1.5%;top:23%}
        .artifact-node.node-b{right:1.5%;top:33%}
        .artifact-node.node-c{left:3%;bottom:13%}
        .artifact-node .node-icon{width:27px;height:27px;border-radius:9px}
        .artifact-status{position:absolute!important;top:10px!important;bottom:auto!important;z-index:12!important;max-width:44%}
        .artifact-status p{margin:0}
        .artifact-status p+p{margin-top:3px}
        #features{margin-top:0!important;padding-top:0!important}
        #features>div:first-child{margin-bottom:22px!important}
        #features .grid{align-items:stretch}
        .welcome-feature{height:100%;min-width:0}
        #why-geajao{margin-top:0!important;gap:1.5rem}
        .welcome-footer{margin-top:auto}

        @keyframes geajao-platform-pulse{0%,100%{opacity:.4;filter:brightness(.85)}50%{opacity:.9;filter:brightness(1.3)}}
        .artifact-holo-platform{position:absolute;left:50%;bottom:3.5%;z-index:0;width:60%;height:38px;border:1px solid rgba(245,158,11,.7);border-radius:50%;pointer-events:none;transform:translateX(-50%) rotateX(68deg) translateZ(-26px);background:radial-gradient(ellipse,rgba(217,119,6,.2),rgba(8,12,28,.04) 60%,transparent 72%);box-shadow:0 0 18px rgba(217,119,6,.22),inset 0 0 14px rgba(251,191,36,.12);animation:geajao-platform-pulse 5.5s ease-in-out infinite}
        .artifact-holo-platform:before,.artifact-holo-platform:after{content:'';position:absolute;left:50%;top:50%;border:1px solid rgba(251,191,36,.3);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
        .artifact-holo-platform:before{width:76%;height:70%}
        .artifact-holo-platform:after{width:48%;height:42%;border-color:rgba(253,230,138,.4)}

        .webgl-artifact-auto-sway{width:clamp(270px,35vw,340px)!important;height:clamp(290px,37vw,360px)!important;display:flex;align-items:center;justify-content:center}
        .webgl-crystal-structure{position:relative!important;width:100%!important;height:100%!important;display:block;isolation:isolate;perspective:480px!important;transform:none!important;filter:none!important;animation:none!important;overflow:visible!important}
        .webgl-crystal-renderer{position:absolute;inset:0;z-index:1;overflow:visible;pointer-events:none}
        .crystal-webgl-canvas{display:block;position:absolute;inset:0;width:100%;height:100%;background:transparent;outline:none}
        .crystal-webgl-canvas.is-unavailable{display:none}
        .crystal-webgl-fallback{position:absolute;width:72%;height:74%;left:14%;top:12%;clip-path:polygon(25% 0,75% 0,100% 25%,100% 75%,75% 100%,25% 100%,0 75%,0 25%);background:linear-gradient(145deg,#2871d8,#071a42 55%,#020817);border:1px solid rgba(252,211,77,.65);box-shadow:inset 0 0 0 5px rgba(245,158,11,.12),0 0 50px rgba(217,119,6,.35)}
        .webgl-crystal-structure .artifact-webgl-overlay{position:absolute!important;inset:0!important;z-index:4!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:0!important;pointer-events:none!important;transform-style:preserve-3d!important;transform-origin:center center!important;backface-visibility:hidden;will-change:transform;transition:none!important}
        .webgl-crystal-structure .artifact-logo-frame{position:relative!important;z-index:3!important;width:76px!important;height:76px!important;flex:none!important;margin:0 0 1px!important;border-radius:18px!important;clip-path:polygon(20% 0,80% 0,100% 20%,100% 80%,80% 100%,20% 100%,0 80%,0 20%);transform:translateZ(2px)!important;transform-style:preserve-3d!important;border:1.5px solid rgba(253,230,138,.88)!important;background:radial-gradient(circle at 28% 18%,rgba(252,211,77,.36),rgba(5,16,41,.96) 72%)!important;box-shadow:0 0 0 3px rgba(217,119,6,.14),0 0 24px rgba(217,119,6,.28),inset 0 1px 0 rgba(255,255,255,.38),inset 0 -8px 16px rgba(0,0,0,.48)!important;overflow:hidden}
        .webgl-crystal-structure .artifact-logo-frame:before{inset:-4px!important;border-radius:inherit!important;transform:translateZ(-1px)!important;opacity:.75}
        .webgl-crystal-structure .artifact-logo-frame:after{inset:4px!important;border-radius:inherit!important;transform:translateZ(1px)!important}
        .webgl-crystal-structure .artifact-logo-frame>.geajao-disk-face{inset:6px!important;border-radius:inherit!important}
        .webgl-crystal-structure .artifact-logo-frame>.geajao-disk-track-one{inset:9px!important}
        .webgl-crystal-structure .artifact-logo-frame>.geajao-disk-track-two{inset:14px!important}
        .webgl-crystal-structure .artifact-logo-frame>.geajao-disk-sheen{inset:5px!important;border-radius:12px!important}
        .webgl-crystal-structure .artifact-logo-frame>img,.webgl-crystal-structure .artifact-logo-frame>svg{position:relative!important;z-index:4!important;width:48px!important;height:48px!important;object-fit:contain;filter:drop-shadow(0 0 8px rgba(252,211,77,.55))}
        .webgl-crystal-structure .artifact-brand{position:relative!important;z-index:3!important;margin:0!important;font-size:14px!important;line-height:1.18!important;letter-spacing:.14em!important;font-weight:800!important;color:#f8fbff!important;text-shadow:0 2px 9px rgba(0,0,0,.65),0 0 15px rgba(245,158,11,.45)!important;transform:translateZ(1px)}
        .webgl-crystal-structure .artifact-tagline{position:relative!important;z-index:3!important;margin:0!important;font-size:6px!important;line-height:1.2!important;letter-spacing:.17em!important;font-weight:700!important;color:#a5e7ff!important;text-shadow:0 0 10px rgba(245,158,11,.35)!important;transform:translateZ(1px)}
        .webgl-crystal-structure .artifact-emblem-serial{position:absolute!important;right:22%!important;bottom:21%!important;z-index:2!important;font-size:5px!important;letter-spacing:.16em!important;color:rgba(253,230,138,.32)!important}

        @media(min-width:1024px){
          .welcome-shell>main{min-height:auto}
          .welcome-shell>main>section:first-child{padding-right:.25rem}
          #community{justify-self:end}
        }
        @media(max-width:1023px){
          .welcome-shell>main{grid-template-columns:minmax(0,1fr);gap:2.5rem;padding-top:2rem}
          .welcome-shell>main>section:first-child{max-width:650px}
          #community{max-width:650px;justify-self:center}
          .welcome-hero-title{font-size:clamp(5rem,12vw,7.5rem)!important}
        }
        @media(max-width:640px){
          .welcome-shell>main{gap:2rem;padding:1.5rem 1rem 2.5rem}
          .welcome-hero-title{font-size:clamp(4.6rem,18vw,6.2rem)!important;line-height:.8!important}
          .welcome-hero-title>span:not(.welcome-bengali){transform:scaleX(.92) skewX(-1deg)}
          .welcome-bengali{font-size:clamp(1.4rem,6vw,1.9rem)!important;margin-top:.7rem!important}
          .welcome-art-shell{border-radius:1.25rem}
          .community-3d-stage{padding:12px 8px 10px!important}
          .community-3d-stage>.relative.flex{height:clamp(220px,49vw,275px)!important;flex-basis:clamp(220px,49vw,275px)!important}
          .artifact-status{display:none!important}
          .artifact-node.node-a{top:2px!important;left:5px!important}
          .artifact-node.node-b{top:2px!important;right:5px!important}
          .artifact-node.node-c{bottom:2px!important}
          .artifact-orbit-ring.ring-three{height:min(260px,calc(100vw - 90px))}
          #features{padding-left:1rem;padding-right:1rem;padding-bottom:3rem}
          #features .grid{gap:.9rem}
          .welcome-feature{padding:1.15rem}
          #why-geajao{width:calc(100% - 2rem);margin-bottom:3rem;padding:1.35rem;border-radius:1.35rem}
          .welcome-footer{min-height:130px;padding:1.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom))}
          .webgl-artifact-auto-sway{width:min(270px,78vw)!important;height:min(290px,82vw)!important}
          .webgl-crystal-structure .artifact-logo-frame{width:64px!important;height:64px!important;border-radius:16px!important}
          .webgl-crystal-structure .artifact-logo-frame>img,.webgl-crystal-structure .artifact-logo-frame>svg{width:40px!important;height:40px!important}
          .webgl-crystal-structure .artifact-brand{font-size:12px!important}
          .webgl-crystal-structure .artifact-tagline{font-size:5.2px!important;letter-spacing:.15em!important}
        }
        .geajao-logo-disk{cursor:pointer}
.geajao-logo-disk.geajao-logo-disk-header:hover{border-color:rgba(252,211,77,.7);box-shadow:0 0 42px rgba(251,191,36,.45),inset 0 0 20px rgba(251,191,36,.18)}
/* lets the big emblem logo be hovered too (the overlay is pointer-events:none) */
.webgl-crystal-structure .artifact-logo-frame{pointer-events:auto!important}
      `}</style>

      {/* Deep-blue and black ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_52%_12%,rgba(30,64,175,.30),transparent_35%),radial-gradient(ellipse_at_8%_55%,rgba(30,64,175,.13),transparent_32%),linear-gradient(135deg,#080c1c_0%,#0f1530_48%,#080c1c_100%)]" />
        <div className="welcome-orb absolute -left-36 top-[12%] h-80 w-80 rounded-full bg-[#f59e0b]/15 blur-[110px] sm:h-[30rem] sm:w-[30rem]" />
        <div className="welcome-orb-slow absolute -right-40 top-[20%] h-[32rem] w-[32rem] rounded-full bg-[#d97706]/20 blur-[125px]" />
        <div className="welcome-shell-grid absolute inset-0 opacity-[0.075]" style={{ backgroundImage: 'linear-gradient(rgba(245,158,11,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,.8) 1px, transparent 1px)', backgroundSize: '54px 54px', maskImage: 'linear-gradient(to bottom, black, transparent 88%)' }} />
        <div className="welcome-orbit absolute left-[73%] top-[30%] h-[min(72vw,680px)] w-[min(72vw,680px)] rounded-full border border-[#fbbf24]/[0.10]" />
        <div className="welcome-orbit absolute left-[77%] top-[34%] h-[min(54vw,500px)] w-[min(54vw,500px)] rounded-full border border-[#fbbf24]/[0.10]" style={{ animationDirection: 'reverse', animationDuration: '26s' }} />
        {Array.from({ length: 18 }, (_, i) => <span key={i} className="welcome-twinkle absolute h-1 w-1 rounded-full bg-[#fcd34d] shadow-[0_0_12px_rgba(245,158,11,.9)]" style={{ left: `${(i * 37 + 9) % 97}%`, top: `${(i * 23 + 8) % 88}%`, animationDelay: `${(i % 7) * .35}s` }} />)}
        {Array.from({ length: 13 }, (_, i) => <span key={`dust-${i}`} className="welcome-dust absolute h-[2px] w-[2px] rounded-full bg-[#fde68a] shadow-[0_0_9px_rgba(245,158,11,.75)]" style={{ left: `${(i * 29 + 13) % 96}%`, top: `${(i * 31 + 74) % 100}%`, animationDelay: `${(i % 6) * -2.1}s`, animationDuration: `${15 + (i % 5) * 2}s` }} />)}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#fbbf24]/50 to-transparent" />
      </div>

      {/* Optional community slideshow */}
      {hasPhotos && (
        <div className="pointer-events-none absolute inset-0" aria-label="Featured community photos">
          {photos.map((url, idx) => (
            // EGRESS FIX (edit 4/4): every slide keeps its container (so the crossfade still works),
            // but an <img> only gets a src when it is current, fading out, or next in line.
            <div key={`${url}-${idx}`} className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out" style={{ opacity: idx === slide.cur ? 0.22 : 0 }} aria-hidden={idx !== slide.cur}>
              <img src={shouldLoad(idx) ? url : undefined} alt={`Community showcase ${idx + 1}`} decoding="async" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[#080c1c]/78" />
            </div>
          ))}
        </div>
      )}

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="geajao-logo-disk geajao-logo-disk-header relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#fbbf24]/30 bg-gradient-to-br from-[#f59e0b]/20 to-[#fbbf24]/10 shadow-[0_0_30px_rgba(217,119,6,.22)] ring-1 ring-white/[0.04]">
            <Logo className="h-9 w-9 drop-shadow-[0_0_15px_rgba(245,158,11,.42)]" />
          </div>
          <div className="text-left">
            <p className="geajao-wordmark text-[15px] font-extrabold leading-none text-[#fef3c7] sm:text-[17px]">Geajao</p>
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[.22em] text-[#fcd34d]/65">.CADETS.</p>
          </div>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-[#e2e8f0]/80 md:flex">
          <a href="#community" className="transition hover:text-[#fcd34d]">Community</a>
          <a href="#features" className="transition hover:text-[#fcd34d]">Features</a>
          <a href="#why-geajao" className="transition hover:text-[#fcd34d]">Why Geajao</a>
        </nav>
        <button onClick={onGetIn} className="inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/25 bg-[#f59e0b]/10 px-4 py-2.5 text-xs font-semibold text-[#fde68a] transition hover:border-[#fcd34d]/50 hover:bg-[#f59e0b]/20 sm:text-sm">
          Sign in <ArrowUpRight size={15} />
        </button>
      </header>

      {hasPhotos && photos.length > 1 && (
        <div className="absolute right-5 top-24 z-20 flex items-center gap-2 sm:right-8">
          <button onClick={goPrev} className="rounded-full border border-white/10 bg-black/30 p-2 text-[#fef3c7]/75 backdrop-blur-xl transition hover:border-[#fbbf24]/40 hover:text-[#fef3c7]" aria-label="Previous slide"><ChevronLeft size={18} /></button>
          <button onClick={goNext} className="rounded-full border border-white/10 bg-black/30 p-2 text-[#fef3c7]/75 backdrop-blur-xl transition hover:border-[#fbbf24]/40 hover:text-[#fef3c7]" aria-label="Next slide"><ChevronRight size={18} /></button>
        </div>
      )}

      <main className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 lg:grid-cols-[1.03fr_.97fr] lg:gap-8 lg:px-12 lg:py-12">
        <section className="welcome-rise relative z-10 mx-auto w-full max-w-2xl text-center lg:mx-0 lg:text-left">
          <div className="welcome-eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/20 bg-[#f59e0b]/[0.09] px-4 py-2 text-[10px] font-semibold uppercase tracking-[.25em] text-[#fde68a] shadow-[0_0_32px_rgba(217,119,6,.09)] sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_10px_rgba(245,158,11,.9)]" />
            A community built for cadets
          </div>

          <p className="welcome-eyebrow mb-4 text-[10px] font-medium uppercase tracking-[.36em] text-[#fcd34d]/60 sm:text-xs">Your people. Your space.</p>
          <h1 className="welcome-hero-title welcome-rise welcome-delay-1 mb-5 welcome-display text-5xl font-black uppercase leading-[.98] tracking-[-.045em] sm:text-6xl md:text-7xl xl:text-[5.7rem]">
            <span className="block bg-gradient-to-r from-white via-[#fef3c7] to-[#fde68a] bg-clip-text pb-2 text-transparent">Cholo</span>
            <span className="block bg-gradient-to-r from-[#fcd34d] via-[#fbbf24] to-[#f59e0b] bg-clip-text pb-2 text-transparent">Geajai.</span>
            <span lang="bn" className="welcome-bengali mt-3 block text-[#fef3c7]/85">চলো গ্যাজাই</span>
          </h1>

          <p className="welcome-rise welcome-delay-2 mx-auto mb-8 max-w-xl text-sm leading-7 text-[#e2e8f0]/75 sm:text-base sm:leading-8 lg:mx-0">
            Your own corner of the internet to meet fellow cadets, share moments, and keep your circle close. Real connections start here.
          </p>

          <div className="welcome-rise welcome-delay-2 mb-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <button onClick={onGetIn} className="welcome-cta group inline-flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full border border-[#fcd34d]/30 bg-gradient-to-r from-[#d97706] via-[#f59e0b] to-[#fbbf24] px-7 py-4 text-base font-bold text-[#fef3c7] transition duration-300 hover:-translate-y-0.5 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-[#fbbf24] focus:ring-offset-4 focus:ring-offset-[#080c1c] sm:w-auto sm:min-w-56">
              Join the community
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-1"><ArrowRight size={19} /></span>
            </button>
            <a href="#features" className="inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold text-[#e2e8f0] transition hover:text-[#fcd34d]">
              Explore features <ArrowRight size={16} />
            </a>
          </div>

          <div className="welcome-rise welcome-delay-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs text-[#cbd5e1]/90 lg:justify-start">
            <span className="inline-flex items-center gap-2"><Shield size={14} className="text-[#fbbf24]" /> Verified community</span>
            <span className="inline-flex items-center gap-2"><Users size={14} className="text-[#fbbf24]" /> Made for cadets</span>
            <span className="inline-flex items-center gap-2"><Heart size={14} className="text-[#fbbf24]" /> Find your circle</span>
          </div>
        </section>

        {/* Interactive 3D WebGL Crystal Insignia */}
        <section id="community" className="welcome-rise welcome-delay-2 relative mx-auto w-full max-w-[720px] lg:ml-auto">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[74%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d97706]/20 blur-[90px]" />
          <div className="welcome-art-shell relative overflow-hidden rounded-[1.7rem] border border-[#fbbf24]/15 sm:rounded-[2rem]">
            <div className="community-3d-stage relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden px-4 pb-4 pt-7 sm:min-h-[470px] sm:pt-8">
              <div aria-hidden="true" className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(245,158,11,.28) 1px, transparent 1px),linear-gradient(90deg,rgba(245,158,11,.28) 1px,transparent 1px)', backgroundSize: '34px 34px', maskImage: 'radial-gradient(ellipse at center, black, transparent 78%)' }} />
              <div aria-hidden="true" className="absolute left-1/2 top-[46%] h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fbbf24]/[0.12] sm:h-[405px] sm:w-[405px]" />
              <div aria-hidden="true" className="welcome-orbit absolute left-1/2 top-[46%] h-[365px] w-[365px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fbbf24]/[0.14] sm:h-[455px] sm:w-[455px]" />
              <div className="relative flex h-[300px] w-full items-center justify-center sm:h-[350px]" style={{ perspective: '1200px' }}>
                <div className={`artifact-drag-area relative flex h-full w-full items-center justify-center ${isArtifactDragging ? 'is-dragging' : ''}`}
                  onPointerDown={handleArtifactPointerDown}
                  onPointerMove={handleArtifactPointerMove}
                  onPointerUp={stopArtifactDrag}
                  onPointerCancel={stopArtifactDrag}
                  role="img"
                  aria-label="Interactive 3D Geajao crystal emblem. Drag to tilt and rotate."
                  style={{ touchAction: 'pan-y' }}>
                  <div className="artifact-holo-platform" aria-hidden="true" />
                  <div className="absolute bottom-[12%] h-10 w-[52%] rounded-[50%] bg-[#d97706]/25 blur-2xl" />
                  <div className="artifact-particle-field" aria-hidden="true">
                    {Array.from({ length: 18 }, (_, i) => (
                      <span key={i} className={`artifact-particle artifact-particle-${(i % 6) + 1}`} style={{ animationDelay: `${-(i * 0.61)}s`, animationDuration: `${9 + (i % 5) * 1.7}s` }} />
                    ))}
                  </div>
                  <div className="artifact-orbit-ring ring-two" />
                  <div className="artifact-orbit-ring ring-three" />
                  <div className="artifact-orbit-ring" />
                  <div className="artifact-auto-sway webgl-artifact-auto-sway">
                    <div className="artifact-structure webgl-crystal-structure">
                      <WebGLCrystal rotationX={artifactRotation.x} rotationY={artifactRotation.y} dragging={isArtifactDragging} overlayRef={artifactOverlayRef} />
                      <div
                        ref={artifactOverlayRef}
                        className="artifact-webgl-overlay"
                        aria-hidden="true"
                        style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
                      >
                        <div className="artifact-logo-frame geajao-logo-disk geajao-logo-disk-emblem">
                          <span className="geajao-disk-face" aria-hidden="true" />
                          <span className="geajao-disk-track geajao-disk-track-one" aria-hidden="true" />
                          <span className="geajao-disk-track geajao-disk-track-two" aria-hidden="true" />
                          <span className="geajao-disk-satellite geajao-disk-satellite-one" aria-hidden="true" />
                          <span className="geajao-disk-satellite geajao-disk-satellite-two" aria-hidden="true" />
                          <span className="geajao-disk-sheen" aria-hidden="true" />
                          <Logo className="h-16 w-16 drop-shadow-[0_0_24px_rgba(252,211,77,.55)] sm:h-20 sm:w-20" />
                        </div>
                        <div className="artifact-brand">Geajao</div>
                        <div className="artifact-tagline">CADET COMMUNITY</div>
                        <div className="artifact-emblem-serial" aria-hidden="true">GJ / 01</div>
                      </div>
                    </div>
                  </div>
                  <div className="artifact-node node-a"><span className="node-icon"><Users size={16} /></span><span><strong>Find your circle</strong><small>People who get you</small></span></div>
                  <div className="artifact-node node-b"><span className="node-icon"><MessageCircle size={16} /></span><span><strong>Stay connected</strong><small>Conversations that matter</small></span></div>
                  <div className="artifact-node node-c"><span className="node-icon"><Shield size={16} /></span><span><strong>Verified space</strong><small>Built for cadets</small></span></div>
                </div>
              </div>
              <div className="relative z-10 mt-0 flex flex-col items-center text-center">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/15 bg-[#fbbf24]/[.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.22em] text-[#fde68a]/90"><span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_9px_rgba(251,191,36,.9)]" /> Your network, your space</div>
                <h2 className="welcome-display text-lg font-bold tracking-tight text-[#fef3c7] sm:text-xl">More than a social feed.</h2>
                <p className="mt-1 max-w-sm text-xs leading-5 text-[#cbd5e1]">A community identity with room to connect, share, and grow.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={rotateArtifact} className="community-emblem-control inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold" aria-label="Rotate emblem"><Sparkles size={14} /> Rotate emblem</button>
                  <span className="text-[10px] text-[#94a3b8]">or drag to explore</span>
                </div>
              </div>
              <div className="artifact-status absolute left-4 top-4 hidden rounded-xl px-3 py-2 sm:block"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[#fde68a]">GEAJAO / CORE</p><p className="mt-1 text-[10px] text-[#cbd5e1]">Community identity system</p></div>
              <div className="artifact-status absolute right-4 top-4 hidden items-center gap-2 rounded-xl px-3 py-2 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_9px_rgba(245,158,11,.65)]"/><span className="text-[9px] font-medium text-[#e2e8f0]">NETWORK ONLINE</span></div>
            </div>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-[9px] font-medium uppercase tracking-[.22em] text-[#fde68a]/45 sm:text-[10px]"><span className="h-px w-8 bg-[#fbbf24]/25" /> YOUR JOURNEY <span className="text-[#fcd34d]/60">×</span> OUR COMMUNITY <span className="h-px w-8 bg-[#fbbf24]/25" /></p>
        </section>
      </main>

      <section id="features" className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <div className="mb-8 flex flex-col gap-3 text-center sm:mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[.3em] text-[#fcd34d]/80">Everything in one place</p>
          <h2 className="welcome-section-title text-3xl font-black tracking-tight text-[#fef3c7] sm:text-4xl md:text-5xl">Made for your kind of connection.</h2>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-[#cbd5e1]">More than a feed. A shared space for the people who understand your journey.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="welcome-auto-reveal welcome-auto-reveal-delay-1 welcome-glass welcome-feature rounded-3xl p-5 sm:p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/10 text-[#fcd34d]"><Users size={22} /></div>
            <h3 className="text-base font-bold text-[#fef3c7]">Find your people</h3>
            <p className="mt-2 text-sm leading-6 text-[#cbd5e1]">Discover fellow cadets, build your circle, and make connections that feel familiar.</p>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#fcd34d]">Discover community <ArrowRight size={14} /></div>
          </article>
          <article className="welcome-auto-reveal welcome-auto-reveal-delay-2 welcome-glass welcome-feature rounded-3xl p-5 sm:p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/10 text-[#fcd34d]"><Layers3 size={22} /></div>
            <h3 className="text-base font-bold text-[#fef3c7]">Share your moments</h3>
            <p className="mt-2 text-sm leading-6 text-[#cbd5e1]">Post updates, share memories, and see what your community is up to.</p>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#fcd34d]">Your story, your way <ArrowRight size={14} /></div>
          </article>
          <article className="welcome-auto-reveal welcome-auto-reveal-delay-3 welcome-glass welcome-feature rounded-3xl p-5 sm:p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/10 text-[#fcd34d]"><MessageCircle size={22} /></div>
            <h3 className="text-base font-bold text-[#fef3c7]">Keep the conversation going</h3>
            <p className="mt-2 text-sm leading-6 text-[#cbd5e1]">Stay close to friends with direct conversations and a community that moves with you.</p>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#fcd34d]">Stay connected <ArrowRight size={14} /></div>
          </article>
        </div>
      </section>

      <section id="why-geajao" className="welcome-auto-reveal welcome-auto-reveal-delay-2 relative z-10 mx-auto mb-16 w-[calc(100%-2.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-[#fbbf24]/15 bg-gradient-to-r from-[#0b1740]/80 via-[#0b1740]/90 to-[#0b1740]/50 px-6 py-8 shadow-[0_25px_90px_rgba(0,0,0,.25)] sm:mb-20 sm:w-[calc(100%-4rem)] sm:px-10 sm:py-10 lg:flex lg:items-center lg:justify-between lg:px-12">
        <div className="absolute right-[-3rem] top-[-5rem] h-56 w-56 rounded-full bg-[#f59e0b]/15 blur-[75px]" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.3em] text-[#fcd34d]/80">Your community is waiting</p>
          <h2 className="welcome-section-title text-3xl font-black tracking-tight text-[#fef3c7] sm:text-4xl">A little closer to your people.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#e2e8f0]/70">Join the space made for cadets. Bring your stories, meet your circle, and make it yours.</p>
        </div>
        <button onClick={onGetIn} className="welcome-cta group relative mt-6 inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full border border-[#fcd34d]/30 bg-gradient-to-r from-[#d97706] to-[#f59e0b] px-6 py-3 text-sm font-bold text-[#fef3c7] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#fbbf24] lg:mt-0">
          Get started <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </button>
      </section>

      <footer className="welcome-footer">
        <Footer />
      </footer>
    </div>
  );
}
