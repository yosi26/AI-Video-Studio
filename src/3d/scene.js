// 3D promo scene. Everything is a pure function of time t (seconds) so frames can be
// rendered one by one: window.init3d(config) once, then window.render3d(t) per frame.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import opentype from "opentype";

const W = 1080, H = 1920, DURATION = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, start, len) => clamp((t - start) / len);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeBack = x => { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- 3D text from the Heebo outlines ----------
let fonts;
const HEB = /[֐-׿]/;

// Hebrew strings are stored in logical order; glyphs are laid out left to right,
// so reorder runs into visual order (LTR runs such as "50%" or "050-000" stay intact).
function visual(str) {
  if (!HEB.test(str)) return str;
  const tokens = str.match(/[֐-׿]+|[0-9A-Za-z@._%:/+#₪](?:[0-9A-Za-z@._%:/+#₪-]*[0-9A-Za-z@._%:/+#₪])?|\s+|./g) || [];
  return tokens.reverse().map(tk => HEB.test(tk) ? [...tk].reverse().join("") : tk).join("");
}

function wrap(str, max) {
  const lines = [];
  for (const w of String(str).split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= max) lines[lines.length - 1] = last + " " + w; else lines.push(w);
  }
  return lines;
}

function lineShapes(line, size) {
  const shapes = [];
  let x = 0;
  for (const ch of visual(line)) {
    const font = HEB.test(ch) ? fonts.he : fonts.en;
    const glyph = font.charToGlyph(ch);
    const path = glyph.getPath(x, 0, size);
    const sp = new THREE.ShapePath();
    for (const c of path.commands) {
      if (c.type === "M") sp.moveTo(c.x, -c.y);
      else if (c.type === "L") sp.lineTo(c.x, -c.y);
      else if (c.type === "Q") sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === "C") sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    shapes.push(...glyphShapes(sp));
    x += (glyph.advanceWidth || font.unitsPerEm * 0.3) * size / font.unitsPerEm;
  }
  return { shapes, width: x };
}

// Font winding differs between subsets, so classify contours by nesting instead:
// a contour inside an odd number of others is a hole of its innermost container.
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function glyphShapes(sp) {
  const polys = sp.subPaths.map(p => p.getPoints());
  const parents = polys.map((poly, i) => polys.map((other, j) => j !== i && inside(poly[0], other) ? j : -1).filter(j => j >= 0));
  const shapes = new Map();
  polys.forEach((poly, i) => {
    if (parents[i].length % 2 === 0) shapes.set(i, new THREE.Shape(THREE.ShapeUtils.isClockWise(poly) ? poly.slice().reverse() : poly));
  });
  polys.forEach((poly, i) => {
    if (parents[i].length % 2 === 0) return;
    // innermost container = the parent with the most parents of its own
    const host = parents[i].reduce((a, b) => parents[b].length > parents[a].length ? b : a);
    const hole = new THREE.Path(THREE.ShapeUtils.isClockWise(poly) ? poly : poly.slice().reverse());
    shapes.get(host)?.holes.push(hole);
  });
  return [...shapes.values()];
}

// Returns a Group of extruded lines, centered, one mesh per line (so lines can animate separately).
function text3d(lines, { size = 10, depth = 3, lineGap = 1.25, materials }) {
  const group = new THREE.Group();
  lines.forEach((line, i) => {
    const { shapes } = lineShapes(line, size);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth, curveSegments: 5, bevelEnabled: true, bevelThickness: size * 0.06, bevelSize: size * 0.035, bevelSegments: 3,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -size * 0.36, -depth / 2);
    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.y = ((lines.length - 1) / 2 - i) * size * lineGap;
    group.add(mesh);
  });
  return group;
}

// ---------- scene state ----------
let renderer, composer, bloom, scene, camera, cfg;
let stars, starBase, streaks, streakBase, burst, burstDirs, lightA, lightB;
const S = {};                   // scene groups
const overlays = {};            // DOM overlay elements
let services = [];

function chrome(color, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, emissive, emissiveIntensity });
}

