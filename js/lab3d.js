/**
 * Cool Korki — WebGL Lab Room (Three.js)
 * Scroll drives camera path through a multi-zone learning lab.
 */
import * as THREE from "three";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Scene keyframes: progress 0–1 → camera + lookAt + korki */
const PATH = [
  // Gateway — hold the opening shot so first scroll doesn't yank the room
  {
    p: 0,
    cam: [0, 1.6, 7.5],
    look: [0, 1.2, 0],
    korki: [1.4, 1.15, 1.2],
    hue: 185,
    fog: 0.045,
  },
  {
    p: 0.07,
    cam: [0.15, 1.55, 6.8],
    look: [0.2, 1.2, -0.5],
    korki: [1.35, 1.15, 1.0],
    hue: 185,
    fog: 0.045,
  },
  // Setup / story
  {
    p: 0.16,
    cam: [-1.2, 1.8, 2.0],
    look: [0.5, 1.1, -4],
    korki: [-2.2, 1.1, -3.5],
    hue: 250,
    fog: 0.05,
  },
  // 3 Whys
  {
    p: 0.32,
    cam: [0.4, 2.0, -6],
    look: [0, 1.4, -12],
    korki: [2.5, 1.2, -11],
    hue: 30,
    fog: 0.04,
  },
  // Quests tunnel
  {
    p: 0.48,
    cam: [0, 1.7, -16],
    look: [0, 1.3, -26],
    korki: [-1.8, 1.15, -24],
    hue: 160,
    fog: 0.055,
  },
  // Lab core
  {
    p: 0.64,
    cam: [2.2, 2.2, -30],
    look: [0, 1.4, -36],
    korki: [0, 1.3, -36],
    hue: 200,
    fog: 0.042,
  },
  // Paths
  {
    p: 0.8,
    cam: [-0.8, 1.9, -40],
    look: [0, 1.2, -48],
    korki: [2, 1.15, -47],
    hue: 20,
    fog: 0.048,
  },
  // Hello
  {
    p: 1,
    cam: [0, 1.55, -52],
    look: [0, 1.25, -58],
    korki: [0, 1.2, -57.5],
    hue: 320,
    fog: 0.038,
  },
];

function samplePath(progress) {
  const p = clamp(progress, 0, 1);
  let i = 0;
  while (i < PATH.length - 1 && PATH[i + 1].p < p) i++;
  const a = PATH[i];
  const b = PATH[Math.min(i + 1, PATH.length - 1)];
  const span = Math.max(b.p - a.p, 1e-6);
  const t = smoothstep((p - a.p) / span);
  const mix3 = (ka, kb) => [
    lerp(ka[0], kb[0], t),
    lerp(ka[1], kb[1], t),
    lerp(ka[2], kb[2], t),
  ];
  return {
    cam: mix3(a.cam, b.cam),
    look: mix3(a.look, b.look),
    korki: mix3(a.korki, b.korki),
    hue: lerp(a.hue, b.hue, t),
    fog: lerp(a.fog, b.fog, t),
    t,
    segment: i,
  };
}

function makeGridTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#0a0818";
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(45, 212, 191, 0.22)";
  g.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= 512; i += step) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  g.strokeStyle = "rgba(255, 107, 44, 0.15)";
  g.strokeRect(2, 2, 508, 508);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 40);
  tex.anisotropy = 4;
  return tex;
}

function makePanelTexture(label, color) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#12102a";
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(12, 12, 488, 296);
  g.fillStyle = color;
  g.globalAlpha = 0.12;
  g.fillRect(12, 12, 488, 296);
  g.globalAlpha = 1;
  g.font = "bold 48px Inter, system-ui, sans-serif";
  g.fillStyle = "#f2f0ff";
  g.fillText(label, 40, 100);
  g.font = "28px Inter, system-ui, sans-serif";
  g.fillStyle = "rgba(168, 160, 200, 0.9)";
  g.fillText("Cool Korki Lab", 40, 160);
  // scanlines
  g.fillStyle = "rgba(45, 212, 191, 0.06)";
  for (let y = 0; y < 320; y += 4) g.fillRect(0, y, 512, 1);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Build an alpha cutout texture: sample corner “background” colors and
 * soft-key them out so Korki is a freestanding silhouette (no purple plate).
 */
