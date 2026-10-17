# CaliTracker

A mobile-first, client-side calisthenics training analyzer built with React, TypeScript, Vite, MediaPipe Pose Landmarker, and IndexedDB.

## Run locally

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Camera access requires a secure browser context: HTTPS on a deployed site, or `localhost` during development. Grant camera permission when prompted. If camera access is unavailable, select a skill and upload a video instead.

Create and preview a production build:

```sh
npm run build
npm run preview
```

To deploy, publish the generated `dist/` directory to any static HTTPS host (for example, Cloudflare Pages, Netlify, or Vercel). No backend is required.

## Install on a phone

The production build includes a web app manifest, generated Android/Apple icons, and a Workbox service worker. Deploy `dist/` to Netlify over HTTPS, open the site in Chrome on Android, and choose **Install app** in the browser menu or use the in-app install button when Chrome offers it. On iOS, use Safari's **Share → Add to Home Screen**. The app shell is precached; the public MediaPipe model and matching WASM assets are cached after their first successful load. The app continues to process camera footage and uploaded videos on-device. The service worker does not cache user video, recordings, or IndexedDB training history.

If the app icon source changes, run `npm run generate-pwa-assets` before building. To test offline support locally, run `npm run build` followed by `npm run preview`, load the preview once while online, and then use the browser's offline mode. Netlify builds require Node.js 20.19+ or 22.12+ as declared in `package.json`.

## Privacy and model setup

Pose inference and analysis run in the browser. MediaPipe Tasks Vision 1.1.1 is pinned and bundled with the app; its matching WASM runtime and the Pose Landmarker Lite model are included as local public assets in the production build. No runtime CDN connection is needed to initialize pose detection. The camera feed and uploaded video are not sent to a server. After inference, session metadata and, when available, the recording are kept in this browser's IndexedDB. Browser storage limits vary; a large video may not fit. The training log allows deleting individual sessions or all locally stored data.

The camera uses `getUserMedia()` and recordings use `MediaRecorder` when supported. Browser, device, and selected camera capabilities determine available codecs and camera switching behavior.

## What the analysis means

Pose detection uses actual MediaPipe landmarks. Separate front lever, handstand, handstand push-up, and bent-arm press analyzers estimate body-line alignment and joint extension from 2D landmarks. The rep counters use joint-angle phases for push/pull exercises, body-line phases for front lever raises and press entries, and wrist displacement events for handstand walking. Hold qualification has configurable position tolerance and smoothing strength.

These are coaching estimates, not a validated biomechanical assessment. A single 2D view cannot reliably measure depth, rotation, balance, or every 3D movement; camera angle, occlusion, lighting, clothing, and tracking confidence affect results. A score is withheld when pose evidence is insufficient. Counts and scores should be reviewed against the video, especially for skills whose movement is not well represented by the recommended camera view.

## Project structure

- `src/data/skills.ts` — skill library and progression metadata.
- `src/lib/pose.ts` — lazy MediaPipe model loading and frame inference.
- `src/lib/analyzers/` — category-specific 2D pose feature analyzers and shared landmark math.
- `src/lib/analyzer.ts` — hold tracking, movement-phase counters, and confidence-aware weighted report scoring.
- `src/lib/storage.ts` — IndexedDB session and video persistence.
- `src/App.tsx` / `src/App.css` — responsive dashboard and analysis workflow.

## Validation

```sh
npm run lint
npm run build
```
