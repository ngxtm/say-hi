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
