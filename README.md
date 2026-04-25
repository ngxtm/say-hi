# Hand Frame Portal

![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-0A84FF)
![License](https://img.shields.io/badge/License-See%20LICENSE-black)

Hand Frame Portal is a browser-based camera experience built with Vite and TypeScript. It uses MediaPipe Hand Landmarker and the Canvas 2D API to detect hands in real time, recognize a hand framing gesture, freeze the scene, and let the user capture, preview, and download an image.

The project is intentionally small and focused: a single-page web app with no backend, no framework runtime, and a UI layered directly on top of a fullscreen canvas.

## Features

- Real-time hand tracking in the browser
- Visual hand landmark and connection rendering on a fullscreen canvas
- Gesture-based frame freeze flow
- Hold-to-freeze interaction for more stable detection
- Configurable capture delay: instant, 3 seconds, 5 seconds, or 10 seconds
- Preview modal before saving the captured image
- PNG download flow for captured output
- Reset action to restart the experience quickly
- Mobile-friendly fullscreen layout with responsive controls

## Tech Stack

- Vite
- TypeScript
- `@mediapipe/tasks-vision`
- Canvas 2D
- Browser camera APIs via `navigator.mediaDevices.getUserMedia`

## How It Works

At a high level, the app does the following:

1. Requests camera access from the browser.
2. Loads the MediaPipe Hand Landmarker runtime and hand model.
3. Reads frames from the live video stream.
4. Detects hand landmarks in real time.
5. Builds and stabilizes a polygon from the detected hand pose.
6. Freezes the current scene when the user holds the framing gesture steadily.
7. Lets the user start a delayed capture, preview the result, and download it.

The UI is rendered as a combination of:

- a fullscreen canvas for live drawing and image composition
- lightweight DOM controls for status, capture options, reset, and preview

## Requirements

Before running the project, make sure you have:

- Node.js 18 or newer recommended
- npm available in your environment
- A modern browser with camera support
- Permission to access a webcam
- Internet access to load MediaPipe assets from remote URLs

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will print a local development URL in the terminal. Open that URL in your browser and allow camera access when prompted.

## Production Build

Create a production build:

```bash
npm run build
```

Preview the built app locally:

```bash
npm run preview
```

## Deployment

This project is a static frontend application, so the recommended production setup is a Docker multi-stage build that compiles the app with Node.js and serves the final `dist/` output through Nginx.

Auto deploy smoke test: this line is intentionally safe to change when validating Dokploy watch path triggers.

### Dokploy Deployment

Recommended target:

- Platform: Dokploy
- Source: GitHub repository
- Build type: `Dockerfile`
- Runtime server: Nginx
- Domain: `sayhi.ngxtm.site`

### Required Files

This repository includes the following deployment files:

- `Dockerfile`
- `.dockerignore`
- `nginx.conf`

### Dokploy Setup Steps

1. Create a new application in Dokploy.
2. Connect the application to your GitHub repository.
3. Select the branch you want to deploy.
4. Choose `Dockerfile` as the build method.
5. Use the repository root as the build context.
6. Set the Dockerfile path to `./Dockerfile`.
7. Set the internal application port to `80`.
8. Attach the domain `sayhi.ngxtm.site`.
9. Enable SSL / Let's Encrypt.
10. Run the first deployment manually, then enable auto deploy if the result is stable.

### DNS

Create an `A` record for `sayhi.ngxtm.site` that points to your VPS public IP.

If you use Cloudflare, it is usually safer to start in DNS-only mode for the initial verification, then enable proxying later if needed.

### Important Production Notes

- Camera access requires `HTTPS` in production. If the site is served over plain HTTP, most browsers will block webcam access.
- The app loads MediaPipe runtime and model assets from external URLs.
- Client browsers must be able to access:
  - `https://cdn.jsdelivr.net`
  - `https://storage.googleapis.com`

### Post-Deploy Checklist

After deployment, verify the following on `https://sayhi.ngxtm.site`:

1. The page loads without missing CSS or JavaScript files.
2. The browser prompts for camera access.
3. MediaPipe initializes successfully.
4. Hand detection works in real time.
5. Freeze, delayed capture, preview, and download all work as expected.
6. The browser console does not show mixed-content, asset loading, or camera permission errors.

## Available Scripts

Defined in `package.json`:

- `npm run dev`: starts the Vite development server
- `npm run build`: runs TypeScript checks and creates a production build with Vite
- `npm run preview`: serves the production build locally for verification

## Usage

1. Open the app in a supported browser.
2. Allow camera access.
3. Move your hand into view.
4. Open your palm and hold the framing gesture steady for about one second.
5. Wait for the app to freeze the scene.
6. Choose a capture delay from the selector.
7. Click the capture button.
8. Review the preview image.
9. Download the image if it looks correct.
10. Use `Reset` to clear the frozen state and start over.

## Project Structure

```text
.
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ Dockerfile
├─ nginx.conf
├─ src/
│  ├─ main.ts
│  └─ style.css
└─ README.md
```

## Implementation Notes

- The application entry point is `src/main.ts`.
- Styling lives in `src/style.css`.
- The UI copy is currently written in Vietnamese, while this README is in English.
- The app uses remote MediaPipe assets rather than bundling model files into the repository.
- The capture flow is client-side only; there is no server upload or persistence layer.

## Limitations

- Camera permission is required. If access is denied, the app cannot initialize correctly.
- Hand tracking quality depends on lighting, camera resolution, background clutter, and device performance.
- Network restrictions can block MediaPipe runtime or model asset loading.
- Browser support may vary, especially on older mobile devices or browsers with limited media capabilities.
- The current repository does not include automated tests.

## Troubleshooting

If the app does not start correctly:

1. Confirm that your browser has permission to use the camera.
2. Check that the webcam is not already locked by another application.
3. Verify that your internet connection allows access to external MediaPipe asset URLs.
4. Refresh the page after granting permissions.
5. Re-run `npm install` if dependencies are missing.

If gesture tracking feels unstable:

1. Use brighter and more even lighting.
2. Keep your hand clearly visible and centered in frame.
3. Reduce background clutter behind the hand.
4. Try a device with a better camera or more GPU/CPU headroom.

## License

This repository includes a `LICENSE` file. See that file for the applicable license terms.
