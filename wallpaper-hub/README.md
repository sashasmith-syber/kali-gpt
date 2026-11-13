# KaliGPT Neon Archive

A standalone, deployable Three.js showcase for the custom KaliGPT wallpaper series. It sits independently from the main KaliGPT application and requires no API, account, environment variable, or backend.

## Experience

- Nine supplied artworks with a responsive filmstrip and full gallery
- Real subdivided 3D artwork geometry displaced by image luminance
- Pointer parallax, supported device tilt, ambient particles, architectural depth bands, and animated orbital frames
- Smooth artwork transitions, fullscreen viewing, original JPEG downloads, and reduced-motion support
- On-demand 3840 × 2160 PNG capture rendered by the WebGL engine
- Static poster fallback when WebGL or artwork initialization is unavailable

The supplied source images retain their original resolution. **Capture 4K** creates a new 4K render of the live scene; it does not claim to recover native 4K detail from the source files.

## Run locally

Requires Node.js 20.19+.

```bash
npm ci
npm run dev
```

## Production build

```bash
npm ci
npm run build
npm run preview
```

The portable static site is generated in `dist/` and can be served by any static web server.

## Docker

```bash
docker build -t kaligpt-neon-archive .
docker run --rm -p 8080:80 kaligpt-neon-archive
```

Open `http://localhost:8080`.

## Controls

- **Left / Right arrows:** previous or next artwork
- **G:** open the gallery
- **F:** toggle fullscreen
- **Space:** toggle ambient motion when the page background has focus
- **Pointer / supported device tilt:** move the camera and artwork in parallax

## Structure

- `src/scene.js` — UI wiring, deterministic Three.js scene, shaders, transitions, capture
- `src/wallpapers.js` — collection metadata and asset mapping
- `src/style.css` — responsive interface and accessibility states
- `public/wallpapers/` — generated WebGL/display WebP files and downloadable JPEG originals
- `public/fonts/` — generated locally bundled interface fonts
- `encoded-assets/` — transport-safe, base64-encoded copies of the binary assets; `predev` and `prebuild` restore them into `public/` automatically

All scene variation uses a fixed seed. Verification hooks are available as `window.__SCENE_READY__`, `window.__seek(t)`, `window.__play()`, and `window.__getMetrics()`.
