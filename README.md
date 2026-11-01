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

Click **Start camera** and allow camera access. A floating, mirrored preview stays visible when you scroll; use **Move left/right** to reposition it and **Hide/Show points** to toggle the hand landmark overlay. Tracking uses your thumb and fingers, not a physical pen; holding a pen may obscure landmarks. Pen grip is the default movement mode; select Pinch to use the original thumb/index clutch.

- **Pen grip mode:** hold the pen with thumb and index, tuck the little finger to arm, then raise it to move XY. Tuck it again to stop without releasing vacuum. After tracking loss, tuck it before raising it again.
- **Pinch mode:** open your thumb and index to arm, then pinch and move for XY. Release the pinch to stop without releasing vacuum.
- Touch thumb and little finger with the other three fingers extended and hold for 1.4 seconds: toggle vacuum. Check the on-screen vacuum state and ensure the tool is at the intended height before releasing.
- In pen grip, keep the little finger tucked and raise the middle and ring fingers for 1 second: switch view without releasing the pen. With an open grip, hold a two-finger V for 1 second to switch view.
- Hold three fingers for 1 second: switch fine/coarse mode.
- Hold a thumbs-up or thumbs-down pose: raise or lower Z in steps.
- Point your index finger left or right with the other fingers curled: rotate in steps.
- Hold index and little finger extended for 1 second: inspect.

Return to a neutral hand/pen grip for at least 0.3 seconds between action gestures. Loosen the pen grip for action gestures other than the pen-grip view switch. A pose needs a deliberate hold; the preview shows the recognized gesture and hold progress. Tracking loss or a pinch resets the action gesture; open your hand again before the next action. Select **Manual** to use positioning buttons and keyboard, or **Hand control** for hand positioning and action gestures. Vacuum and inspection buttons remain available in either mode. The sensitivity slider adjusts hand XY speed; Fine reduces movement, Z and rotation steps. The **Enable action gestures** checkbox disables the additional poses without disabling XY movement; when it is off, manual Z and rotation controls are also available in Hand control mode.

The webcam model and runtime are served locally. Frames and landmarks stay in the browser. Gesture recognition is approximate and can be affected by lighting, hand orientation and a pen blocking the fingers; inspect on-screen feedback and use manual controls if a gesture is not recognized. The webcam does not measure real-world micrometre movements. The microscope magnification and illumination sliders are simulated optical controls; the model and geometry are illustrative, not a certified instrument.

### Hand model attribution

The bundled `public/models/hand_landmarker.task` is Google MediaPipe Hand Landmarker (full, float16, version 1), from the [official model](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task), licensed under [Apache 2.0](public/models/LICENSE-APACHE-2.0.txt) as described in its [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf). SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`. The workspace reference project, Virtual Puppet Theater, was inspected for its MediaPipe setup; no source code was copied.