async function makeKorkiCutoutTexture(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  let img = null;
  for (const url of list) {
    try {
      img = await loadImage(url);
      break;
    } catch {
      /* try next */
    }
  }
  if (!img) return null;

  const maxSide = 768;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const imageData = g.getImageData(0, 0, w, h);
  const d = imageData.data;

  const sampleAt = (x, y) => {
    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };

  // Corner + edge samples → average background (works for solid purple plate)
  const pts = [
    [4, 4],
    [w - 5, 4],
    [4, h - 5],
    [w - 5, h - 5],
    [w * 0.5, 4],
    [w * 0.5, h - 5],
    [4, h * 0.5],
    [w - 5, h * 0.5],
    [w * 0.15, 4],
    [w * 0.85, 4],
  ];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const [x, y] of pts) {
    const [r, gr, b] = sampleAt(x, y);
    br += r;
    bg += gr;
    bb += b;
  }
  br /= pts.length;
  bg /= pts.length;
  bb /= pts.length;

  // Soft chroma key in RGB distance + purple-bias boost
  const hard = 38;
  const soft = 78;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const gr = d[i + 1];
    const b = d[i + 2];
    const dr = r - br;
    const dg = gr - bg;
    const db = b - bb;
    let dist = Math.sqrt(dr * dr + dg * dg + db * db);

    // Extra kill for classic indigo/purple plate (high B+R, lower G)
    const purpleBias =
      b > 80 && r > 40 && gr < r * 0.95 && gr < b * 0.9 && Math.abs(r - b) < 90
        ? 18
        : 0;
    dist = Math.max(0, dist - purpleBias);

    let a = 1;
    if (dist < hard) a = 0;
    else if (dist < soft) a = (dist - hard) / (soft - hard);
    // keep character teal accents (high G relative) even if near threshold
    if (gr > r + 15 && gr > b - 10 && gr > 100) a = Math.max(a, 0.85);

    d[i + 3] = Math.round(clamp(a, 0, 1) * 255);
  }

  // Light dilate alpha (1px) so edges stay soft / less choppy
  const alpha = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      alpha[y * w + x] = d[(y * w + x) * 4 + 3];
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (alpha[i] > 200) continue;
      let m = alpha[i];
      m = Math.max(m, alpha[i - 1] * 0.55, alpha[i + 1] * 0.55, alpha[i - w] * 0.55, alpha[i + w] * 0.55);
      d[i * 4 + 3] = Math.max(d[i * 4 + 3], Math.round(m));
    }
  }

  g.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.premultiplyAlpha = false;
  return tex;
}

/** Shared materials for dense lab props */
function createPropMaterials() {
  return {
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x1a1630,
      metalness: 0.65,
      roughness: 0.35,
      emissive: 0x0a0820,
      emissiveIntensity: 0.15,
    }),
    metalTeal: new THREE.MeshStandardMaterial({
      color: 0x1c2a32,
      metalness: 0.55,
      roughness: 0.4,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.12,
    }),
    plastic: new THREE.MeshStandardMaterial({
      color: 0x221e42,
      metalness: 0.15,
      roughness: 0.7,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x0a1420,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.3,
    }),
    screenOrange: new THREE.MeshStandardMaterial({
      color: 0x1a1008,
      emissive: 0xff6b2c,
      emissiveIntensity: 0.45,
      metalness: 0.2,
      roughness: 0.35,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x2a2038,
      metalness: 0.05,
      roughness: 0.85,
    }),
    neon: new THREE.MeshBasicMaterial({ color: 0x2dd4bf }),
    neonOrange: new THREE.MeshBasicMaterial({ color: 0xff6b2c }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x88eeff,
      transparent: true,
      opacity: 0.12,
      metalness: 0.9,
      roughness: 0.1,
      side: THREE.DoubleSide,
    }),
  };
}

function addDesk(parent, mats, x, z, rotY = 0) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.7), mats.wood);
  top.position.y = 0.78;
  const legGeo = new THREE.BoxGeometry(0.06, 0.75, 0.06);
  const positions = [
    [-0.7, 0.375, -0.28],
    [0.7, 0.375, -0.28],
    [-0.7, 0.375, 0.28],
    [0.7, 0.375, 0.28],
  ];
  positions.forEach((p) => {
    const leg = new THREE.Mesh(legGeo, mats.metalDark);
    leg.position.set(...p);
    g.add(leg);
  });
  g.add(top);
  // monitor
  const mon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.04), mats.metalDark);
  mon.position.set(0, 1.1, -0.1);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), mats.screen);
  scr.position.set(0, 1.1, -0.07);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.28, 8), mats.metalDark);
  stand.position.set(0, 0.92, -0.12);
  g.add(mon, scr, stand);
  // keyboard
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.16), mats.plastic);
  kb.position.set(0, 0.82, 0.12);
  g.add(kb);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

