import { useCallback, useEffect, useRef, useState } from 'react'
import { Scene, type TechnicianPosture } from '../scene/Scene'
import { HandControl } from '../interaction/HandControl'
import { PrecisionReadout } from '../ui/PrecisionReadout'
import { TolerancePanel } from '../ui/TolerancePanel'
import { ProcedureFeedback } from '../ui/ProcedureFeedback'
import type { ControlGesture } from '../interaction/controlGestures'
import { applyCommand, initialState, type Command } from '../simulation/engine'
import { DISPENSE_DEMO_SECONDS } from '../scene/adhesiveAnimation'

export default function App() {
  const [state, setState] = useState(initialState)
  const [camera, setCamera] = useState<'workstation' | 'microscope'>('workstation')
  const [posture, setPosture] = useState<TechnicianPosture>('seated')
  const [viewAngle, setViewAngle] = useState(0)
  const [inspectionAngle, setInspectionAngle] = useState<'top' | 'oblique'>('top')
  const [fine, setFine] = useState(false)
  const [magnification, setMagnification] = useState(1)
  const [illumination, setIllumination] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [cleanView, setCleanView] = useState(false)
  const [showCameraInFilm, setShowCameraInFilm] = useState(true)
  const [fullscreenError, setFullscreenError] = useState('')
  const appRef = useRef<HTMLDivElement>(null)
  const [handActive, setHandActive] = useState(false)
  const [handActionsEnabled, setHandActionsEnabled] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [adhesiveCycle, setAdhesiveCycle] = useState(1)
  const [adhesivePlaying, setAdhesivePlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const handActiveRef = useRef(handActive)
  handActiveRef.current = handActive
  const send = useCallback((command: Command) => setState(s => applyCommand(s, command)), [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!adhesivePlaying) return
    if (state.phase !== 'ready' || reducedMotion) { setAdhesivePlaying(false); return }
    const timer = window.setTimeout(() => setAdhesivePlaying(false), DISPENSE_DEMO_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [adhesivePlaying, adhesiveCycle, state.phase, reducedMotion])
  const replayAdhesive = () => {
    if (state.phase !== 'ready' || reducedMotion) return
    setCamera('workstation'); setPosture('seated'); setViewAngle(0)
    setAdhesiveCycle(cycle => cycle + 1); setAdhesivePlaying(true)
  }
  useEffect(() => {
    const changed = () => { const active = document.fullscreenElement === appRef.current; setFullscreen(active); if (!active) setCleanView(false) }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const toggleFullscreen = () => {
    setFullscreenError('')
    const action = document.fullscreenElement ? document.exitFullscreen() : appRef.current?.requestFullscreen()
    void action?.catch(() => setFullscreenError('Full screen is unavailable in this browser.'))
  }
  const onGesture = useCallback((gesture: ControlGesture) => {
    if (gesture === 'camera') { setCamera(c => c === 'workstation' ? 'microscope' : 'workstation'); return }
    if (gesture === 'vacuum') { setState(s => applyCommand(s, { type: 'vacuum', on: !s.vacuum })); return }
  }, [send])
  const step = fine ? 0.01 : 0.5
  const vertical = fine ? 0.01 : 0.5
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      const commands: Record<string, Command> = {
        arrowleft: { type: 'move', dx: -step }, arrowright: { type: 'move', dx: step },
        arrowup: { type: 'move', dy: -step }, arrowdown: { type: 'move', dy: step },
        w: { type: 'move', dz: vertical }, s: { type: 'move', dz: -vertical },
        q: { type: 'rotate', degrees: fine ? -0.1 : -1 }, e: { type: 'rotate', degrees: fine ? 0.1 : 1 },
        v: { type: 'vacuum', on: !state.vacuum }, i: { type: 'inspect' },
      }
      if (commands[k]) { e.preventDefault(); if (handActiveRef.current && ['arrowleft','arrowright','arrowup','arrowdown','w','s'].includes(k)) return; send(commands[k]) }
      if (k === 'c') setCamera(c => c === 'workstation' ? 'microscope' : 'workstation')
      if (k === 'f') setFine(f => !f)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [fine, send, state.vacuum, step, vertical])
  const move = (dx = 0, dy = 0, dz = 0) => { if (handActiveRef.current) return; send({ type: 'move', dx, dy, dz }) }
  const phase = state.phase === 'ready' ? '01 / PICK UP' : state.phase === 'carrying' ? '02 / PLACE' : '03 / INSPECT'
  return <div ref={appRef} className={'app-shell' + (fullscreen ? ' filming' : '') + (cleanView ? ' clean-view' : '') + (!showCameraInFilm ? ' film-camera-hidden' : '')}>
    <header className="topbar"><div className="brand"><span className="brand-mark">O<span>.</span></span><span>OPERANT <b>AI</b><small>INDUSTRIAL LEARNING SYSTEMS</small></span></div><div className="top-actions"><div className="top-meta"><span className="live-dot"/> SIMULATION ONLINE <span className="divider"/> MISSION 001 <span className="divider"/> <span className="muted">TRAINING ENVIRONMENT</span></div><button className="fullscreen-button" onClick={toggleFullscreen}>{fullscreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}</button></div></header>
    <main className="workspace"><section className="main-column"><div className="mission-heading"><div><div className="eyebrow">PRECISION ASSEMBLY / MISSION 001</div><h1>Die placement <span>workstation</span></h1><p>Practise a precision transfer under the microscope.</p>{fullscreenError && <p role="alert">{fullscreenError}</p>}</div><div className="mission-index"><span>PROCEDURE</span><strong>{phase}</strong></div></div>
      <div className="viewport">{fullscreen && <div className="film-toolbar" aria-label="Recording view controls"><button onClick={() => setCleanView(v => !v)}>{cleanView ? 'SHOW GUIDES' : 'CLEAN VIEW'}</button><button onClick={() => setShowCameraInFilm(v => !v)}>{showCameraInFilm ? 'HIDE CAMERA' : 'SHOW CAMERA'}</button><button onClick={toggleFullscreen}>EXIT FULL SCREEN</button></div>}<Scene state={state} camera={camera} posture={posture} viewAngle={viewAngle} inspectionAngle={inspectionAngle} magnification={magnification} illumination={illumination} adhesivePlaying={adhesivePlaying} adhesiveCycle={adhesiveCycle}/><div className="view-top"><div><span className="view-indicator"/> {camera === 'microscope' ? 'MICROSCOPE VIEW' : 'TECHNICIAN VIEW'} <span className="view-sub"> / LIVE SIMULATION</span></div><div className="camera-tabs"><button className={camera === 'workstation' ? 'active' : ''} onClick={() => setCamera('workstation')}>WORKSTATION</button><button className={camera === 'microscope' ? 'active' : ''} onClick={() => setCamera('microscope')}>MICROSCOPE</button><button className={fine ? 'active' : ''} aria-pressed={fine} onClick={() => setFine(f => !f)}>FINE {fine ? 'ON' : 'OFF'}</button></div></div>{camera === 'microscope' && <><div className="crosshair"><i/><b/></div><div className="inspection-view" role="group" aria-label="Inspection viewpoint"><button aria-pressed={inspectionAngle === 'top'} className={inspectionAngle === 'top' ? 'active' : ''} onClick={() => setInspectionAngle('top')}>TOP</button><button aria-pressed={inspectionAngle === 'oblique'} className={inspectionAngle === 'oblique' ? 'active' : ''} onClick={() => setInspectionAngle('oblique')}>ANGLED</button></div></>}<div className="mission-lights" aria-label="Procedure progress">{(['ready','carrying','placed'] as const).map((stage, i) => <span key={stage} className={(state.phase === stage ? 'current ' : '') + (stage === 'placed' && state.result ? (state.result.passed ? 'pass' : 'fail') : '')}><i/>{['PICKUP','TRANSFER',state.result ? (state.result.passed ? 'PASS' : 'FAIL') : 'PLACE'][i]}</span>)}</div><div className="adhesive-demo"><button onClick={replayAdhesive} disabled={state.phase !== 'ready' || adhesivePlaying || reducedMotion}>{adhesivePlaying ? 'DISPENSING ADHESIVE...' : 'REPLAY ADHESIVE DEMO'}</button><small>{reducedMotion ? 'Animation disabled by reduced-motion setting.' : 'Illustrative preparation'}</small></div><ProcedureFeedback state={state}/><PrecisionReadout state={state} fine={fine} camera={camera} magnification={magnification}/>{camera === 'workstation' && <div className="view-posture" role="group" aria-label="Technician position"><span>POSITION</span><button aria-label="Rotate view left" onClick={() => setViewAngle(a => a - Math.PI / 12)}>LEFT</button><button aria-label="Rotate view right" onClick={() => setViewAngle(a => a + Math.PI / 12)}>RIGHT</button><button className={posture === 'seated' ? 'active' : ''} aria-pressed={posture === 'seated'} onClick={() => { setPosture('seated'); setViewAngle(0) }}>SEATED</button><button className={posture === 'leaning' ? 'active' : ''} aria-pressed={posture === 'leaning'} onClick={() => setPosture('leaning')}>STAND / LEAN IN</button></div>}<div className="view-bottom"><span>● &nbsp; {camera === 'workstation' ? 'DRAG TO ORBIT · SCROLL TO ZOOM' : 'VIRTUAL OPTICS'}</span><span>UNITS: MM &nbsp; / &nbsp; {camera === 'microscope' ? 'MAGNIFIED' : 'OVERVIEW'}</span></div></div>
      <div className="status-strip"><span className="status-icon">↗</span><div><small>PROCEDURE GUIDANCE</small><strong>{state.message}</strong></div><span className="status-phase">{phase}</span></div>
      <div className="under-view"><div><span className="section-label">MISSION OBJECTIVE</span><p>Lower to 0.50 mm and engage vacuum. Raise and transfer to X +4.00, Y 0.00 mm; lower to 0.50 mm and release.</p></div><div className="disclaimer">Illustrative limits: ±50 µm per axis, ±2° rotation, ±30 µm release height. No curing, bond strength or qualification prediction.</div></div>
    </section><aside className="panel"><div className="panel-heading"><div><div className="eyebrow">MANIPULATOR</div><h2>Control console</h2></div><span className="panel-index">01</span></div>
      <TolerancePanel state={state}/>
      <HandControl send={send} fine={fine} active={handActive} setActive={setHandActive} onGesture={onGesture} actionsEnabled={handActionsEnabled} setActionsEnabled={setHandActionsEnabled}/>
      <div className="readouts"><div><span>X POSITION</span><strong>{state.tool.x.toFixed(3)} <small>mm</small></strong></div><div><span>Y POSITION</span><strong>{state.tool.y.toFixed(3)} <small>mm</small></strong></div><div><span>TIP HEIGHT</span><strong>{state.tool.z.toFixed(3)} <small>mm</small></strong></div><div><span>ROTATION</span><strong>{state.tool.angle.toFixed(1)} <small>°</small></strong></div></div>
      <div className="control-title"><span>POSITIONING</span><div className="segmented"><button className={!fine ? 'selected' : ''} onClick={() => setFine(false)}>COARSE</button><button className={fine ? 'selected' : ''} onClick={() => setFine(true)}>FINE</button></div></div><p className="hint">XY step {step} mm · Z step {vertical} mm{handActive ? ' · Hand controls positioning' : ''}</p>
      <div className="motion"><div className="dpad"><button disabled={handActive} aria-label="Move up" onClick={() => move(0,-step)}>↑</button><button disabled={handActive} aria-label="Move left" onClick={() => move(-step)}>←</button><span>XY</span><button disabled={handActive} aria-label="Move right" onClick={() => move(step)}>→</button><button disabled={handActive} aria-label="Move down" onClick={() => move(0,step)}>↓</button></div><div className="zcontrols"><span>Z AXIS</span><button disabled={handActive} onClick={() => move(0,0,vertical)}>↑ <small>RAISE</small></button><button disabled={handActive} onClick={() => move(0,0,-vertical)}>↓ <small>LOWER</small></button></div></div>
      <div className="rotation"><span>ROTATION</span><button onClick={() => send({type:'rotate', degrees: fine ? -0.1 : -1})}>↶ <small>- {fine ? '0.1' : '1'}°</small></button><button onClick={() => send({type:'rotate', degrees: fine ? 0.1 : 1})}>↷ <small>+ {fine ? '0.1' : '1'}°</small></button></div>
      <section className="tilt-controls" aria-label="Pickup pen tilt"><div className="control-title"><span>EMPTY PEN TILT</span><b>X {state.tool.tiltX.toFixed(0)}&#176; / Y {state.tool.tiltY.toFixed(0)}&#176;</b></div><div className="tilt-buttons"><button disabled={state.die.attached} onClick={() => send({type:'tilt', x:-5})}>X -</button><button disabled={state.die.attached} onClick={() => send({type:'tilt', x:5})}>X +</button><button disabled={state.die.attached} onClick={() => send({type:'tilt', y:-5})}>Y -</button><button disabled={state.die.attached} onClick={() => send({type:'tilt', y:5})}>Y +</button><button disabled={state.die.attached} onClick={() => send({type:'tilt', upright:true})}>UPRIGHT</button></div><p>Illustrative +/-15 degrees tilt around the tip; return upright before pickup. Tilt locks while carrying. No collision simulation.</p></section>
      <button className={'vacuum ' + (state.vacuum ? 'on' : '')} onClick={() => send({type:'vacuum',on:!state.vacuum})}><span><i/> VACUUM</span><strong>{state.vacuum ? 'ON' : 'OFF'} &nbsp; ↗</strong></button>
      <div className="actions"><button className="primary" onClick={() => send({type:'inspect'})}>INSPECT PLACEMENT <span>↗</span></button><button className="reset" onClick={() => send({type:'reset'})}>↺ &nbsp; RESET MISSION</button></div>
      {state.result && <div className={'result ' + (state.result.passed ? 'pass' : 'fail')}><span>PLACEMENT ASSESSMENT</span><h3>{state.result.passed ? 'Placement passed' : 'Placement failed'}</h3><p>{state.result.reason}</p><div>ΔX {state.result.xErrorUm.toFixed(1)} µm &nbsp; · &nbsp; ΔY {state.result.yErrorUm.toFixed(1)} µm &nbsp; · &nbsp; Δθ {state.result.angleErrorDeg.toFixed(1)}°</div></div>}
      <section className="instrument-settings"><div className="control-title"><span>MICROSCOPE SETTINGS</span></div><label>MAGNIFICATION <strong>{magnification.toFixed(1)}×</strong><input aria-label="Microscope magnification" type="range" min="0.7" max="2" step="0.1" value={magnification} onChange={e => setMagnification(Number(e.target.value))}/></label><label>ILLUMINATION <strong>{Math.round(illumination*100)}%</strong><input aria-label="Illumination" type="range" min="0.5" max="1.5" step="0.1" value={illumination} onChange={e => setIllumination(Number(e.target.value))}/></label><p>Simulated optical controls</p></section>

      <div className="keyboard"><b>KEYBOARD SHORTCUTS</b><p>Arrows move XY · W/S raise/lower · Q/E rotate<br/>V vacuum · F precision · C camera · I inspect</p></div>
    </aside></main><footer><span>OPERANT AI &nbsp; / &nbsp; SIMULATION SYSTEMS</span><span>MISSION 001 &nbsp; • &nbsp; DEV DAY EDITION</span></footer>
  </div>
}


