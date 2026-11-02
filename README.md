# Operant AI — Precision Die Placement

A browser-based industrial training simulation built for the DevDay Exchange Community Hackathon, London, 1 November 2026. Mission 001 guides a learner through a face-up semiconductor die transfer, alignment and placement on an illustrative non-conductive epoxy deposit.

## Run locally

Requires Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for the deterministic simulation tests and `npm run build` for a production build. No API key, webcam, database or cloud service is required for the standard controls.

## GitHub Pages

The deployment workflow builds and publishes pushes to `main`. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The site is served at `https://sudo-rr.github.io/Operant_AI/`. The Vite base path in `vite.config.ts` must match the repository name if the project is renamed or deployed elsewhere.

## Procedure

1. Watch the illustrative adhesive dispensing sequence, or choose **Replay adhesive demo** before pickup. The nozzle begins above the source die. Lower its tip to **0.50 mm**, then turn vacuum on.
2. Raise the nozzle, move from X = -4 mm to the target at X = +4 mm, and switch to the microscope.
3. Align X/Y and rotation. Lower the tip to **0.50 mm** and turn vacuum off to release. Inspect the measured result; reset to retry.

Use the on-screen controls or arrow keys for X/Y, W/S for Z, Q/E for rotation, V for vacuum, F to toggle fine control, C to switch camera, and I to inspect. All distances in the simulation are millimetres; inspection reports errors in micrometres.

The workstation opens from a seated technician perspective looking down over the bench. Use **Stand / lean in** for a closer overhead position and **Seated** to return. The gloved hand is an illustrative representation that follows the simulated tool, not a reconstruction of the tracked hand. Its nozzle guide projects onto the work surface, while the **Live Alignment** panel shows source-relative pickup or target-relative placement offsets, rotation and vertical clearance from the simulated poses, plus vacuum and assessment status. During pickup and release, brief labels and an animated ring acknowledge attachment or release without moving the die away from its simulated pose. Before release, the live overlay shows whether the current X, Y, rotation and release height are within the illustrative limits. The instrument indicators reflect the simulation state; a small decorative cooling fan respects the operating system reduced-motion preference. The microscope centres the source before pickup and the target after pickup. Its TOP and ANGLED views and zoom controls change the view only, not the tool mapping or scoring; the upper tool housing is hidden in this view to keep the die visible.

The scenario uses illustrative limits: pickup within 150 µm horizontally and 80 µm vertically; placement within ±50 µm on each axis, ±2° rotation, and ±30 µm release height. The tolerance panel shows each measured value against its limit and the final result is computed on release. The empty pen can tilt up to +/-15 degrees about each axis in 5-degree steps; it must be upright for pickup and cannot tilt while carrying. Tilt is illustrative and does not model pen collisions. These are not manufacturer-certified limits. The dispensing animation is visual only: the substrate is treated as pre-prepared, and playback does not gate the procedure or affect scoring. It does not simulate volume, flow or curing; reduced-motion settings show the finished deposit without the animation. This geometric simulation does not predict adhesive curing, bond strength or industrial qualification.

## Implementation and credits

Built for the hackathon with React, TypeScript, Vite, Three.js, React Three Fiber and Drei. The interactive workstation geometry is procedural, with an independent locally bundled [Industrial Microscope](https://polyhaven.com/a/industrial_microscope) model by Lukas Walzer (Poly Haven, CC0) on the neighboring bench. The die circuit image is an AI-generated illustrative texture, prompted as a top-down photomicrograph of generic bare silicon with fine metallization and circuit blocks. It does not represent a specific device. The lab beyond it is an AI-generated 360-degree image panorama, not a navigable 3D space. The brushed-metal PBR maps are [ambientCG Metal 012](https://ambientcg.com/view?id=Metal012), licensed CC0, and are bundled locally. The backdrop was generated with OpenAI image generation from a prompt for a photorealistic microelectronics assembly lab with multiple benches, microscopes, instruments, antistatic mats and shelving, viewed from a seated technician's perspective. Codex helped implement and integrate the deterministic procedure engine, automated tests, procedural workstation and control interface. The repository's existing MIT license applies to project code; dependencies retain their own licenses. Optional webcam hand control uses Google MediaPipe Hand Landmarker and a locally bundled model and runtime. Camera frames are processed in the browser. A demo recording is not included.

## Hand control

Click **Start camera** and allow camera access. A floating, mirrored preview stays visible when you scroll; use **Move left/right** to reposition it and **Hide/Show points** to toggle the landmark overlay. The default assigns your right hand to X/Y and your left hand to height; use the **Position / pen hand** buttons to swap them. Keep both hands visible and apart. Green landmarks show the position hand; gold shows the height hand.

- **Position hand, pen grip:** hold the pen with thumb and index and hold the hand still briefly to arm. Move the hand to move X/Y; hold it still to stop. After tracking loss, hold still again before moving. The camera tracks the grip, not the pen; the pen can obscure landmarks.
- **Position hand, pinch mode:** open thumb and index to arm, then pinch and move for X/Y. Release the pinch to stop.
- **Height hand:** open thumb and index to arm, then pinch and move the hand up or down to adjust Z. Release to stop. Tracking loss stops the affected hand and requires a fresh clutch.
- **Switch view:** hold a V with the position hand for one second. The on-screen view buttons remain available.
- **Toggle vacuum:** hold a V with the height hand for 1.4 seconds, then relax it before another toggle. Check the on-screen vacuum state and tool height before releasing a die.

Choose **Manual** to use positioning buttons and keyboard, or **Hand control** for X/Y and Z. View, vacuum, rotation, fine mode and inspection also remain available from the console. The sensitivity slider and Fine mode adjust hand motion sensitivity. **Full screen** expands the simulator for recording. In full screen, use **Clean view** to hide guides and **Hide camera** to hide the preview without stopping tracking. Move the pointer to the top centre to reveal the recording controls again, or press Escape to exit. Drag the workstation view to orbit, scroll to zoom, or use the rotation arrows beside the posture buttons. These controls orbit the 3D workstation; the distant lab is a 360-degree panorama rather than a navigable 3D room.

The webcam model and runtime are served locally. Frames and landmarks stay in the browser. Gesture recognition is approximate and can be affected by lighting, hand orientation and a pen blocking the fingers; inspect on-screen feedback and use manual controls if a gesture is not recognized. The webcam does not measure real-world micrometre movements. The microscope magnification and illumination sliders are simulated optical controls; the model and geometry are illustrative, not a certified instrument.

### Hand model attribution

The bundled `public/models/hand_landmarker.task` is Google MediaPipe Hand Landmarker (full, float16, version 1), from the [official model](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task), licensed under [Apache 2.0](public/models/LICENSE-APACHE-2.0.txt) as described in its [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf). SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`. The workspace reference project, Virtual Puppet Theater, was inspected for its MediaPipe setup; no source code was copied.
