import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Command } from '../simulation/engine'
import { classifyGesture, initialGesture, type GestureState, type ClutchMode } from './gestureClassifier'
import { detectControlGesture, updateAction, initialAction, GESTURE_LABEL, type ControlGesture } from './controlGestures'
import { assignHandRoles, guardHandRoles, heightDelta, type HandSide, type RoleAnchors } from './twoHands'

const MODEL = `${import.meta.env.BASE_URL}models/hand_landmarker.task`
type Status = 'off' | 'loading' | 'ready' | 'error'
type Props = { send: (command: Command) => void; fine: boolean; active: boolean; setActive: (value: boolean) => void; onGesture: (gesture: ControlGesture) => void; actionsEnabled: boolean; setActionsEnabled: (value: boolean) => void }
export function HandControl({ send, fine, active, setActive, onGesture, actionsEnabled, setActionsEnabled }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const overlayEnabled = useRef(true)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<HandLandmarker | null>(null)
  const frameRef = useRef(0)
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const gesture = useRef<GestureState>(initialGesture())
  const heightGesture = useRef<GestureState>(initialGesture())
  const roleAnchors = useRef<RoleAnchors>({})
  const actions = useRef(initialAction())
  const heightActions = useRef(initialAction())
  const settings = useRef({ fine, active, sensitivity: 1, actionsEnabled: true, clutchMode: 'pen' as ClutchMode, xySide: 'Right' as HandSide })
  const [status, setStatus] = useState<Status>('off')
  const [message, setMessage] = useState('Camera off')
  const [tracked, setTracked] = useState(false)
  const [pinched, setPinched] = useState(false)
  const [heightTracked, setHeightTracked] = useState(false)
  const [heightPinched, setHeightPinched] = useState(false)
  const [xySide, setXySide] = useState<HandSide>('Right')
  const [sensitivity, setSensitivity] = useState(1)
  const [visible, setVisible] = useState(false)
  const [clutchMode, setClutchMode] = useState<ClutchMode>('pen')
  const [previewSide, setPreviewSide] = useState<'left' | 'right'>('right')
  const [showLandmarks, setShowLandmarks] = useState(true)
  overlayEnabled.current = showLandmarks
  const mounted = useRef(true)
  const resetGesture = useCallback(() => { gesture.current = initialGesture(); heightGesture.current = initialGesture(); roleAnchors.current = {}; actions.current = initialAction(); heightActions.current = initialAction(); setTracked(false); setPinched(false); setHeightTracked(false); setHeightPinched(false) }, [])
  useEffect(() => { settings.current = { fine, active, sensitivity, actionsEnabled, clutchMode, xySide }; resetGesture() }, [fine, active, sensitivity, actionsEnabled, clutchMode, xySide, resetGesture])
  const cleanup = useCallback(() => {
    generation.current++
    cancelAnimationFrame(frameRef.current)
    abortRef.current?.abort(); abortRef.current = null
    const tracker = trackerRef.current; trackerRef.current = null; tracker?.close()
    const stream = streamRef.current; streamRef.current = null; stream?.getTracks().forEach(t => t.stop())
    if (video.current) video.current.srcObject = null
    gesture.current = initialGesture(); heightGesture.current = initialGesture(); roleAnchors.current = {}; actions.current = initialAction(); heightActions.current = initialAction()
  }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup() } }, [cleanup])
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) resetGesture() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [resetGesture])
  const stop = () => { cleanup(); setVisible(false); setStatus('off'); setMessage('Camera off'); setActive(false); resetGesture() }
  const start = async () => {
    cleanup(); resetGesture(); setVisible(true); setStatus('loading'); setMessage('Waiting for camera permission...')
    const run = generation.current
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires localhost or HTTPS in a supported browser.')
      // Request permission immediately, before downloading the model or initializing MediaPipe.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      if (run !== generation.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (run !== generation.current) return
        cleanup(); if (mounted.current) { setActive(false); setStatus('error'); setMessage('Camera disconnected. Stop and start the camera to retry.'); resetGesture() }
      }, { once: true })
      const element = video.current
      if (!element) throw new Error('Camera preview is unavailable.')
      element.srcObject = stream
      await element.play()
      if (run !== generation.current) return
      setMessage('Camera ready. Loading local hand model...')
      const controller = new AbortController(); abortRef.current = controller
      const timeout = window.setTimeout(() => controller.abort(), 30000)
      let model: Uint8Array
      try {
        const response = await fetch(MODEL, { signal: controller.signal, credentials: 'omit' })
        if (!response.ok) throw new Error(`Local hand model could not be loaded (HTTP ${response.status}).`)
        model = new Uint8Array(await response.arrayBuffer())
        if (model.byteLength < 1_000_000) throw new Error('Local hand model is missing or incomplete. Reinstall or restore public/models/hand_landmarker.task.')
      } finally { window.clearTimeout(timeout); if (abortRef.current === controller) abortRef.current = null }
      if (run !== generation.current) return
      setMessage('Initializing hand tracker...')
      const { HandLandmarker } = await import('@mediapipe/tasks-vision')
      const tracker = await HandLandmarker.createFromOptions({ wasmLoaderPath: wasmLoader, wasmBinaryPath: wasmBinary }, { baseOptions: { modelAssetBuffer: model }, runningMode: 'VIDEO', numHands: 2 })
      if (run !== generation.current) { tracker.close(); return }
      trackerRef.current = tracker
      setStatus('ready'); setActive(true); setMessage(settings.current.clutchMode === 'pen' ? 'Hold the pen hand still to arm movement.' : 'Show an open hand, then pinch to move.')
      let lastVideoTime = -1, lastDetection = 0, lastFresh = performance.now(), stallReset = false
      const loop = (now: number) => {
        if (run !== generation.current) return
        try {
          if (!document.hidden && element.readyState >= 2 && element.currentTime !== lastVideoTime && now - lastDetection >= 66) {
            lastVideoTime = element.currentTime; lastDetection = now; lastFresh = now; stallReset = false
            const detection = tracker.detectForVideo(element, now)
            const current = settings.current
            const assigned = assignHandRoles(detection.landmarks.map((landmarks, index) => ({
              landmarks, label: detection.handedness[index]?.[0]?.categoryName, confidence: detection.handedness[index]?.[0]?.score,
            })), current.xySide)
            const guarded = guardHandRoles(assigned, roleAnchors.current)
            const roles = guarded.roles
            roleAnchors.current = guarded.anchors
            const hand = roles.xy?.landmarks
            const heightHand = roles.height?.landmarks
            const canvas = overlay.current
            if (canvas) {
              if (canvas.width !== element.videoWidth || canvas.height !== element.videoHeight) { canvas.width = element.videoWidth; canvas.height = element.videoHeight }
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                if (overlayEnabled.current) {
                  const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[0,13]]
                  for (const [landmarks, color] of [[hand, '#b9e6ca'], [heightHand, '#e4c99b']] as const) {
                    if (!landmarks) continue
                    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, canvas.width / 240)
                    for (const [a,b] of edges) { ctx.beginPath(); ctx.moveTo(landmarks[a].x*canvas.width,landmarks[a].y*canvas.height); ctx.lineTo(landmarks[b].x*canvas.width,landmarks[b].y*canvas.height); ctx.stroke() }
                    for (const id of [4,8,12,16]) { ctx.beginPath(); ctx.arc(landmarks[id].x*canvas.width,landmarks[id].y*canvas.height,Math.max(3,canvas.width/140),0,Math.PI*2); ctx.fillStyle = color; ctx.fill() }
                  }
                }
              }
            }
            const aspect = element.videoWidth / (element.videoHeight || 1)
            const result = classifyGesture(gesture.current, hand, now, current.sensitivity, current.fine, aspect, current.clutchMode)
            const depth = classifyGesture(heightGesture.current, heightHand, now, current.sensitivity, current.fine, aspect, 'pinch')
            const detectedPose = current.active && current.actionsEnabled ? detectControlGesture(hand, aspect) : null
            const pose = detectedPose === 'camera' ? 'camera' : null
            const decision = updateAction(actions.current, pose, now, !!hand && current.active && current.actionsEnabled, current.clutchMode === 'pinch' && result.pinched)
            const heightPose = current.active && current.actionsEnabled && !depth.pinched && detectControlGesture(heightHand, aspect) === 'camera' ? 'vacuum' : null
            const vacuumDecision = updateAction(heightActions.current, heightPose, now, !!heightHand && current.active && current.actionsEnabled, depth.pinched)
            actions.current = decision.state
            heightActions.current = vacuumDecision.state
            // An action pose always takes precedence over XY so the tool cannot drift while a command is held.
            gesture.current = pose ? initialGesture() : result.state
            heightGesture.current = heightPose ? initialGesture() : depth.state
            setTracked(result.tracked); setPinched(!pose && result.pinched)
            setHeightTracked(depth.tracked); setHeightPinched(!heightPose && depth.pinched)
            if (decision.action) onGesture(decision.action)
            if (vacuumDecision.action) onGesture(vacuumDecision.action)
            if (!current.active) setMessage('Manual XY selected. Select hand control to resume.')
            else if (roles.ambiguous) setMessage('Hand roles unclear. Separate your hands and re-arm.')
            else if (heightPose && !vacuumDecision.state.armed) setMessage('Relax your height hand before the vacuum gesture.')
            else if (heightPose) setMessage(vacuumDecision.state.fired ? 'Vacuum gesture activated' : 'Hold height-hand V for vacuum ' + Math.round(vacuumDecision.progress * 100) + '%')
            else if (!result.tracked) setMessage('No hand detected. Re-arm the movement clutch.')
            else if (pose && !decision.state.armed) setMessage('Return to a neutral hand or pen grip before a gesture.')
            else if (pose) setMessage(decision.state.fired ? GESTURE_LABEL[pose] + ' active' : 'Hold ' + GESTURE_LABEL[pose] + ' ' + Math.round(decision.progress * 100) + '%')
            else if (!result.state.armed) setMessage(current.clutchMode === 'pen' ? 'Hold the pen hand still briefly to arm movement.' : 'Open your hand to arm movement.')
            else if (depth.pinched) setMessage('Height hand active - move up or down')
            else if (result.pinched) setMessage(current.clutchMode === 'pen' ? 'Pen hand active - move to control XY' : 'Pinch active - controlling XY')
            else setMessage('Position hand ready. Pinch with your other hand to adjust height.')
            if (current.active && !pose && !heightPose && (result.dx || result.dy)) send({ type: 'move', dx: result.dx, dy: result.dy })
            const dz = current.active && !heightPose ? heightDelta(depth) : 0
            if (dz) send({ type: 'move', dz })
          } else if (now - lastFresh > 500 && !stallReset) {
            stallReset = true; resetGesture(); setMessage('Camera frames paused. Reset your grip to re-arm.')
          }
          frameRef.current = requestAnimationFrame(loop)
        } catch (error) { cleanup(); if (mounted.current) { resetGesture(); setActive(false); setStatus('error'); setMessage(`Tracking stopped: ${error instanceof Error ? error.message : 'unknown error'}`) } }
      }
      frameRef.current = requestAnimationFrame(loop)
    } catch (error) {
      if (run !== generation.current) return
      const detail = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access in the browser site settings.' : error instanceof DOMException && error.name === 'AbortError' ? 'Local hand model took too long to load. Check the app installation and retry.' : error instanceof Error ? error.message : 'Unable to start the camera.'
      cleanup(); resetGesture(); setActive(false); setStatus('error'); setMessage(detail)
    }
  }
  return <section className="hand-control" aria-label="Webcam hand control">
    <div className="hand-heading"><div><span>OPTIONAL INPUT</span><h3>Hand control</h3></div><button onClick={visible ? stop : start}>{visible ? 'STOP CAMERA' : 'START CAMERA'}</button></div>
    <p>Use one hand for the pen and the other for height. The camera tracks your grip, not the pen itself. Keep both hands visible and apart.</p>
    <div className="input-switch" aria-label="XY input mode"><button className={!active ? 'selected' : ''} onClick={() => { settings.current.active = false; resetGesture(); setActive(false) }}>MANUAL</button><button className={active ? 'selected' : ''} disabled={status !== 'ready'} onClick={() => { settings.current.active = true; resetGesture(); setActive(true) }}>HAND CONTROL</button></div>
    <div className="clutch-selector"><span>POSITION / PEN HAND</span><div className="input-switch" aria-label="Choose position hand"><button className={xySide === 'Right' ? 'selected' : ''} onClick={() => { settings.current.xySide = 'Right'; resetGesture(); setXySide('Right') }}>RIGHT HAND</button><button className={xySide === 'Left' ? 'selected' : ''} onClick={() => { settings.current.xySide = 'Left'; resetGesture(); setXySide('Left') }}>LEFT HAND</button></div></div>
    <div className="clutch-selector"><span>MOVEMENT CLUTCH</span><div className="input-switch"><button className={clutchMode === 'pen' ? 'selected' : ''} onClick={() => setClutchMode('pen')}>PEN GRIP</button><button className={clutchMode === 'pinch' ? 'selected' : ''} onClick={() => setClutchMode('pinch')}>PINCH</button></div></div>
    <label className="sensitivity">HAND SENSITIVITY <strong>{sensitivity.toFixed(1)}×</strong><input type="range" min="0.3" max="2" step="0.1" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} /></label>
    <label className="gesture-enable"><input type="checkbox" checked={actionsEnabled} onChange={e => setActionsEnabled(e.target.checked)}/> Enable view and vacuum gestures</label>
    <details className="gesture-guide" open><summary>TWO-HAND GUIDE</summary><ul><li><b>{xySide} hand · XY:</b> hold your pen grip still briefly to arm, then move it to position the tool. Hold still to stop.</li><li><b>{xySide === 'Right' ? 'Left' : 'Right'} hand · Z:</b> open thumb and index, then pinch and move the hand up or down. Release to stop.</li><li><b>View:</b> hold a V with the position hand for 1 second, or use the microscope button.</li><li><b>Vacuum:</b> hold a V with the height hand for 1.4 seconds. Relax between toggles.</li></ul><p>Green landmarks show the position hand; gold shows the height hand. Hand roles may be swapped above. Vacuum and view remain accessible as buttons; use the console for rotation, fine mode and inspection. Gestures are estimates: verify the vacuum and placement on screen.</p></details>
    <div className={'hand-preview floating-preview ' + previewSide} hidden={!visible}><div className="preview-bar"><span>LIVE CAMERA</span><div><button onClick={() => setShowLandmarks(v => !v)}>{showLandmarks ? 'HIDE POINTS' : 'SHOW POINTS'}</button><button onClick={() => setPreviewSide(v => v === 'right' ? 'left' : 'right')}>MOVE {previewSide === 'right' ? 'LEFT' : 'RIGHT'}</button></div></div><div className="preview-frame"><video ref={video} muted playsInline /><canvas ref={overlay} aria-hidden="true" /></div><div className={'hand-status ' + status} role="status">{message}</div></div>
    <div className="hand-indicators"><span>CAMERA: {status.toUpperCase()}</span><span>MODE: {fine ? 'FINE' : 'COARSE'}</span><span>XY {xySide.toUpperCase()}: {tracked ? (pinched ? 'ACTIVE' : 'READY') : 'NOT DETECTED'}</span><span>Z {xySide === 'Right' ? 'LEFT' : 'RIGHT'}: {heightTracked ? (heightPinched ? 'ACTIVE' : 'READY') : 'NOT DETECTED'}</span><span>{active ? 'HAND CONTROL SELECTED' : 'MANUAL CONTROL SELECTED'}</span></div>
    {!visible && <div className="hand-note">Camera stays off until started. The hand model runs locally; frames and landmarks stay in this browser.</div>}
    {status === 'error' && <p className="hand-error">Stop and start the camera to retry. Manual controls remain available.</p>}
  </section>
}
