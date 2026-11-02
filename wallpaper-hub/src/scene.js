import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { wallpapers } from './wallpapers.js';
import './style.css';

const DURATION = 16;
const SEED = 0x4b414c49;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector) => document.querySelector(selector);
const clamp = THREE.MathUtils.clamp;

function mulberry32(seed) {
  return function random() {
    let a = (seed += 0x6d2b79f5);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

let activeIndex = 0;
let motionEnabled = !reducedMotion;
let sceneAPI = null;
let toastTimer = 0;

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function updateMetadata(item) {
  $('#art-index').textContent = String(item.index + 1).padStart(2, '0');
  $('#art-series').textContent = item.series;
  $('#art-title').textContent = item.title;
  $('#art-description').textContent = item.description;
  $('#download').href = item.original;
  $('#download').setAttribute('download', `KaliGPT-${item.title.replaceAll(' ', '-')}.jpg`);
  document.documentElement.style.setProperty('--active-accent', item.accent);
  document.querySelectorAll('.thumb').forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === item.index));
  });
  document.querySelectorAll('.gallery-card').forEach((button, index) => {
    button.setAttribute('aria-current', index === item.index ? 'true' : 'false');
  });
  const selected = document.querySelector(`.thumb[data-index="${item.index}"]`);
  selected?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
}

function selectWallpaper(index) {
  activeIndex = (index + wallpapers.length) % wallpapers.length;
  const item = wallpapers[activeIndex];
  updateMetadata(item);
  sceneAPI?.setArtwork(item);
}

function buildCollectionUI() {
  const filmstrip = $('#filmstrip');
  const galleryGrid = $('#gallery-grid');
  wallpapers.forEach((item) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.dataset.index = String(item.index);
    thumb.setAttribute('aria-label', `Show ${item.title}`);
    thumb.setAttribute('aria-pressed', String(item.index === 0));
    thumb.innerHTML = `<img src="${item.image}" width="1344" height="768" alt="" loading="lazy">`;
    thumb.addEventListener('click', () => selectWallpaper(item.index));
    filmstrip.appendChild(thumb);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card';
    card.setAttribute('aria-label', `Open ${item.title} in the 3D viewer`);
    card.innerHTML = `<span class="gallery-card-image"><img src="${item.image}" width="1344" height="768" alt="${item.title} wallpaper" loading="lazy"></span><span class="gallery-card-meta"><strong>${item.title}</strong><span>${String(item.index + 1).padStart(2, '0')} / 09</span></span>`;
    card.addEventListener('click', () => {
      selectWallpaper(item.index);
      $('#gallery').close();
    });
    galleryGrid.appendChild(card);
  });

  $('#previous').addEventListener('click', () => selectWallpaper(activeIndex - 1));
  $('#next').addEventListener('click', () => selectWallpaper(activeIndex + 1));
  $('#gallery-open').addEventListener('click', () => $('#gallery').showModal());
  $('#gallery-close').addEventListener('click', () => $('#gallery').close());
  $('#gallery').addEventListener('click', (event) => {
    if (event.target === $('#gallery')) $('#gallery').close();
  });
  $('#motion').setAttribute('aria-pressed', String(motionEnabled));
  $('#motion').addEventListener('click', () => {
    motionEnabled = !motionEnabled;
    $('#motion').setAttribute('aria-pressed', String(motionEnabled));
    showToast(motionEnabled ? 'Ambient motion enabled' : 'Ambient motion paused');
  });
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showToast('Fullscreen is unavailable in this browser');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  $('#capture').addEventListener('click', () => sceneAPI?.capture4K());
  document.addEventListener('keydown', (event) => {
    if ($('#gallery').open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') selectWallpaper(activeIndex + 1);
    if (event.key === 'ArrowLeft') selectWallpaper(activeIndex - 1);
    if (event.key.toLowerCase() === 'g') $('#gallery').showModal();
    if (event.key.toLowerCase() === 'f') $('#fullscreen').click();
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault();
      $('#motion').click();
    }
  });
}

