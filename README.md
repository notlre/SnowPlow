# Hearthplow

A cozy 3D isometric snow-plowing game set in a warm twilight mountain village. Steer an articulated snowplow across snow-blanketed streets, carve paths down to cobblestone roads and glistening black ice, light up cabin porches, chain combo multipliers, and upgrade your rig in the garage.

## Features

- **Real-Time 3D Snow Heightfield**: A dynamic `128×128` snow grid that deforms under your V-blade, pushes snow berms along blade edges, and uncovers cobblestones and black-ice patches.
- **Twilight Village Atmosphere**: Glowing cabin windows and porch lanterns that brighten as you clear each driveway, wrought-iron street lamps, chimney smoke, and instanced snow-dusted pine groves.
- **Neighborhood Campaign + Endless Chill Mode**:
  1. **Lantern Cul-de-Sac** — Quiet starter loop with gentle flurries.
  2. **Pine Ridge Bend** — Winding mountain S-curve with deep snowdrifts and crosswinds.
  3. **Frostbrook Crossing** — Shaded crossroads featuring slick black-ice patches.
  4. **Hearthstone Square** — Town square ring with heavy drifts and twilight squalls.
  5. **Endless Chill Valley** — Free-plow sanctuary where gentle snowfall gradually replenishes cleared lanes.
- **Garage Upgrades** (saved locally in `localStorage`):
  - **V-Blade Span** — Widens the steel blade and unlocks side snow wings.
  - **Diesel Torque** — Powers through deep drifts with less bogging.
  - **Heated Tire Grip** — Reduces skidding on black ice and tightens cornering.
  - **Turbo Blower** — Boosts `Shift` turbo speed and extends the combo decay window.
- **Procedural Web Audio Synth**: Real-time engine hum, snow-scrape acoustics, icy skid shimmer, and ascending pentatonic combo chimes (zero external audio files).

## Controls

| Action | Desktop | Touch / Mobile |
| --- | --- | --- |
| Drive / Steer | `W A S D` or `Arrow Keys` | On-screen D-Pad |
| Turbo Boost | `Shift` | `Turbo` button |
| Open / Close Garage | `G` | `Garage` button |
| Mute / Unmute Synth Audio | `M` | `Mute` button |
| Pause / Resume | `Esc` | `Pause` button |
| Start Shift (Title Screen) | `Enter` or `Space` | `Start Shift` button |

> **Tip:** You can switch between **Screen-Relative** and **Cab-Relative** steering inside the **Village Garage** (`G`).

---

## Local Setup

### Prerequisites

- **Node.js** `v18+` (recommended `v20+`)
- **npm** `v9+`

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Development Server

```bash
npm run dev
```

The app starts on port `3000`. Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Type-Check & Production Build

```bash
# Run TypeScript checks
npm run lint

# Build static production assets into dist/
npm run build

# Preview the production build locally
npm run preview
```

---

## Deploying & Sharing with Friends

Because Hearthplow runs completely in the browser with no required backend server, the `dist/` folder produced by `npm run build` can be deployed to any static host:

- **Netlify**: Run `npm run build` and drag-and-drop the `dist/` folder into Netlify Drop (or connect your repository with build command `npm run build` and publish directory `dist`).
- **Vercel**: Import the repository with framework preset **Vite**, build command `npm run build`, and output directory `dist`.
- **Cloudflare Pages / GitHub Pages**: Point the build output to `dist/`.

## Tech Stack

- **React 19** + **TypeScript**
- **Three.js** (procedural PBR materials, `RoomEnvironment` IBL, instanced particle pools)
- **Tailwind CSS v4**
- **Web Audio API** (100% procedural audio synthesis)
- **Vite**