function addCrate(parent, mats, x, z, scale = 1) {
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.45 * scale, 0.55 * scale), mats.metalTeal);
  crate.position.set(x, 0.225 * scale, z);
  crate.rotation.y = Math.random() * 0.5;
  parent.add(crate);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.56 * scale, 0.04, 0.56 * scale),
    mats.neon
  );
  stripe.position.set(x, 0.3 * scale, z);
  parent.add(stripe);
  return crate;
}

function addServerRack(parent, mats, x, z, rotY = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.55), mats.metalDark);
  body.position.y = 0.9;
  g.add(body);
  for (let i = 0; i < 6; i++) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.06, 0.02),
      i % 2 ? mats.screen : mats.screenOrange
    );
    led.position.set(0, 0.35 + i * 0.24, 0.28);
    g.add(led);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

function addHangingLamp(parent, mats, x, z) {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 6), mats.metalDark);
  cord.position.y = 3.5;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.2, 12), mats.metalTeal);
  shade.position.y = 2.85;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
  );
  bulb.position.y = 2.75;
  g.add(cord, shade, bulb);
  g.position.set(x, 0, z);
  parent.add(g);
  const light = new THREE.PointLight(0xffe8c8, 0.55, 6, 2);
  light.position.set(x, 2.7, z);
  parent.add(light);
  return g;
}

function addPlant(parent, mats, x, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 10), mats.plastic);
  pot.position.y = 0.09;
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x0a4a40,
    emissiveIntensity: 0.2,
    roughness: 0.8,
  });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.1, 0.28 + (i % 2) * 0.08, Math.sin(a) * 0.1);
    leaf.scale.set(1, 1.4, 0.7);
    g.add(leaf);
  }
  g.add(pot);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

function addPipe(parent, mats, x, y, z, len, axis = "z") {
  const geo =
    axis === "z"
      ? new THREE.CylinderGeometry(0.06, 0.06, len, 8)
      : new THREE.CylinderGeometry(0.06, 0.06, len, 8);
  const pipe = new THREE.Mesh(geo, mats.metalDark);
  pipe.position.set(x, y, z);
  if (axis === "z") pipe.rotation.x = Math.PI / 2;
  if (axis === "x") pipe.rotation.z = Math.PI / 2;
  parent.add(pipe);
  return pipe;
}

function addFloorPod(parent, mats, x, z, color = 0x2dd4bf) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.03, 8, 24),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.03, z);
  parent.add(ring);
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x12102a,
      emissive: color,
      emissiveIntensity: 0.15,
      roughness: 0.6,
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x, 0.02, z);
  parent.add(pad);
}

function addWhiteboard(parent, mats, x, z, rotY) {
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.06), mats.plastic);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.0),
    new THREE.MeshStandardMaterial({
      color: 0xe8e4ff,
      emissive: 0x2a2050,
      emissiveIntensity: 0.08,
      roughness: 0.9,
    })
  );
  face.position.z = 0.04;
  const g = new THREE.Group();
  board.position.y = 1.6;
  face.position.y = 1.6;
  g.add(board, face);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