window.init3d = async function (config) {
  cfg = config;
  const [he, en] = await Promise.all([
    opentype.load("/assets/fonts/heebo-hebrew-900-normal.woff"),
    opentype.load("/assets/fonts/heebo-latin-900-normal.woff"),
  ]);
  fonts = { he, en };

  const c = cfg.colors || {};
  const primary = new THREE.Color(c.primary || "#ff6b35"), accent = new THREE.Color(c.accent || "#ffd23f");
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--primary", "#" + primary.getHexString());
  rootStyle.setProperty("--accent", "#" + accent.getHexString());

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(c.background || "#05050c");
  scene.fog = new THREE.FogExp2(scene.background, 0.004);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  lightA = new THREE.PointLight(primary, 2200, 400, 1.6);
  lightB = new THREE.PointLight(accent, 2200, 400, 1.6);
  scene.add(lightA, lightB);

  // soft round sprite for all point particles
  const dc = document.createElement("canvas"); dc.width = dc.height = 64;
  const dg = dc.getContext("2d"), grad = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.35, "rgba(255,255,255,.6)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  dg.fillStyle = grad; dg.fillRect(0, 0, 64, 64);
  const dot = new THREE.CanvasTexture(dc);

  // star field shared by all scenes
  const r = rng(7), N = 3500;
  starBase = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { starBase[i * 3] = (r() - .5) * 600; starBase[i * 3 + 1] = (r() - .5) * 900; starBase[i * 3 + 2] = -r() * 1200; }
  stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starBase.slice(), 3)),
    new THREE.PointsMaterial({ size: 1.4, map: dot, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);

  // warp streaks for the opening
  const M = 600; streakBase = [];
  const sp = new Float32Array(M * 6), scol = new Float32Array(M * 6);
  for (let i = 0; i < M; i++) {
    const a = r() * Math.PI * 2, rad = 8 + r() * 120;
    streakBase.push([Math.cos(a) * rad, Math.sin(a) * rad * 1.6, -r() * 1000]);
    const col = r() > .5 ? primary : accent;
    for (let k = 0; k < 2; k++) { scol[i * 6 + k * 3] = col.r; scol[i * 6 + k * 3 + 1] = col.g; scol[i * 6 + k * 3 + 2] = col.b; }
  }
  streaks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(sp, 3)).setAttribute("color", new THREE.BufferAttribute(scol, 3)),
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending }));
  scene.add(streaks);

  // explosion particles (offer scene)
  const B = 1500; burstDirs = new Float32Array(B * 3);
  for (let i = 0; i < B; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, sp2 = 40 + r() * 160, s = Math.sqrt(1 - u * u);
    burstDirs[i * 3] = s * Math.cos(th) * sp2; burstDirs[i * 3 + 1] = u * sp2; burstDirs[i * 3 + 2] = s * Math.sin(th) * sp2;
  }
  burst = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(B * 3), 3)),
    new THREE.PointsMaterial({ size: 1.3, map: dot, color: accent, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(burst);

  const faceMat = chrome(0xffffff), sideMat = chrome(primary, primary, 0.35);
  const accentFace = chrome(accent, accent, 0.25), darkSide = chrome(primary, primary, 0.6);
  const textMats = [faceMat, sideMat];

  // S1 hook: words fly in from deep space
  S.hook = new THREE.Group();
  S.hook.add(text3d(wrap(String(cfg.hook).replace(/\*/g, ""), 9), { size: 11, depth: 4, materials: [accentFace, darkSide] }));
  scene.add(S.hook);

  // S2 brand: giant name + shockwave rings
  S.brand = new THREE.Group();
  S.brandText = text3d(wrap(cfg.name, 8), { size: 16, depth: 7, materials: textMats });
  S.brand.add(S.brandText);
  S.rings = [0, 1, 2].map(i => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(30, 0.5 - i * 0.12, 16, 160),
      new THREE.MeshBasicMaterial({ color: i % 2 ? accent : primary, transparent: true, blending: THREE.AdditiveBlending }));
    S.brand.add(m); return m;
  });
  scene.add(S.brand);

  // S3 services: a spinning crystal + chrome number + title for each
  const shapes = [new THREE.IcosahedronGeometry(12, 0), new THREE.OctahedronGeometry(13, 0), new THREE.TorusKnotGeometry(8, 2.6, 160, 20)];
  services = (cfg.services || []).slice(0, 3).map((svc, i) => {
    const g = new THREE.Group();
    const crystal = new THREE.Mesh(shapes[i % 3], new THREE.MeshPhysicalMaterial({
      color: i % 2 ? accent : primary, metalness: 0.9, roughness: 0.08, flatShading: i < 2, emissive: i % 2 ? accent : primary, emissiveIntensity: 0.25 }));
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(shapes[i % 3], 1),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
    wire.scale.setScalar(1.35);
    const num = text3d([`0${i + 1}`], { size: 22, depth: 6, materials: [accentFace, darkSide] });
    const title = text3d(wrap(svc.title, 11), { size: 8.5, depth: 3, materials: textMats });
    crystal.position.y = 50; wire.position.y = 50; num.position.y = 20; title.position.y = -6;
    g.add(crystal, wire, num, title);
    scene.add(g);
    return { g, crystal, wire, num, title };
  });

  // S4 offer: badge text inside an orbiting ring of glowing orbs
  S.offer = new THREE.Group();
  S.offerText = text3d(wrap(cfg.offer, 9), { size: 13, depth: 6, materials: [accentFace, darkSide] });
  S.offer.add(S.offerText);
  S.orbs = new THREE.Group();
  const orbGeo = new THREE.SphereGeometry(1.6, 16, 12);
  for (let i = 0; i < 24; i++) {
    const o = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? accent : primary }));
    const a = i / 24 * Math.PI * 2; o.position.set(Math.cos(a) * 48, Math.sin(a) * 48, 0); S.orbs.add(o);
  }
  S.offer.add(S.orbs);
  scene.add(S.offer);

  // S5 CTA: name again with orbiting rings, pulled back
  S.cta = new THREE.Group();
  S.ctaText = text3d(wrap(cfg.cta, 9), { size: 12, depth: 5, materials: textMats });
  S.ctaText.position.y = 42;
  S.cta.add(S.ctaText);
  S.ctaRings = [0, 1].map(i => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(40 + i * 8, 0.8, 16, 200), chrome(i ? accent : primary, i ? accent : primary, 0.25));
    m.position.y = 42; S.cta.add(m); return m;
  });
  scene.add(S.cta);

  // HTML overlays for smaller text (crisper and RTL-exact)
  const ov = document.getElementById("overlay");
  const add = (cls, html) => { const d = document.createElement("div"); d.className = "ov " + cls; d.innerHTML = html; ov.appendChild(d); return d; };
  overlays.tagline = add("tagline", esc(cfg.tagline));
  overlays.svc = services.map((_, i) => add("svc-text", esc(cfg.services[i].text)));
  overlays.offerSub = add("offer-sub", esc(cfg.offerSub));
  const ct = cfg.contact || {};
  const lines = [["טלפון", ct.phone, 1], ["וואטסאפ", ct.whatsapp, 1], ["אתר", ct.website, 1], ["אינסטגרם", ct.instagram, 1], ["כתובת", ct.address, 0]].filter(l => l[1]);
  overlays.contacts = add("contacts", lines.map(([k, v, ltr]) => `<div class="contact"><span class="lbl">${k}:</span> <bdi dir="${ltr ? "ltr" : "auto"}">${esc(v)}</bdi></div>`).join("")
    + `<div class="btn">${esc(cfg.button || cfg.name)}</div>`);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.75, 0.45, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  await document.fonts.ready;
};