buildCollectionUI();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $('#scene'),
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
} catch {
  $('#boot-status').textContent = 'WEBGL UNAVAILABLE — GALLERY AND DOWNLOADS REMAIN AVAILABLE';
  $('#capture').disabled = true;
  throw new Error('WebGL initialization failed');
}

renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090e);
scene.fog = new THREE.FogExp2(0x07090e, 0.025);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 0.3, 13);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType,
  colorSpace: THREE.LinearSRGBColorSpace,
}));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.55, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0x82cfff, 0x1b0710, 1.35));
const keyLight = new THREE.DirectionalLight(0xffe0cf, 2.1);
keyLight.position.set(-6, 9, 12);
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x24dfff, 35, 40, 2);
cyanLight.position.set(9, 3, 5);
scene.add(cyanLight);
const redLight = new THREE.PointLight(0xff263c, 28, 32, 2);
redLight.position.set(-8, -1, 5);
scene.add(redLight);

const displayGroup = new THREE.Group();
scene.add(displayGroup);

const planeWidth = 9.8;
const planeHeight = planeWidth / 1.75;
const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();

function coverScale(texture) {
  const image = texture.image;
  const imageAspect = image.width / image.height;
  const planeAspect = planeWidth / planeHeight;
  return imageAspect > planeAspect
    ? new THREE.Vector2(planeAspect / imageAspect, 1)
    : new THREE.Vector2(1, imageAspect / planeAspect);
}

async function loadTexture(item) {
  if (textureCache.has(item.slug)) return textureCache.get(item.slug);
  const promise = textureLoader.loadAsync(item.image).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  });
  textureCache.set(item.slug, promise);
  return promise;
}

const placeholder = new THREE.DataTexture(new Uint8Array([15, 17, 24, 255]), 1, 1);
placeholder.needsUpdate = true;
placeholder.colorSpace = THREE.SRGBColorSpace;

const artworkUniforms = {
  uMap: { value: placeholder },
  uNextMap: { value: placeholder },
  uScaleA: { value: new THREE.Vector2(1, 1) },
  uScaleB: { value: new THREE.Vector2(1, 1) },
  uMix: { value: 0 },
  uPhase: { value: 0 },
  uPointer: { value: new THREE.Vector2() },
  uDepth: { value: 0.78 },
  uMotion: { value: motionEnabled ? 1 : 0 },
};

