# Operant AI — Precision Die Placement

A browser-based industrial training simulation built for the DevDay Exchange Community Hackathon, London, 1 November 2026. Mission 001 guides a learner through a face-up semiconductor die transfer, alignment and placement on an illustrative non-conductive epoxy deposit.

## Run locally

Requires Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for the deterministic simulation tests and `npm run build` for a production build. No API key, webcam, database or cloud service is required for the standard controls.

## Procedure

1. The nozzle begins above the source die. Lower its tip to **0.50 mm**, then turn vacuum on.
2. Raise the nozzle, move from X = -4 mm to the target at X = +4 mm, and switch to the microscope.
3. Align X/Y and rotation. Lower the tip to **0.50 mm** and turn vacuum off to release. Inspect the measured result; reset to retry.

Use the on-screen controls or arrow keys for X/Y, W/S for Z, Q/E for rotation, V for vacuum, F to toggle fine control, C to switch camera, and I to inspect. All distances in the simulation are millimetres; inspection reports errors in micrometres.

The scenario uses illustrative limits: pickup within 150 µm horizontally and 80 µm vertically; placement within ±50 µm on each axis, ±2° rotation, and ±30 µm release height. These are not manufacturer-certified limits. This geometric simulation does not predict adhesive curing, bond strength or industrial qualification.

## Implementation and credits

Built for the hackathon with React, TypeScript, Vite, Three.js, React Three Fiber and Drei. All workstation geometry is procedural; no external 3D assets are included. Codex helped implement and integrate the deterministic procedure engine, automated tests, procedural workstation and control interface. The repository's existing MIT license applies to project code; dependencies retain their own licenses. Optional webcam hand control uses MediaPipe Hand Landmarker; its model loads from Google when enabled; its runtime is bundled locally. Camera frames are processed in the browser. A demo recording is not included.

## Optional webcam control

Click **Start camera** and allow camera access. The browser asks for permission before downloading the model. After it loads, show an open hand to arm the control, then pinch thumb and index finger together and move your hand to move the tool in X/Y. Release the pinch to stop. If tracking is lost, open your hand and make a fresh pinch before moving again. A pen can be held as a visual aid, but the camera tracks the fingers, not the pen.

Choose **Manual XY** or **Hand XY** to switch input without resetting the mission. Fine mode and the sensitivity slider control gesture speed. Use the on-screen or keyboard controls for Z, rotation and vacuum. Pinch release never toggles vacuum. Stop the camera when finished. Video frames and landmarks remain in the browser; only the model is downloaded. The webcam does not measure real-world micrometre movements.

The microscope magnification and illumination sliders are simulated optical controls. The model and geometry are illustrative, not a representation of a certified instrument.