// ---------- timeline ----------
const T = { hook: [0, 5], brand: [5, 10], svc: [10, 21], offer: [21, 25], cta: [25, 30.01] };
const within = (t, [a, b]) => t >= a && t < b;

function setOverlay(el, t, start, len, end) {
  const p = easeOut(prog(t, start, len)), out = end === undefined ? 1 : clamp((end - t) / 0.3);
  el.style.opacity = Math.min(p, out);
  el.style.transform = `translateY(${(1 - p) * 60}px)`;
}

window.render3d = function (t) {
  const shake = new THREE.Vector3();
  for (const g of [S.hook, S.brand, S.offer, S.cta, ...services.map(s => s.g)]) g.visible = false;
  for (const el of document.querySelectorAll(".ov")) el.style.opacity = 0;

  // lights orbit continuously
  lightA.position.set(Math.cos(t * 1.3) * 90, 40 + Math.sin(t * 0.9) * 50, 95 + Math.sin(t * 1.3) * 30);
  lightB.position.set(Math.cos(t * 1.1 + 2) * 90, -30 + Math.cos(t * 0.8) * 50, 95 + Math.cos(t * 1.7) * 30);

  // stars drift toward camera; much faster during the opening warp
  const warp = t < 5 ? lerp(900, 60, easeOut(prog(t, 0, 3.5))) : 60;
  const tau = Math.min(t, 3.5), travel = 900 * tau - 120 * tau * tau + 60 * (t - tau);
  const sp = stars.geometry.attributes.position.array;
  for (let i = 0; i < sp.length; i += 3) {
    const z = starBase[i + 2] + travel;
    sp[i] = starBase[i]; sp[i + 1] = starBase[i + 1]; sp[i + 2] = ((z % 1200) + 1200) % 1200 - 1100;
  }
  stars.geometry.attributes.position.needsUpdate = true;

  const lp = streaks.geometry.attributes.position.array;
  const streakLen = t < 5 ? warp * 0.12 : 0;
  streaks.visible = t < 5.2;
  streakBase.forEach(([x, y, z0], i) => {
    const z = ((z0 + travel * 1.4) % 1000 + 1000) % 1000 - 950;
    lp.set([x, y, z, x, y, z - streakLen], i * 6);
  });
  streaks.geometry.attributes.position.needsUpdate = true;

  let cam = { x: 0, y: 0, z: 150, lx: 0, ly: 0, lz: 0, fov: 50 };

  if (within(t, T.hook)) {
    const lt = t - T.hook[0];
    S.hook.visible = true;
    const lines = S.hook.children[0].children;
    lines.forEach((m, i) => {
      const p = easeBack(prog(lt, 0.6 + i * 0.35, 0.9));
      m.position.z = lerp(-600, 0, p);
      m.rotation.set((1 - p) * 1.4, (1 - p) * (i % 2 ? -2 : 2), 0);
      m.scale.setScalar(Math.max(0.001, p));
    });
    S.hook.rotation.y = Math.sin(lt * 0.8) * 0.25;
    cam = { ...cam, z: lerp(170, 140, easeOut(prog(lt, 0, 5))), fov: lerp(80, 50, easeOut(prog(lt, 0, 2))) };
  }

  if (within(t, T.brand)) {
    const lt = t - T.brand[0];
    S.brand.visible = true;
    const slam = prog(lt, 0, 0.45);
    S.brandText.position.z = lerp(-900, 0, slam * slam);
    S.brandText.rotation.y = lt > 0.45 ? Math.sin((lt - 0.45) * 1.2) * 0.45 : 0;
    S.brandText.rotation.x = lt > 0.45 ? Math.sin((lt - 0.45) * 0.9) * 0.12 : 0;
    S.rings.forEach((ring, i) => {
      const p = prog(lt, 0.45 + i * 0.12, 1.1);
      ring.scale.setScalar(0.2 + easeOut(p) * (2.2 + i * 0.6));
      ring.material.opacity = p > 0 ? (1 - p) : 0;
      ring.rotation.x = 1.2 + i * 0.2;
    });
    const hit = lt - 0.45;
    if (hit > 0 && hit < 0.5) { const a = (0.5 - hit) * 6; shake.set(Math.sin(t * 90) * a, Math.cos(t * 77) * a, 0); }
    const orbit = easeInOut(prog(lt, 0.6, 4.4));
    cam = { ...cam, x: Math.sin(orbit * 0.9 - 0.45) * 150, z: Math.cos(orbit * 0.9 - 0.45) * 150, y: 10 - orbit * 15 };
    setOverlay(overlays.tagline, lt, 1.2, 0.6, T.brand[1] - T.brand[0]);
  }

  if (within(t, T.svc)) {
    const lt = t - T.svc[0], len = (T.svc[1] - T.svc[0]) / Math.max(1, services.length);
    const i = Math.min(services.length - 1, Math.floor(lt / len)), st = lt - i * len;
    const s = services[i];
    if (s) {
      s.g.visible = true;
      s.crystal.rotation.set(t * 0.9, t * 1.3, 0);
      s.wire.rotation.copy(s.crystal.rotation);
      s.crystal.scale.setScalar(easeBack(prog(st, 0, 0.7)));
      s.wire.scale.setScalar(1.35 * easeBack(prog(st, 0.1, 0.7)));
      const pn = easeBack(prog(st, 0.2, 0.7));
      s.num.position.x = lerp(-120, 0, pn); s.num.rotation.y = (1 - pn) * -3;
      const pt = easeBack(prog(st, 0.45, 0.7));
      s.title.position.x = lerp(120, 0, pt); s.title.rotation.y = (1 - pt) * 3;
      s.g.rotation.y = Math.sin(st * 0.9) * 0.3;
      // fly in from far away, drift, then rush past at the end of the slot
      const inP = easeOut(prog(st, 0, 0.8)), outP = prog(st, len - 0.45, 0.45);
      cam = { ...cam, x: Math.sin(st * 0.7) * 25, y: 8, z: lerp(420, 165, inP) - outP * outP * 190, ly: 8, lz: -outP * 200 };
      setOverlay(overlays.svc[i], st, 0.9, 0.5, len);
    }
  }

  if (within(t, T.offer)) {
    const lt = t - T.offer[0];
    S.offer.visible = true;
    const p = easeBack(prog(lt, 0.15, 0.8));
    S.offerText.scale.setScalar(Math.max(0.001, p) * (1 + 0.04 * Math.sin(lt * 7)));
    S.offerText.rotation.set(Math.sin(lt * 1.5) * 0.15, (1 - p) * Math.PI * 2 + Math.sin(lt * 1.1) * 0.3, 0);
    S.orbs.rotation.z = lt * 1.4;
    S.orbs.rotation.x = 0.9 + Math.sin(lt) * 0.2;
    S.orbs.scale.setScalar(easeOut(prog(lt, 0.4, 0.8)));
    if (lt < 0.25) shake.set(Math.sin(t * 80) * 3, Math.cos(t * 70) * 3, 0);
    cam = { ...cam, z: lerp(120, 175, easeOut(prog(lt, 0, 4))), y: -5 };
    setOverlay(overlays.offerSub, lt, 0.9, 0.5, T.offer[1] - T.offer[0]);
  }
  // explosion accompanies the offer reveal
  const bt = t - T.offer[0];
  burst.visible = bt > 0 && bt < 3;
  if (burst.visible) {
    const bp = burst.geometry.attributes.position.array, d = 1 - Math.exp(-bt * 2.2);
    for (let i = 0; i < bp.length; i++) bp[i] = burstDirs[i] * d;
    burst.geometry.attributes.position.needsUpdate = true;
    burst.material.opacity = clamp(1 - bt / 3);
  }

  if (within(t, T.cta)) {
    const lt = t - T.cta[0];
    S.cta.visible = true;
    const p = easeBack(prog(lt, 0, 0.8));
    S.ctaText.scale.setScalar(Math.max(0.001, p));
    S.ctaText.rotation.y = Math.sin(lt * 1.2) * 0.3;
    S.ctaRings.forEach((ring, i) => {
      ring.rotation.set(0.35 + Math.sin(lt + i) * 0.15, Math.sin(lt * 0.8 + i * 2) * 0.45, lt * 0.4);
      ring.scale.setScalar(easeOut(prog(lt, 0.2 + i * 0.15, 0.8)));
    });
    cam = { ...cam, y: 15, ly: 15, z: lerp(90, 210, easeOut(prog(lt, 0, 1.5))) };
    setOverlay(overlays.contacts, lt, 0.8, 0.6);
    const btn = overlays.contacts.querySelector(".btn");
    btn.style.transform = `scale(${1 + 0.05 * Math.sin(Math.max(0, lt - 1.4) * 7)})`;
  }

  camera.fov = cam.fov; camera.updateProjectionMatrix();
  camera.position.set(cam.x + shake.x, cam.y + shake.y, cam.z);
  camera.lookAt(cam.lx, cam.ly, cam.lz);

  // white flash + bloom kick at every cut
  const cut = [T.brand[0], T.svc[0], T.offer[0], T.cta[0]].reduce((m, c) => Math.min(m, Math.abs(t - c - 0.05)), 9);
  document.getElementById("flash").style.opacity = clamp(1 - cut / 0.18) * 0.85;
  bloom.strength = 0.75 + clamp(1 - cut / 0.3) * 0.8;

  document.getElementById("progress").style.width = `${(t / DURATION) * W}px`;
  composer.render();
};

window.ready3d = true;