function populateDenseProps(room, mats) {
  const props = new THREE.Group();
  room.add(props);

  // Gateway lounge
  addDesk(props, mats, -3.2, 3.5, 0.15);
  addDesk(props, mats, 3.4, 4.2, -0.2);
  addPlant(props, mats, -4.2, 5.5);
  addPlant(props, mats, 4.5, 2.8);
  addCrate(props, mats, 4.8, 6.2, 0.9);
  addCrate(props, mats, 5.1, 5.6, 0.7);
  addFloorPod(props, mats, 0, 4.5, 0x2dd4bf);
  addHangingLamp(props, mats, -2, 3);
  addHangingLamp(props, mats, 2.5, 5);

  // Setup zone
  addWhiteboard(props, mats, -6.5, -2, Math.PI / 2);
  addServerRack(props, mats, 5.5, -1.5, -0.3);
  addServerRack(props, mats, 5.5, -2.5, -0.3);
  addDesk(props, mats, -3.5, -4, 0.4);
  addDesk(props, mats, 2.8, -5, -0.5);
  addCrate(props, mats, -5.2, -5.5, 1);
  addPlant(props, mats, 4.8, -4);
  addHangingLamp(props, mats, 0, -3);
  addFloorPod(props, mats, 0, -4, 0x7c3aed);

  // Why zone extras
  addDesk(props, mats, -4, -10, 0.6);
  addDesk(props, mats, 4, -13, -0.6);
  addServerRack(props, mats, -5.8, -14, 0.2);
  addCrate(props, mats, 5, -15, 1.1);
  addCrate(props, mats, 5.4, -15.6, 0.75);
  addHangingLamp(props, mats, -1.5, -12);
  addHangingLamp(props, mats, 1.5, -12);
  addPlant(props, mats, -5, -11);
  addFloorPod(props, mats, 0, -12, 0xff6b2c);

  // Quest tunnel clutter
  for (let i = 0; i < 5; i++) {
    addCrate(props, mats, -5.5 + (i % 2) * 0.4, -20 - i * 1.8, 0.65 + (i % 3) * 0.1);
    addCrate(props, mats, 5.2 - (i % 2) * 0.3, -21 - i * 1.7, 0.7);
  }
  addDesk(props, mats, -3.2, -26, 0.2);
  addDesk(props, mats, 3.2, -28, -0.25);
  addHangingLamp(props, mats, 0, -22);
  addHangingLamp(props, mats, 0, -28);
  addFloorPod(props, mats, 0, -24, 0x2dd4bf);
  addServerRack(props, mats, -5.9, -30, 0.1);

  // Lab core furniture ring
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addDesk(props, mats, Math.cos(a) * 3.8, -36 + Math.sin(a) * 3.8, a + Math.PI);
  }
  addServerRack(props, mats, -5.5, -34, 0.4);
  addServerRack(props, mats, 5.5, -38, -0.4);
  addHangingLamp(props, mats, -2.5, -36);
  addHangingLamp(props, mats, 2.5, -36);
  addPlant(props, mats, -4.5, -33);
  addPlant(props, mats, 4.5, -39);
  addFloorPod(props, mats, 0, -36, 0x7c3aed);
  addFloorPod(props, mats, 2.5, -34, 0x2dd4bf);
  addFloorPod(props, mats, -2.5, -38, 0xff6b2c);

  // Paths / hello end
  addWhiteboard(props, mats, 6.5, -48, -Math.PI / 2);
  addDesk(props, mats, -3, -46, 0.3);
  addDesk(props, mats, 3, -50, -0.4);
  addDesk(props, mats, -2.5, -55, 0.1);
  addDesk(props, mats, 2.5, -56, -0.1);
  addServerRack(props, mats, -5.8, -52, 0.15);
  addCrate(props, mats, 5, -54, 1);
  addCrate(props, mats, 5.3, -54.7, 0.8);
  addPlant(props, mats, -4.8, -57);
  addPlant(props, mats, 4.8, -57);
  addHangingLamp(props, mats, 0, -50);
  addHangingLamp(props, mats, 0, -56);
  addFloorPod(props, mats, 0, -52, 0xf472b6);
  addFloorPod(props, mats, 0, -57.5, 0x2dd4bf);

  // Ceiling pipes along corridor
  for (let z = 6; z > -60; z -= 6) {
    addPipe(props, mats, -5.5, 3.85, z - 2, 5.5, "z");
    addPipe(props, mats, 5.5, 3.7, z - 1, 5.5, "z");
  }
  // Cross pipes
  for (let z = 2; z > -58; z -= 12) {
    addPipe(props, mats, 0, 3.9, z, 11, "x");
  }

  // Wall conduit strips (extra neon density)
  for (let z = 5; z > -60; z -= 4) {
    const n = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.9, 0.04),
      z % 8 === 1 ? mats.neonOrange : mats.neon
    );
    n.position.set(-6.9, 1.2, z);
    props.add(n);
    const n2 = n.clone();
    n2.position.x = 6.9;
    n2.position.y = 2.4;
    props.add(n2);
  }

  // Floating holographic cubes
  const floaters = [];
  for (let i = 0; i < 18; i++) {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshStandardMaterial({
        color: 0x1c1838,
        emissive: i % 2 ? 0x2dd4bf : 0xff6b2c,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.8,
        metalness: 0.4,
        roughness: 0.3,
      })
    );
    const baseY = 1.2 + Math.random() * 2;
    cube.position.set(
      (Math.random() - 0.5) * 10,
      baseY,
      4 - Math.random() * 62
    );
    cube.rotation.set(Math.random(), Math.random(), Math.random());
    cube.userData.baseY = baseY;
    cube.userData.phase = Math.random() * Math.PI * 2;
    cube.userData.speed = 0.6 + Math.random() * 0.8;
    props.add(cube);
    floaters.push(cube);
  }

  // Low benches / seating
  for (const [x, z] of [
    [-4, 1],
    [4, 0.5],
    [-3.5, -18],
    [3.5, -32],
    [-3, -44],
    [3.2, -58],
  ]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.45), mats.wood);
    bench.position.set(x, 0.2, z);
    props.add(bench);
  }

  // Bookshelf units
  for (const [x, z, rot] of [
    [-6.4, -8, Math.PI / 2],
    [6.4, -25, -Math.PI / 2],
    [-6.4, -42, Math.PI / 2],
  ]) {
    const shelf = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.2), mats.metalDark);
    back.position.y = 1.0;
    shelf.add(back);
    for (let i = 0; i < 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 1.15), mats.wood);
      plank.position.set(0.15, 0.35 + i * 0.38, 0);
      shelf.add(plank);
      for (let j = 0; j < 3; j++) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.28, 0.2),
          j % 2 ? mats.screen : mats.screenOrange
        );
        book.position.set(0.12, 0.5 + i * 0.38, -0.35 + j * 0.28);
        shelf.add(book);
      }
    }
    shelf.position.set(x, 0, z);
    shelf.rotation.y = rot;
    props.add(shelf);
  }

  return { props, floaters };
}

