import { useEffect, useRef, useState } from 'react'
import type { Command } from '../simulation/engine'
import type { HandLandmarker } from '@mediapipe/tasks-vision'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
type Status = 'off' | 'loading' | 'ready' | 'error'

type Props = { send: (command: Command) => void; fine: boolean }
export function HandControl({ send, fine }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState<Status>('off')
  const [message, setMessage] = useState('Camera off')
  const fineRef = useRef(fine)
  useEffect(() => { fineRef.current = fine }, [fine])

  useEffect(() => {
    if (!enabled) { setStatus('off'); setMessage('Camera off'); return }
    let cancelled = false
    let stream: MediaStream | undefined
    let tracker: HandLandmarker | undefined
    let frame = 0
    let lastTime = -1
    let lastDetection = 0
    let previous: { x: number; y: number } | undefined
    let pinched = false
    let lastLabel = ''
    const label = (text: string) => { if (lastLabel !== text) { lastLabel = text; setMessage(text) } }
    const cleanup = () => { cancelAnimationFrame(frame); stream?.getTracks().forEach(t => t.stop()); tracker?.close(); if (video.current) video.current.srcObject = null }
    async function start() {
      try {
        setStatus('loading'); setMessage('Loading hand tracking and requesting camera access...')
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires localhost or HTTPS in a supported browser.')
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
        const files = await FilesetResolver.forVisionTasks(WASM)
        const created = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL }, runningMode: 'VIDEO', numHands: 1 })
        if (cancelled) { created.close(); return }
        tracker = created
        const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
        if (cancelled) { acquired.getTracks().forEach(t => t.stop()); return }
        stream = acquired
        const element = video.current
        if (!element) throw new Error('Camera preview is unavailable.')
        element.srcObject = stream
        await element.play()
        if (cancelled) return
        setStatus('ready'); label('Show one hand to the camera')
        const loop = (now: number) => {
          if (cancelled) return
          try {
            if (element.readyState >= 2 && element.currentTime !== lastTime && now - lastDetection >= 50) {
              lastTime = element.currentTime; lastDetection = now
              const landmarks = tracker!.detectForVideo(element, now).landmarks[0]
              if (!landmarks) { previous = undefined; pinched = false; label('Show one hand to the camera') }
              else {
                const thumb = landmarks[4], index = landmarks[8]
                const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y)
                pinched = pinched ? distance < 0.085 : distance < 0.055
                const point = { x: 1 - (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 }
                if (pinched && previous) {
                  // Relative, bounded movement avoids jumps when a pinch begins or tracking is lost.
                  const scale = fineRef.current ? 0.6 : 12
                  const dx = Math.max(-0.25, Math.min(0.25, (point.x - previous.x) * scale))
                  const dy = Math.max(-0.25, Math.min(0.25, (point.y - previous.y) * scale))
                  if (Math.hypot(dx, dy) > (fineRef.current ? 0.001 : 0.006)) send({ type: 'move', dx, dy })
                }
                previous = pinched ? point : undefined
                label(pinched ? 'Pinch held - moving XY' : 'Hand detected - pinch to move')
              }
            }
            frame = requestAnimationFrame(loop)
          } catch (error) { cleanup(); setStatus('error'); setMessage(`Tracking stopped: ${error instanceof Error ? error.message : 'unknown error'}`) }
        }
        frame = requestAnimationFrame(loop)
      } catch (error) {
        cleanup()
        if (!cancelled) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Unable to start camera.') }
      }
    }
    void start()
    return () => { cancelled = true; cleanup() }
  }, [enabled, send])

  return <section className="hand-control" aria-label="Webcam hand control">
    <div className="hand-heading"><div><span>OPTIONAL INPUT</span><h3>Hand control</h3></div><button onClick={() => setEnabled(v => !v)}>{enabled ? 'STOP CAMERA' : 'START CAMERA'}</button></div>
    <p>Pinch thumb and index finger, then move your hand to move XY. Release to stop. Use the console for Z, rotation and vacuum.</p>
    <div className="hand-preview" hidden={!enabled}><video ref={video} muted playsInline /><div className={'hand-status ' + status} role="status">{message}</div></div>
    {!enabled && <div className="hand-note">Camera stays off until you start it. Hand tracking loads its model and runtime online; video is processed in your browser.</div>}
    {status === 'error' && <p className="hand-error">Check camera permission and your internet connection, then stop and start the camera to retry. Mouse and keyboard remain available.</p>}
  </section>
}
