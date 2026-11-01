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

Built for the hackathon with React, TypeScript, Vite, Three.js, React Three Fiber and Drei. All workstation geometry is procedural; no external 3D assets are included. Codex helped implement and integrate the deterministic procedure engine, automated tests, procedural workstation and control interface. The repository's existing MIT license applies to project code; dependencies retain their own licenses. Optional webcam hand control uses Google MediaPipe Hand Landmarker and a locally bundled model and runtime. Camera frames are processed in the browser. A demo recording is not included.

## Hand control

Click **Start camera** and allow camera access. A floating, mirrored preview stays visible when you scroll; use **Move left/right** to reposition it and **Hide/Show points** to toggle the landmark overlay. The default assigns your right hand to X/Y and your left hand to height; use the **Position / pen hand** buttons to swap them. Keep both hands visible and apart. Green landmarks show the position hand; gold shows the height hand.

- **Position hand, pen grip:** hold the pen with thumb and index and hold the hand still briefly to arm. Move the hand to move X/Y; hold it still to stop. After tracking loss, hold still again before moving. The camera tracks the grip, not the pen; the pen can obscure landmarks.
- **Position hand, pinch mode:** open thumb and index to arm, then pinch and move for X/Y. Release the pinch to stop.
- **Height hand:** open thumb and index to arm, then pinch and move the hand up or down to adjust Z. Release to stop. Tracking loss stops the affected hand and requires a fresh clutch.
- **Switch view:** hold a V with the position hand for one second. The on-screen view buttons remain available.
- **Toggle vacuum:** hold a V with the height hand for 1.4 seconds, then relax it before another toggle. Check the on-screen vacuum state and tool height before releasing a die.

Choose **Manual** to use positioning buttons and keyboard, or **Hand control** for X/Y and Z. View, vacuum, rotation, fine mode and inspection also remain available from the console. The sensitivity slider and Fine mode adjust hand motion sensitivity. **Full screen** expands the workspace; drag the workstation view to orbit and scroll over it to zoom.

The webcam model and runtime are served locally. Frames and landmarks stay in the browser. Gesture recognition is approximate and can be affected by lighting, hand orientation and a pen blocking the fingers; inspect on-screen feedback and use manual controls if a gesture is not recognized. The webcam does not measure real-world micrometre movements. The microscope magnification and illumination sliders are simulated optical controls; the model and geometry are illustrative, not a certified instrument.

### Hand model attribution

The bundled `public/models/hand_landmarker.task` is Google MediaPipe Hand Landmarker (full, float16, version 1), from the [official model](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task), licensed under [Apache 2.0](public/models/LICENSE-APACHE-2.0.txt) as described in its [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf). SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`. The workspace reference project, Virtual Puppet Theater, was inspected for its MediaPipe setup; no source code was copied.
