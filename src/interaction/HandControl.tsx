import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Command } from '../simulation/engine'
import { classifyGesture, initialGesture, type GestureState, type ClutchMode } from './gestureClassifier'
import { detectControlGesture, updateAction, initialAction, GESTURE_LABEL, type ControlGesture } from './controlGestures'

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
  const actions = useRef(initialAction())
  const settings = useRef({ fine, active, sensitivity: 1, actionsEnabled: true, clutchMode: 'pen' as ClutchMode })
  const [status, setStatus] = useState<Status>('off')
  const [message, setMessage] = useState('Camera off')
  const [tracked, setTracked] = useState(false)
  const [pinched, setPinched] = useState(false)
  const [sensitivity, setSensitivity] = useState(1)
  const [visible, setVisible] = useState(false)
  const [clutchMode, setClutchMode] = useState<ClutchMode>('pen')
  const [previewSide, setPreviewSide] = useState<'left' | 'right'>('right')
  const [showLandmarks, setShowLandmarks] = useState(true)
  overlayEnabled.current = showLandmarks
  const mounted = useRef(true)
  const resetGesture = useCallback(() => { gesture.current = initialGesture(); actions.current = initialAction(); setTracked(false); setPinched(false) }, [])
  useEffect(() => { settings.current = { fine, active, sensitivity, actionsEnabled, clutchMode }; resetGesture() }, [fine, active, sensitivity, actionsEnabled, clutchMode, resetGesture])
  const cleanup = useCallback(() => {
    generation.current++
    cancelAnimationFrame(frameRef.current)
    abortRef.current?.abort(); abortRef.current = null
    const tracker = trackerRef.current; trackerRef.current = null; tracker?.close()
    const stream = streamRef.current; streamRef.current = null; stream?.getTracks().forEach(t => t.stop())
    if (video.current) video.current.srcObject = null
    gesture.current = initialGesture(); actions.current = initialAction()
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
      const tracker = await HandLandmarker.createFromOptions({ wasmLoaderPath: wasmLoader, wasmBinaryPath: wasmBinary }, { baseOptions: { modelAssetBuffer: model }, runningMode: 'VIDEO', numHands: 1 })
      if (run !== generation.current) { tracker.close(); return }
      trackerRef.current = tracker
      setStatus('ready'); setActive(true); setMessage(settings.current.clutchMode === 'pen' ? 'Tuck your little finger to arm pen movement.' : 'Show an open hand, then pinch to move.')
      let lastVideoTime = -1, lastDetection = 0, lastFresh = performance.now(), stallReset = false
      const loop = (now: number) => {
        if (run !== generation.current) return
        try {
          if (!document.hidden && element.readyState >= 2 && element.currentTime !== lastVideoTime && now - lastDetection >= 50) {
            lastVideoTime = element.currentTime; lastDetection = now; lastFresh = now; stallReset = false
            const hand = tracker.detectForVideo(element, now).landmarks[0]
            const canvas = overlay.current
            if (canvas) {
              if (canvas.width !== element.videoWidth || canvas.height !== element.videoHeight) { canvas.width = element.videoWidth; canvas.height = element.videoHeight }
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                if (hand && overlayEnabled.current) {
                  const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]]
                  ctx.strokeStyle = 'rgba(185,230,202,.8)'; ctx.lineWidth = Math.max(2, canvas.width / 240)
                  for (const [a,b] of edges) { ctx.beginPath(); ctx.moveTo(hand[a].x*canvas.width,hand[a].y*canvas.height); ctx.lineTo(hand[b].x*canvas.width,hand[b].y*canvas.height); ctx.stroke() }
                  for (const id of [4,8,12,16,20]) { ctx.beginPath(); ctx.arc(hand[id].x*canvas.width,hand[id].y*canvas.height,Math.max(3,canvas.width/140),0,Math.PI*2); ctx.fillStyle = '#d2eed8'; ctx.fill() }
                }
              }
            }
            const current = settings.current
            const aspect = element.videoWidth / (element.videoHeight || 1)
            const result = classifyGesture(gesture.current, hand, now, current.sensitivity, current.fine, aspect, current.clutchMode)
            const penClutchEngaging = current.clutchMode === 'pen' && (result.pinched || result.state.candidateSince !== null)
            const pose = current.active && current.actionsEnabled && !penClutchEngaging ? detectControlGesture(hand, aspect, current.clutchMode) : null
            const decision = updateAction(actions.current, pose, now, !!hand && current.active && current.actionsEnabled, result.pinched)
            actions.current = decision.state
            // An action pose always takes precedence over XY so the tool cannot drift while a command is held.
            gesture.current = pose ? initialGesture() : result.state
            setTracked(result.tracked); setPinched(!pose && result.pinched)
            if (decision.action) onGesture(decision.action)
            if (!current.active) setMessage('Manual XY selected. Select hand control to resume.')
            else if (!result.tracked) setMessage('No hand detected. Re-arm the movement clutch.')
            else if (pose && !decision.state.armed) setMessage('Return to a neutral hand or pen grip before a gesture.')
            else if (pose) setMessage(decision.state.fired ? GESTURE_LABEL[pose] + ' active' : 'Hold ' + GESTURE_LABEL[pose] + ' ' + Math.round(decision.progress * 100) + '%')
            else if (!result.state.armed) setMessage(current.clutchMode === 'pen' ? 'Tuck your little finger to arm pen movement.' : 'Open your hand to arm movement.')
            else if (result.pinched) setMessage(current.clutchMode === 'pen' ? 'Little finger raised - controlling XY' : 'Pinch active - controlling XY')
            else setMessage('Hand detected - pinch to move or hold an action gesture')
            if (current.active && !pose && (result.dx || result.dy)) send({ type: 'move', dx: result.dx, dy: result.dy })
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
    <p>The camera follows your fingers, not the pen. In pen-grip mode, keep holding the pen: tuck your little finger to arm, raise it to move, and tuck it again to stop.</p>
    <div className="input-switch" aria-label="XY input mode"><button className={!active ? 'selected' : ''} onClick={() => { settings.current.active = false; resetGesture(); setActive(false) }}>MANUAL</button><button className={active ? 'selected' : ''} disabled={status !== 'ready'} onClick={() => { settings.current.active = true; resetGesture(); setActive(true) }}>HAND CONTROL</button></div>
    <div className="clutch-selector"><span>MOVEMENT CLUTCH</span><div className="input-switch"><button className={clutchMode === 'pen' ? 'selected' : ''} onClick={() => setClutchMode('pen')}>PEN GRIP</button><button className={clutchMode === 'pinch' ? 'selected' : ''} onClick={() => setClutchMode('pinch')}>PINCH</button></div></div>
    <label className="sensitivity">HAND SENSITIVITY <strong>{sensitivity.toFixed(1)}×</strong><input type="range" min="0.3" max="2" step="0.1" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} /></label>
    <label className="gesture-enable"><input type="checkbox" checked={actionsEnabled} onChange={e => setActionsEnabled(e.target.checked)}/> Enable action gestures</label>
    <details className="gesture-guide" open><summary>GESTURE GUIDE · HOLD TO ACTIVATE</summary><ul><li>Pen grip: raise / tuck little finger → move / stop XY</li><li>Pinch mode: thumb + index → move XY</li><li>Thumb + little finger touch (1.4 s) → vacuum on/off</li><li>Pen grip: raise middle + ring, little finger tucked (1 s) → switch view</li><li>Open grip: two fingers / V (1 s) → switch view</li><li>Three fingers (1 s) → fine / coarse</li><li>Thumb up / down → raise / lower Z</li><li>Point index left / right → rotate</li><li>Index + little finger (1 s) → inspect</li></ul><p>Tuck your free fingers to re-arm. Loosen the pen grip for other action gestures. Keep fingers visible and hold poses steady. Disable action gestures to use manual Z and rotation in hand mode. Gestures are estimates; verify placement and vacuum on screen.</p></details>
    <div className={'hand-preview floating-preview ' + previewSide} hidden={!visible}><div className="preview-bar"><span>LIVE CAMERA</span><div><button onClick={() => setShowLandmarks(v => !v)}>{showLandmarks ? 'HIDE POINTS' : 'SHOW POINTS'}</button><button onClick={() => setPreviewSide(v => v === 'right' ? 'left' : 'right')}>MOVE {previewSide === 'right' ? 'LEFT' : 'RIGHT'}</button></div></div><div className="preview-frame"><video ref={video} muted playsInline /><canvas ref={overlay} aria-hidden="true" /></div><div className={'hand-status ' + status} role="status">{message}</div></div>
    <div className="hand-indicators"><span>CAMERA: {status.toUpperCase()}</span><span>HAND: {tracked ? 'DETECTED' : 'NOT DETECTED'}</span><span>CLUTCH: {pinched ? 'ACTIVE' : 'INACTIVE'}</span><span>MODE: {fine ? 'FINE' : 'COARSE'} · {active && pinched ? 'HAND CONTROLLING' : active ? 'HAND SELECTED' : 'MANUAL'}</span></div>
    {!visible && <div className="hand-note">Camera stays off until started. The hand model runs locally; frames and landmarks stay in this browser.</div>}
    {status === 'error' && <p className="hand-error">Stop and start the camera to retry. Manual controls remain available.</p>}
  </section>
}
