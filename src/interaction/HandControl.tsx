import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Command } from '../simulation/engine'
import { classifyGesture, initialGesture, type GestureState } from './gestureClassifier'

const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
type Status = 'off' | 'loading' | 'ready' | 'error'
type Props = { send: (command: Command) => void; fine: boolean; active: boolean; setActive: (value: boolean) => void }
export function HandControl({ send, fine, active, setActive }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<HandLandmarker | null>(null)
  const frameRef = useRef(0)
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const gesture = useRef<GestureState>(initialGesture())
  const settings = useRef({ fine, active, sensitivity: 1 })
  const [status, setStatus] = useState<Status>('off')
  const [message, setMessage] = useState('Camera off')
  const [tracked, setTracked] = useState(false)
  const [pinched, setPinched] = useState(false)
  const [sensitivity, setSensitivity] = useState(1)
  const [visible, setVisible] = useState(false)
  const mounted = useRef(true)
  const resetGesture = useCallback(() => { gesture.current = initialGesture(); setTracked(false); setPinched(false) }, [])
  useEffect(() => { settings.current = { fine, active, sensitivity }; resetGesture() }, [fine, active, sensitivity, resetGesture])
  const cleanup = useCallback(() => {
    generation.current++
    cancelAnimationFrame(frameRef.current)
    abortRef.current?.abort(); abortRef.current = null
    const tracker = trackerRef.current; trackerRef.current = null; tracker?.close()
    const stream = streamRef.current; streamRef.current = null; stream?.getTracks().forEach(t => t.stop())
    if (video.current) video.current.srcObject = null
    gesture.current = initialGesture()
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
      setMessage('Camera ready. Downloading hand model...')
      const controller = new AbortController(); abortRef.current = controller
      const timeout = window.setTimeout(() => controller.abort(), 30000)
      let model: Uint8Array
      try {
        const response = await fetch(MODEL, { signal: controller.signal, credentials: 'omit' })
        if (!response.ok) throw new Error(`Model download failed (HTTP ${response.status}).`)
        model = new Uint8Array(await response.arrayBuffer())
      } finally { window.clearTimeout(timeout); abortRef.current = null }
      if (run !== generation.current) return
      setMessage('Initializing hand tracker...')
      const { HandLandmarker } = await import('@mediapipe/tasks-vision')
      const tracker = await HandLandmarker.createFromOptions({ wasmLoaderPath: wasmLoader, wasmBinaryPath: wasmBinary }, { baseOptions: { modelAssetBuffer: model }, runningMode: 'VIDEO', numHands: 1 })
      if (run !== generation.current) { tracker.close(); return }
      trackerRef.current = tracker
      setStatus('ready'); setActive(true); setMessage('Show an open hand, then pinch to move.')
      let lastVideoTime = -1, lastDetection = 0, lastFresh = performance.now(), stallReset = false
      const loop = (now: number) => {
        if (run !== generation.current) return
        try {
          if (!document.hidden && element.readyState >= 2 && element.currentTime !== lastVideoTime && now - lastDetection >= 50) {
            lastVideoTime = element.currentTime; lastDetection = now; lastFresh = now; stallReset = false
            const hand = tracker.detectForVideo(element, now).landmarks[0]
            const current = settings.current
            const result = classifyGesture(gesture.current, hand, now, current.sensitivity, current.fine, element.videoWidth / (element.videoHeight || 1))
            gesture.current = result.state
            setTracked(result.tracked); setPinched(result.pinched)
            if (!current.active) setMessage('Manual XY selected. Select hand XY to control the tool.')
            else if (!result.tracked) setMessage('No hand detected. Open your hand before pinching.')
            else if (!result.state.armed) setMessage('Open your hand to arm movement.')
            else if (result.pinched) setMessage('Pinch active - controlling XY')
            else setMessage('Hand detected - pinch and hold to move')
            if (current.active && (result.dx || result.dy)) send({ type: 'move', dx: result.dx, dy: result.dy })
          } else if (now - lastFresh > 500 && !stallReset) {
            stallReset = true; resetGesture(); setMessage('Camera frames paused. Open your hand to re-arm.')
          }
          frameRef.current = requestAnimationFrame(loop)
        } catch (error) { cleanup(); if (mounted.current) { resetGesture(); setActive(false); setStatus('error'); setMessage(`Tracking stopped: ${error instanceof Error ? error.message : 'unknown error'}`) } }
      }
      frameRef.current = requestAnimationFrame(loop)
    } catch (error) {
      if (run !== generation.current) return
      const detail = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access in the browser site settings.' : error instanceof DOMException && error.name === 'AbortError' ? 'Hand model download timed out. Check your connection and retry.' : error instanceof Error ? error.message : 'Unable to start the camera.'
      cleanup(); resetGesture(); setActive(false); setStatus('error'); setMessage(detail)
    }
  }
  return <section className="hand-control" aria-label="Webcam hand control">
    <div className="hand-heading"><div><span>OPTIONAL INPUT</span><h3>Hand control</h3></div><button onClick={visible ? stop : start}>{visible ? 'STOP CAMERA' : 'START CAMERA'}</button></div>
    <p>Hold a pen as a visual guide if useful; tracking follows your thumb and index finger, not the pen. Open your hand, then pinch and move to control XY. Release to stop; vacuum is separate.</p>
    <div className="input-switch" aria-label="XY input mode"><button className={!active ? 'selected' : ''} onClick={() => { settings.current.active = false; resetGesture(); setActive(false) }}>MANUAL XY</button><button className={active ? 'selected' : ''} disabled={status !== 'ready'} onClick={() => { settings.current.active = true; resetGesture(); setActive(true) }}>HAND XY</button></div>
    <label className="sensitivity">HAND SENSITIVITY <strong>{sensitivity.toFixed(1)}×</strong><input type="range" min="0.3" max="2" step="0.1" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} /></label>
    <div className="hand-preview" hidden={!visible}><video ref={video} muted playsInline /><div className={'hand-status ' + status} role="status">{message}</div></div>
    <div className="hand-indicators"><span>CAMERA: {status.toUpperCase()}</span><span>HAND: {tracked ? 'DETECTED' : 'NOT DETECTED'}</span><span>PINCH: {pinched ? 'ACTIVE' : 'INACTIVE'}</span><span>MODE: {fine ? 'FINE' : 'COARSE'} · {active && pinched ? 'HAND CONTROLLING' : active ? 'HAND ARMED' : 'MANUAL'}</span></div>
    {!visible && <div className="hand-note">Camera stays off until started. The hand model downloads online; frames and landmarks stay in this browser.</div>}
    {status === 'error' && <p className="hand-error">Stop and start the camera to retry. Manual controls remain available.</p>}
  </section>
}