/**
 * @param {{ canvas: HTMLCanvasElement, reduced?: boolean }} opts
 */
function supportsWebGL() {
  try {
    // IMPORTANT: never call getContext on the display canvas before Three.js —
    // that can "steal" the context and freeze the scene.
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export async function initLab3D(opts) {
  const canvas = opts.canvas;
  const reduced = !!opts.reduced;

  if (!canvas) return null;
  if (!supportsWebGL()) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !reduced,
      alpha: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
  } catch (err) {
    console.warn("WebGLRenderer failed", err);
    return null;
  }

  const sizeCanvas = () => {
    const w = Math.max(1, window.innerWidth || canvas.clientWidth || 1);
    const h = Math.max(1, window.innerHeight || canvas.clientHeight || 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduced ? 1.25 : 2));
    renderer.setSize(w, h, false);
    return { w, h };
  };

  const { w: startW, h: startH } = sizeCanvas();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x0c0a1a, 0);
  // Ensure the canvas can composite over CSS world
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c0a1a, 0.045);

  const camera = new THREE.PerspectiveCamera(
    55,
    startW / startH,
    0.1,
    120
  );
  camera.position.set(0, 1.6, 7.5);

  // --- Lights ---
  const amb = new THREE.AmbientLight(0x6a60a8, 0.35);
  scene.add(amb);

  const key = new THREE.DirectionalLight(0x9cf5e8, 1.1);
  key.position.set(4, 8, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xff8f5a, 0.35);
  fill.position.set(-5, 3, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(0x2dd4bf, 2.2, 28, 2);
  rim.position.set(0, 3.5, 0);
  scene.add(rim);

  const labCoreLight = new THREE.PointLight(0x7c3aed, 1.8, 22, 2);
  labCoreLight.position.set(0, 2.5, -36);
  scene.add(labCoreLight);

  const portalLight = new THREE.PointLight(0xff6b2c, 1.4, 12, 2);
  portalLight.position.set(1.4, 1.5, 1.5);
  scene.add(portalLight);

  // --- Room shell (long corridor along -Z) ---
  const room = new THREE.Group();
  scene.add(room);

  const floorMat = new THREE.MeshStandardMaterial({
    map: makeGridTexture(),
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.15,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -30);
  room.add(floor);

  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x100e22,
    roughness: 0.9,
    metalness: 0.05,
    emissive: 0x1a1540,
    emissiveIntensity: 0.25,
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(18, 90), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 4.2, -30);
  room.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x15122c,
    roughness: 0.88,
    metalness: 0.08,
    emissive: 0x0a1830,
    emissiveIntensity: 0.15,
  });

  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(90, 4.2), wallMat);
  wallL.position.set(-7, 2.1, -30);
  wallL.rotation.y = Math.PI / 2;
  room.add(wallL);

  const wallR = wallL.clone();
  wallR.position.x = 7;
  wallR.rotation.y = -Math.PI / 2;
  room.add(wallR);

  // Neon strips along walls
  const neonGeo = new THREE.BoxGeometry(0.06, 0.06, 88);
  const neonTeal = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });
  const neonOrange = new THREE.MeshBasicMaterial({ color: 0xff6b2c });
  const stripL = new THREE.Mesh(neonGeo, neonTeal);
  stripL.position.set(-6.95, 0.12, -30);
  room.add(stripL);
  const stripR = new THREE.Mesh(neonGeo, neonOrange);
  stripR.position.set(6.95, 0.12, -30);
  room.add(stripR);
  const stripCeil = new THREE.Mesh(neonGeo, neonTeal);
  stripCeil.position.set(0, 4.05, -30);
  room.add(stripCeil);

  // Arch frames along the corridor
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x1c1838,
    emissive: 0x2dd4bf,
    emissiveIntensity: 0.2,
    metalness: 0.4,
    roughness: 0.4,
  });
  for (let z = 4; z > -60; z -= 8) {
    const arch = new THREE.Group();
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.6, 0.15), archMat);
    postL.position.set(-4.5, 1.8, 0);
    const postR = postL.clone();
    postR.position.x = 4.5;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.15, 0.12, 0.15), archMat);
    beam.position.set(0, 3.6, 0);
    arch.add(postL, postR, beam);
    arch.position.z = z;
    room.add(arch);
  }

  // Dense lab props (desks, racks, crates, plants, pipes…)
  const propMats = createPropMaterials();
  const { floaters } = populateDenseProps(room, propMats);

  // Holographic wall panels
  const panels = [
    { label: "SETUP", color: "#7c3aed", pos: [-6.8, 2.0, -3.5], rot: Math.PI / 2 },
    { label: "3 WHYS", color: "#ff6b2c", pos: [6.8, 2.0, -11], rot: -Math.PI / 2 },
    { label: "QUESTS", color: "#2dd4bf", pos: [-6.8, 2.0, -22], rot: Math.PI / 2 },
    { label: "LAB CORE", color: "#67e8f9", pos: [6.8, 2.0, -34], rot: -Math.PI / 2 },
    { label: "PATHS", color: "#ff8f5a", pos: [-6.8, 2.0, -46], rot: Math.PI / 2 },
    { label: "HELLO", color: "#f472b6", pos: [6.8, 2.0, -56], rot: -Math.PI / 2 },
  ];
  const panelMeshes = [];
  for (const p of panels) {
    const tex = makePanelTexture(p.label, p.color);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), mat);
    mesh.position.set(...p.pos);
    mesh.rotation.y = p.rot;
    room.add(mesh);
    panelMeshes.push(mesh);
  }

  // Why pillars (3)
  const whyGroup = new THREE.Group();
  whyGroup.position.set(0, 0, -12);
  scene.add(whyGroup);
  const pillarColors = [0x2dd4bf, 0xff6b2c, 0x7c3aed];
  const pillars = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1c1838,
      emissive: pillarColors[i],
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.35,
    });
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), mat);
    p.position.set((i - 1) * 2.2, 1.2, 0);
    whyGroup.add(p);
    pillars.push(p);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: pillarColors[i] })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(p.position);
    ring.position.y = 0.15;
    whyGroup.add(ring);
  }

  // Quest floating cards in tunnel
  const questGroup = new THREE.Group();
  questGroup.position.set(0, 0, -24);
  scene.add(questGroup);
  const questLabels = ["SPEAK", "LAB", "FUN", "STORY", "SECRET", "AI"];
  const questCards = [];
  for (let i = 0; i < 6; i++) {
    const tex = makePanelTexture(questLabels[i], i % 2 ? "#ff6b2c" : "#2dd4bf");
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), mat);
    const side = i % 2 === 0 ? -1 : 1;
    card.position.set(side * 2.4, 1.3 + (i % 3) * 0.15, -i * 1.6);
    card.rotation.y = side * 0.35;
    questGroup.add(card);
    questCards.push(card);
  }

  // Lab core — orbiting rings + orbs
  const labCore = new THREE.Group();
  labCore.position.set(0, 1.5, -36);
  scene.add(labCore);
  const coreSphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.25,
      wireframe: true,
    })
  );
  labCore.add(coreSphere);
  const orbitRings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1 + i * 0.45, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xff6b2c : 0x7c3aed,
        transparent: true,
        opacity: 0.7,
      })
    );
    ring.rotation.x = Math.PI / 2 + i * 0.4;
    ring.rotation.y = i * 0.7;
    labCore.add(ring);
    orbitRings.push(ring);
  }
  const toolOrbs = [];
  for (let i = 0; i < 6; i++) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: i % 2 ? 0xff6b2c : 0x2dd4bf,
        emissiveIntensity: 0.8,
      })
    );
    labCore.add(orb);
    toolOrbs.push({ mesh: orb, angle: (i / 6) * Math.PI * 2, radius: 1.6 + (i % 2) * 0.35 });
  }

  // Portal ring at gateway
  const portalGroup = new THREE.Group();
  portalGroup.position.set(1.4, 1.2, 1.0);
  scene.add(portalGroup);
  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.06, 12, 48),
    new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.25,
    })
  );
  portalGroup.add(portalRing);
  const portalInner = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 48),
    new THREE.MeshBasicMaterial({
      color: 0x14122a,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  portalGroup.add(portalInner);

  // Korki cutout (alpha silhouette — no purple plate)
  const korkiTex = await makeKorkiCutoutTexture([
    "assets/korki-cutout-src.jpg",
    "assets/korki-character.jpg",
  ]);

  const korkiGroup = new THREE.Group();
  scene.add(korkiGroup);

  let korkiMesh;
  if (korkiTex) {
    const mat = new THREE.MeshBasicMaterial({
      map: korkiTex,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    // Slightly taller plane so full body reads as standing cutout
    korkiMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.75), mat);
    korkiMesh.position.y = 0.05;
  } else {
    korkiMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x4f46e5,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.4,
      })
    );
  }
  korkiGroup.add(korkiMesh);

  // Soft contact shadow under cutout
  const korkiShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );
  korkiShadow.rotation.x = -Math.PI / 2;
  korkiShadow.position.y = -1.05;
  korkiGroup.add(korkiShadow);

  const korkiGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
  );
  korkiGlow.position.z = -0.06;
  korkiGroup.add(korkiGlow);

  // Floating dust particles (visible ambient drift)
  const pCount = reduced ? 600 : 2000;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pSpd = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 14;
    pPos[i * 3 + 1] = Math.random() * 4;
    pPos[i * 3 + 2] = -Math.random() * 70 + 8;
    pSpd[i] = 0.35 + Math.random() * 0.85;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xb8fff4,
    size: reduced ? 0.05 : 0.042,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // State
  let progress = 0;
  let targetProgress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPX = 0;
  let targetPY = 0;
  let portalOpen = false;
  let running = true;
  let paused = false;
  let rafId = 0;
  let lastT = performance.now();
  let elapsed = 0; // steady clock for ambient loops (survives tab throttling better)

  const camPos = new THREE.Vector3(0, 1.6, 7.5);
  const lookPos = new THREE.Vector3(0, 1.2, 0);
  const korkiPos = new THREE.Vector3(1.4, 1.15, 1.2);
  korkiGroup.position.copy(korkiPos);

  function setProgress(p) {
    targetProgress = clamp(p, 0, 1);
  }

  function setPointer(nx, ny) {
    targetPX = clamp(nx, -1, 1);
    targetPY = clamp(ny, -1, 1);
  }

  function setPortalOpen(open) {
    portalOpen = !!open;
  }

  function setScene(_id) {
    // reserved for zone-specific FX hooks
  }

  function onResize() {
    const { w, h } = sizeCanvas();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);

  const onVisibility = () => {
    paused = document.hidden;
    if (!paused && running) {
      lastT = performance.now();
      if (!rafId) rafId = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  function tick(now) {
    if (!running) {
      rafId = 0;
      return;
    }
    rafId = requestAnimationFrame(tick);
    if (paused) {
      lastT = now;
      return;
    }

    // Cap huge gaps (tab return) so ambient motion doesn't jump wildly
    const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
    lastT = now;
    elapsed += dt;
    const t = elapsed;

    // smooth scrub into 3D path
    progress = lerp(progress, targetProgress, reduced ? 1 : 1 - Math.exp(-dt * 4.5));
    pointerX = lerp(pointerX, targetPX, 1 - Math.exp(-dt * 5));
    pointerY = lerp(pointerY, targetPY, 1 - Math.exp(-dt * 5));

    const sample = samplePath(progress);
    camPos.set(...sample.cam);
    lookPos.set(...sample.look);
    korkiPos.set(...sample.korki);

    // pointer parallax offset on camera
    const parallax = reduced ? 0 : 0.35;
    camera.position.x = camPos.x + pointerX * parallax;
    camera.position.y = camPos.y + pointerY * parallax * 0.5;
    camera.position.z = camPos.z;
    camera.lookAt(
      lookPos.x + pointerX * 0.2,
      lookPos.y - pointerY * 0.1,
      lookPos.z
    );

    // Korki follows path + gentle bob; faces camera
    korkiGroup.position.x = lerp(korkiGroup.position.x, korkiPos.x, 1 - Math.exp(-dt * 6));
    korkiGroup.position.z = lerp(korkiGroup.position.z, korkiPos.z, 1 - Math.exp(-dt * 6));
    const bob = Math.sin(t * 2.1) * 0.05;
    korkiGroup.position.y = lerp(korkiGroup.position.y, korkiPos.y + bob, 1 - Math.exp(-dt * 8));
    korkiGroup.lookAt(camera.position.x, korkiGroup.position.y, camera.position.z);

    // Portal pulse / open
    const portalScale = portalOpen
      ? 1.15 + Math.sin(t * 3.2) * 0.05
      : 1 + Math.sin(t * 1.4) * 0.035;
    portalGroup.scale.setScalar(portalScale);
    portalRing.rotation.z = t * 0.55;
    portalInner.rotation.z = -t * 0.25;
    portalLight.intensity = portalOpen
      ? 3.2 + Math.sin(t * 4) * 0.4
      : 1.5 + Math.sin(t * 2) * 0.35;
    portalLight.color.setHex(portalOpen ? 0xff6b2c : 0x2dd4bf);

    // Lab core animation
    coreSphere.rotation.y += dt * 0.75;
    coreSphere.rotation.x += dt * 0.35;
    orbitRings.forEach((r, i) => {
      r.rotation.z += dt * (0.45 + i * 0.2) * (i % 2 ? -1 : 1);
      r.rotation.x += dt * 0.08 * (i + 1);
    });
    toolOrbs.forEach((o) => {
      o.angle += dt * (0.7 + o.radius * 0.05);
      o.mesh.position.set(
        Math.cos(o.angle) * o.radius,
        Math.sin(o.angle * 1.3) * 0.4,
        Math.sin(o.angle) * o.radius
      );
    });

    // Why pillars hover
    pillars.forEach((p, i) => {
      p.position.y = 1.2 + Math.sin(t * 1.4 + i * 1.1) * 0.1;
      p.rotation.y += dt * 0.35 * (i % 2 ? -1 : 1);
    });

    // Quest cards subtle float
    questCards.forEach((c, i) => {
      c.position.y = 1.3 + Math.sin(t * 1.6 + i * 0.7) * 0.14;
      c.rotation.y =
        (i % 2 === 0 ? -1 : 1) * 0.35 + Math.sin(t * 0.9 + i) * 0.08;
    });

    // Dense prop floaters — orbit around stored baseY
    floaters.forEach((c) => {
      const baseY = c.userData.baseY ?? c.position.y;
      const phase = c.userData.phase ?? 0;
      const speed = c.userData.speed ?? 1;
      c.rotation.x += dt * 0.35;
      c.rotation.y += dt * 0.45;
      c.position.y = baseY + Math.sin(t * speed + phase) * 0.18;
    });

    // Particles drift (upward sparkle)
    const arr = particles.geometry.attributes.position.array;
    for (let i = 0; i < pCount; i++) {
      arr[i * 3 + 1] += pSpd[i] * dt * 0.55;
      arr[i * 3] += Math.sin(t + i) * dt * 0.02;
      if (arr[i * 3 + 1] > 4.2) {
        arr[i * 3 + 1] = 0;
        arr[i * 3] = (Math.random() - 0.5) * 14;
        arr[i * 3 + 2] = -Math.random() * 70 + 8;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    // Mood fog density + living lights
    scene.fog.density = sample.fog;
    rim.position.z = camera.position.z - 4;
    rim.intensity = 1.9 + Math.sin(t * 1.2) * 0.45;
    labCoreLight.intensity = 1.7 + Math.sin(t * 0.9) * 0.35;

    // Panel emissive pulse near camera
    panelMeshes.forEach((m) => {
      const d = Math.abs(m.position.z - camera.position.z);
      const near = clamp(1 - d / 14, 0.15, 1);
      if (m.material.emissiveIntensity !== undefined) {
        m.material.emissiveIntensity =
          0.25 + near * 0.5 + Math.sin(t * 2 + d) * 0.05;
      }
    });

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(tick);

  return {
    ready: true,
    setProgress,
    setPointer,
    setPortalOpen,
    setScene,
    dispose() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            m.dispose();
          });
        }
      });
    },
  };
}

export default initLab3D;