const artworkMaterial = new THREE.ShaderMaterial({
  uniforms: artworkUniforms,
  vertexShader: /* glsl */`
    uniform sampler2D uMap;
    uniform sampler2D uNextMap;
    uniform vec2 uScaleA;
    uniform vec2 uScaleB;
    uniform float uMix;
    uniform float uPhase;
    uniform float uDepth;
    uniform float uMotion;
    varying vec2 vUv;
    varying float vRelief;
    float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    vec2 coverUv(vec2 uv, vec2 scale) { return (uv - 0.5) * scale + 0.5; }
    void main() {
      vUv = uv;
      vec3 a = texture2D(uMap, coverUv(uv, uScaleA)).rgb;
      vec3 b = texture2D(uNextMap, coverUv(uv, uScaleB)).rgb;
      float light = mix(luminance(a), luminance(b), uMix);
      float subjectMask = 1.0 - smoothstep(0.12, 0.72, distance(uv, vec2(0.5, 0.52)));
      float relief = (light - 0.28) * 0.72 + subjectMask * 0.18;
      vec3 transformed = position;
      transformed.z += relief * uDepth;
      transformed.z += sin(uv.x * 7.0 + uPhase) * cos(uv.y * 5.0 + uPhase) * 0.018 * uMotion;
      vRelief = relief;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap;
    uniform sampler2D uNextMap;
    uniform vec2 uScaleA;
    uniform vec2 uScaleB;
    uniform float uMix;
    uniform float uPhase;
    uniform vec2 uPointer;
    uniform float uMotion;
    varying vec2 vUv;
    varying float vRelief;
    vec2 coverUv(vec2 uv, vec2 scale) { return (uv - 0.5) * scale + 0.5; }
    void main() {
      vec2 uvA = coverUv(vUv, uScaleA);
      vec2 uvB = coverUv(vUv, uScaleB);
      vec2 split = uPointer * (0.0012 + max(vRelief, 0.0) * 0.0018);
      vec3 a;
      a.r = texture2D(uMap, uvA + split).r;
      a.g = texture2D(uMap, uvA).g;
      a.b = texture2D(uMap, uvA - split).b;
      vec3 b = texture2D(uNextMap, uvB).rgb;
      float transitionNoise = sin(vUv.y * 42.0 + uPhase) * 0.012 * sin(uMix * 3.14159265);
      float blend = smoothstep(0.0, 1.0, clamp(uMix + transitionNoise, 0.0, 1.0));
      vec3 color = mix(a, b, blend);
      float vignette = 1.0 - smoothstep(0.28, 0.78, distance(vUv, vec2(0.5))) * 0.34;
      float scan = sin(vUv.y * 1500.0) * 0.006;
      color *= vignette;
      color += scan + max(vRelief, 0.0) * 0.025;
      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
  toneMapped: true,
});

const artwork = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight, 128, 72), artworkMaterial);
artwork.position.z = 0;
displayGroup.add(artwork);

const backplate = new THREE.Mesh(
  new THREE.BoxGeometry(planeWidth + 0.42, planeHeight + 0.42, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x090c13, metalness: 0.92, roughness: 0.28 }),
);
backplate.position.z = -0.5;
displayGroup.add(backplate);

function addFrame(width, height, thickness, depth, color, emissive, z) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.1, metalness: 0.82, roughness: 0.3 });
  const horizontal = new THREE.BoxGeometry(width, thickness, depth);
  const vertical = new THREE.BoxGeometry(thickness, height, depth);
  for (const y of [-height / 2, height / 2]) {
    const bar = new THREE.Mesh(horizontal, material);
    bar.position.set(0, y, z);
    group.add(bar);
  }
  for (const x of [-width / 2, width / 2]) {
    const bar = new THREE.Mesh(vertical, material);
    bar.position.set(x, 0, z);
    group.add(bar);
  }
  displayGroup.add(group);
  return group;
}
addFrame(planeWidth + 0.34, planeHeight + 0.34, 0.045, 0.12, 0x321016, 0xff182d, 0.02);
addFrame(planeWidth + 0.65, planeHeight + 0.65, 0.018, 0.06, 0x09252c, 0x20cfe5, -0.22);

const glass = new THREE.Mesh(
  new THREE.PlaneGeometry(planeWidth, planeHeight),
  new THREE.ShaderMaterial({
    uniforms: { uPhase: artworkUniforms.uPhase, uPointer: artworkUniforms.uPointer },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform float uPhase;
      uniform vec2 uPointer;
      void main(){
        float edge = 1.0 - smoothstep(0.0, 0.018, min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y)));
        float sweep = pow(max(0.0, 1.0-abs(vUv.x+vUv.y*0.35-0.65-uPointer.x*0.08)*8.0), 3.0);
        vec3 color = mix(vec3(0.1,0.75,0.9),vec3(1.0,0.08,0.16),vUv.x);
        gl_FragColor=vec4(color,edge*0.19+sweep*0.025);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
);
glass.position.z = 0.68;
displayGroup.add(glass);

// Reusable architectural family: seeded towers and light strips form two depth bands.
const city = new THREE.Group();
scene.add(city);
const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x111824, metalness: 0.82, roughness: 0.48 });
const towers = new THREE.InstancedMesh(towerGeometry, towerMaterial, 40);
const stripMaterial = new THREE.MeshBasicMaterial({ color: 0x29cfe8, toneMapped: false });
const strips = new THREE.InstancedMesh(towerGeometry, stripMaterial, 40);
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
for (let i = 0; i < 40; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const depth = 7 + Math.floor(i / 2) * 0.8 + rand() * 2;
  const width = 0.8 + rand() * 1.7;
  const height = 4 + rand() * 13;
  const x = side * (7.3 + rand() * 9 + depth * 0.12);
  position.set(x, height * 0.5 - 4.1, -depth);
  scale.set(width, height, 0.8 + rand() * 2.4);
  matrix.compose(position, quaternion, scale);
  towers.setMatrixAt(i, matrix);
  position.set(x - side * width * 0.24, height * 0.5 - 4.1, -depth + scale.z * 0.52);
  scale.set(0.025, height * (0.4 + rand() * 0.5), 0.025);
  matrix.compose(position, quaternion, scale);
  strips.setMatrixAt(i, matrix);
  strips.setColorAt(i, new THREE.Color(i % 5 === 0 ? 0xff243c : 0x29cfe8));
}
city.add(towers, strips);

const ringGroup = new THREE.Group();
ringGroup.position.z = -2.3;
displayGroup.add(ringGroup);
const ringSpecs = [
  [6.7, 0.018, Math.PI * 1.36, 0x1adcf4, 0.24],
  [7.3, 0.026, Math.PI * 0.94, 0xff243c, -0.65],
  [8.15, 0.012, Math.PI * 1.6, 0x267b8b, 1.25],
];
ringSpecs.forEach(([radius, tube, arc, color, rotation]) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 6, 160, arc),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, toneMapped: false }),
  );
  ring.rotation.z = rotation;
  ringGroup.add(ring);
});

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.ShaderMaterial({
    uniforms: { uPhase: artworkUniforms.uPhase },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform float uPhase;
      void main(){
        vec2 p=(vUv-0.5)*180.0;
        vec2 grid=abs(fract(p-0.5)-0.5)/fwidth(p);
        float line=1.0-min(min(grid.x,grid.y),1.0);
        float radial=1.0-smoothstep(4.0,65.0,length(p));
        float axis=1.0-smoothstep(0.0,0.045,abs(p.x));
        vec3 color=mix(vec3(0.02,0.35,0.43),vec3(0.7,0.015,0.04),axis*0.55);
        gl_FragColor=vec4(color,line*radial*0.28);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -4.15;
floor.position.z = -24;
scene.add(floor);

const particleCount = 520;
const particlePositions = new Float32Array(particleCount * 3);
const particleColors = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  const radius = 5 + rand() * 22;
  const angle = rand() * Math.PI * 2;
  particlePositions[i * 3] = Math.cos(angle) * radius;
  particlePositions[i * 3 + 1] = (rand() - 0.42) * 17;
  particlePositions[i * 3 + 2] = 4 - rand() * 32;
  const color = new THREE.Color(i % 7 === 0 ? 0xff3045 : 0x6cecff);
  color.toArray(particleColors, i * 3);
}
const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({
  size: 0.035,
  vertexColors: true,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
}));
scene.add(particles);

// Foreground occluders reinforce depth without crossing the artwork focal area.
const occluderMaterial = new THREE.MeshStandardMaterial({ color: 0x10131c, metalness: 0.95, roughness: 0.25 });
for (const side of [-1, 1]) {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.32, 20, 0.55), occluderMaterial);
  beam.position.set(side * 10.7, 0, 4.5);
  beam.rotation.z = side * -0.12;
  scene.add(beam);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.025, 15, 0.02), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff263c : 0x2adff5, toneMapped: false }));
  light.position.set(side * 10.52, 0, 4.8);
  light.rotation.z = side * -0.12;
  scene.add(light);
}

const pointerTarget = new THREE.Vector2();
const pointer = new THREE.Vector2();
const lookTarget = new THREE.Vector3();
let simTime = 0;
let paused = false;
let capturing = false;
let transition = null;
let currentItem = wallpapers[0];
let ready = false;
let frameCount = 0;
let fpsSampleStart = performance.now();
let measuredFps = 0;
const clock = new THREE.Clock();
const step = 1 / 60;
let accumulator = 0;

function setArtwork(item) {
  if (!ready || item.slug === currentItem.slug && !transition) return;
  const apply = async () => {
    const texture = await loadTexture(item);
    artworkUniforms.uNextMap.value = texture;
    artworkUniforms.uScaleB.value.copy(coverScale(texture));
    artworkUniforms.uMix.value = 0;
    transition = { started: performance.now(), duration: reducedMotion ? 1 : 1050, item, texture };
  };
  apply().catch(() => showToast('This artwork could not be loaded'));
}

function sample(t) {
  const wrappedTime = ((t % DURATION) + DURATION) % DURATION;
  const phase = (wrappedTime / DURATION) * Math.PI * 2;
  const motion = motionEnabled ? 1 : 0;
  artworkUniforms.uPhase.value = phase * motion;
  artworkUniforms.uMotion.value = motion;
  ringGroup.rotation.z = Math.sin(phase) * 0.055 * motion;
  ringGroup.rotation.y = Math.cos(phase) * 0.035 * motion;
  particles.rotation.y = Math.sin(phase) * 0.022 * motion;
  particles.position.y = Math.cos(phase) * 0.12 * motion;
  cyanLight.intensity = 34 + Math.sin(phase) * 3 * motion;
  redLight.intensity = 27 + Math.cos(phase) * 2 * motion;
  camera.position.x = pointer.x * 0.52 + Math.sin(phase) * 0.08 * motion;
  camera.position.y = 0.3 + pointer.y * 0.3 + Math.cos(phase) * 0.045 * motion;
  displayGroup.rotation.y = -pointer.x * 0.045;
  displayGroup.rotation.x = pointer.y * 0.026;
  lookTarget.set(displayGroup.position.x * 0.2, displayGroup.position.y * 0.18, 0);
  camera.lookAt(lookTarget);
}

function updateTransition() {
  if (!transition) return;
  const raw = clamp((performance.now() - transition.started) / transition.duration, 0, 1);
  artworkUniforms.uMix.value = raw * raw * (3 - 2 * raw);
  if (raw >= 1) {
    artworkUniforms.uMap.value = transition.texture;
    artworkUniforms.uScaleA.value.copy(artworkUniforms.uScaleB.value);
    artworkUniforms.uNextMap.value = transition.texture;
    artworkUniforms.uMix.value = 0;
    currentItem = transition.item;
    transition = null;
  }
}

function draw() {
  if (capturing) return;
  updateTransition();
  renderer.info.reset();
  composer.render();
  frameCount++;
  const now = performance.now();
  if (now - fpsSampleStart > 1000) {
    measuredFps = Math.round(frameCount * 1000 / (now - fpsSampleStart));
    frameCount = 0;
    fpsSampleStart = now;
  }
}

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  if (!paused && !capturing && !document.hidden) {
    accumulator += delta;
    while (accumulator >= step) {
      accumulator -= step;
      simTime += step;
    }
    pointer.lerp(pointerTarget, 0.075);
    artworkUniforms.uPointer.value.copy(pointer);
    sample(simTime);
    draw();
  }
});

function layout() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.position.z = aspect < 0.9 ? Math.max(14.2, 11 / aspect) : 13;
  camera.updateProjectionMatrix();
  const mobile = aspect < 0.9;
  displayGroup.position.set(mobile ? 0 : 1.15, mobile ? 2.15 : 0.6, 0);
  displayGroup.scale.setScalar(mobile ? 0.76 : 1);
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sample(simTime);
  if (paused) draw();
}
addEventListener('resize', layout);

addEventListener('pointermove', (event) => {
  if (reducedMotion || $('#gallery').open) return;
  pointerTarget.set((event.clientX / innerWidth - 0.5) * 2, -(event.clientY / innerHeight - 0.5) * 2);
});
addEventListener('pointerleave', () => pointerTarget.set(0, 0));
addEventListener('deviceorientation', (event) => {
  if (reducedMotion || event.gamma === null || event.beta === null) return;
  pointerTarget.set(clamp(event.gamma / 28, -1, 1), clamp((event.beta - 45) / 35, -1, 1));
});

async function capture4K() {
  if (!ready || capturing) return;
  capturing = true;
  const button = $('#capture');
  button.disabled = true;
  button.querySelector('span').textContent = 'Rendering 4K';
  showToast('Rendering a 3840 × 2160 frame…');
  const oldRatio = renderer.getPixelRatio();
  const oldAspect = camera.aspect;
  const oldPosition = displayGroup.position.clone();
  const oldScale = displayGroup.scale.clone();
  const oldCameraZ = camera.position.z;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(3840, 2160, false);
    composer.setPixelRatio(1);
    composer.setSize(3840, 2160);
    camera.aspect = 16 / 9;
    camera.position.z = 13;
    camera.updateProjectionMatrix();
    displayGroup.position.set(0, 0.35, 0);
    displayGroup.scale.setScalar(1);
    sample(simTime);
    composer.render();
    const blob = await new Promise((resolve, reject) => {
      renderer.domElement.toBlob((result) => result ? resolve(result) : reject(new Error('Capture failed')), 'image/png');
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KaliGPT-${currentItem.title.replaceAll(' ', '-')}-4K.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('4K frame captured — 3840 × 2160 PNG');
  } catch {
    showToast('4K capture failed. Try closing other GPU-intensive tabs.');
  } finally {
    renderer.setPixelRatio(oldRatio);
    composer.setPixelRatio(oldRatio);
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = oldAspect;
    camera.position.z = oldCameraZ;
    camera.updateProjectionMatrix();
    displayGroup.position.copy(oldPosition);
    displayGroup.scale.copy(oldScale);
    sample(simTime);
    capturing = false;
    button.disabled = false;
    button.querySelector('span').textContent = 'Capture 4K';
    draw();
  }
}

window.__seek = (time) => {
  const value = Number(time);
  paused = true;
  accumulator = 0;
  simTime = Number.isFinite(value) && value > 0 ? value : 0;
  pointer.set(0, 0);
  pointerTarget.set(0, 0);
  artworkUniforms.uPointer.value.set(0, 0);
  if (transition) {
    artworkUniforms.uMap.value = transition.texture;
    artworkUniforms.uScaleA.value.copy(artworkUniforms.uScaleB.value);
    artworkUniforms.uMix.value = 0;
    currentItem = transition.item;
    transition = null;
  }
  sample(simTime);
  draw();
};
window.__play = () => { paused = false; clock.getDelta(); };
window.__setWallpaper = (index) => selectWallpaper(index);
window.__getMetrics = () => ({
  fps: measuredFps,
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  width: renderer.domElement.width,
  height: renderer.domElement.height,
  active: currentItem.slug,
  motionEnabled,
});

async function initialize() {
  try {
    const first = await loadTexture(wallpapers[0]);
    artworkUniforms.uMap.value = first;
    artworkUniforms.uNextMap.value = first;
    artworkUniforms.uScaleA.value.copy(coverScale(first));
    artworkUniforms.uScaleB.value.copy(coverScale(first));
    layout();
    sample(0);
    composer.render();
    ready = true;
    sceneAPI = { setArtwork, capture4K };
    $('#scene').classList.add('is-ready');
    $('.poster').classList.add('is-hidden');
    $('#boot-status').classList.add('is-hidden');
    window.__SCENE_READY__ = true;
    const timeParam = new URLSearchParams(location.search).get('t');
    if (timeParam !== null) window.__seek(timeParam);
    Promise.allSettled(wallpapers.slice(1).map(loadTexture));
  } catch {
    $('#boot-status').textContent = 'ARTWORK LOAD FAILED — OPEN THE GALLERY FOR ORIGINALS';
    $('#capture').disabled = true;
  }
}
initialize();
