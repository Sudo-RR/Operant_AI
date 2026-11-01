import { useCallback, useEffect, useState } from 'react'
import { Scene } from '../scene/Scene'
import { applyCommand, initialState, type Command } from '../simulation/engine'

export default function App() {
  const [state, setState] = useState(initialState)
  const [camera, setCamera] = useState<'workstation' | 'microscope'>('workstation')
  const [fine, setFine] = useState(false)
  const send = useCallback((command: Command) => setState(s => applyCommand(s, command)), [])
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
      if (commands[k]) { e.preventDefault(); send(commands[k]) }
      if (k === 'c') setCamera(c => c === 'workstation' ? 'microscope' : 'workstation')
      if (k === 'f') setFine(f => !f)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [fine, send, state.vacuum, step, vertical])
  const move = (dx = 0, dy = 0, dz = 0) => send({ type: 'move', dx, dy, dz })
  const phase = state.phase === 'ready' ? '01 / PICK UP' : state.phase === 'carrying' ? '02 / PLACE' : '03 / INSPECT'
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">O<span>.</span></span><span>OPERANT <b>AI</b><small>INDUSTRIAL LEARNING SYSTEMS</small></span></div><div className="top-meta"><span className="live-dot"/> SIMULATION ONLINE <span className="divider"/> MISSION 001 <span className="divider"/> <span className="muted">TRAINING ENVIRONMENT</span></div></header>
    <main className="workspace"><section className="main-column"><div className="mission-heading"><div><div className="eyebrow">PRECISION ASSEMBLY / MISSION 001</div><h1>Die placement <span>workstation</span></h1><p>Practise a precision transfer under the microscope.</p></div><div className="mission-index"><span>PROCEDURE</span><strong>{phase}</strong></div></div>
      <div className="viewport"><Scene state={state} camera={camera}/><div className="view-top"><div><span className="view-indicator"/> {camera === 'microscope' ? 'MICROSCOPE VIEW' : 'WORKSTATION VIEW'} <span className="view-sub"> / LIVE SIMULATION</span></div><div className="camera-tabs"><button className={camera === 'workstation' ? 'active' : ''} onClick={() => setCamera('workstation')}>WORKSTATION</button><button className={camera === 'microscope' ? 'active' : ''} onClick={() => setCamera('microscope')}>MICROSCOPE</button></div></div>{camera === 'microscope' && <div className="crosshair"><i/><b/></div>}<div className="view-bottom"><span>● &nbsp; VIRTUAL OPTICS</span><span>UNITS: MM &nbsp; / &nbsp; {camera === 'microscope' ? 'MAGNIFIED' : 'OVERVIEW'}</span></div></div>
      <div className="status-strip"><span className="status-icon">↗</span><div><small>PROCEDURE GUIDANCE</small><strong>{state.message}</strong></div><span className="status-phase">{phase}</span></div>
      <div className="under-view"><div><span className="section-label">MISSION OBJECTIVE</span><p>Lower to 0.50 mm and engage vacuum. Raise and transfer to X +4.00, Y 0.00 mm; lower to 0.50 mm and release.</p></div><div className="disclaimer">Illustrative limits: ±50 µm per axis, ±2° rotation, ±30 µm release height. No curing, bond strength or qualification prediction.</div></div>
    </section><aside className="panel"><div className="panel-heading"><div><div className="eyebrow">MANIPULATOR</div><h2>Control console</h2></div><span className="panel-index">01</span></div>
      <div className="readouts"><div><span>X POSITION</span><strong>{state.tool.x.toFixed(3)} <small>mm</small></strong></div><div><span>Y POSITION</span><strong>{state.tool.y.toFixed(3)} <small>mm</small></strong></div><div><span>TIP HEIGHT</span><strong>{state.tool.z.toFixed(3)} <small>mm</small></strong></div><div><span>ROTATION</span><strong>{state.tool.angle.toFixed(1)} <small>°</small></strong></div></div>
      <div className="control-title"><span>POSITIONING</span><div className="segmented"><button className={!fine ? 'selected' : ''} onClick={() => setFine(false)}>COARSE</button><button className={fine ? 'selected' : ''} onClick={() => setFine(true)}>FINE</button></div></div><p className="hint">XY step {step} mm · Z step {vertical} mm</p>
      <div className="motion"><div className="dpad"><button aria-label="Move up" onClick={() => move(0,-step)}>↑</button><button aria-label="Move left" onClick={() => move(-step)}>←</button><span>XY</span><button aria-label="Move right" onClick={() => move(step)}>→</button><button aria-label="Move down" onClick={() => move(0,step)}>↓</button></div><div className="zcontrols"><span>Z AXIS</span><button onClick={() => move(0,0,vertical)}>↑ <small>RAISE</small></button><button onClick={() => move(0,0,-vertical)}>↓ <small>LOWER</small></button></div></div>
      <div className="rotation"><span>ROTATION</span><button onClick={() => send({type:'rotate', degrees: fine ? -0.1 : -1})}>↶ <small>- {fine ? '0.1' : '1'}°</small></button><button onClick={() => send({type:'rotate', degrees: fine ? 0.1 : 1})}>↷ <small>+ {fine ? '0.1' : '1'}°</small></button></div>
      <button className={'vacuum ' + (state.vacuum ? 'on' : '')} onClick={() => send({type:'vacuum',on:!state.vacuum})}><span><i/> VACUUM</span><strong>{state.vacuum ? 'ON' : 'OFF'} &nbsp; ↗</strong></button>
      <div className="actions"><button className="primary" onClick={() => send({type:'inspect'})}>INSPECT PLACEMENT <span>↗</span></button><button className="reset" onClick={() => send({type:'reset'})}>↺ &nbsp; RESET MISSION</button></div>
      {state.result && <div className={'result ' + (state.result.passed ? 'pass' : 'fail')}><span>PLACEMENT ASSESSMENT</span><h3>{state.result.passed ? 'Placement passed' : 'Placement failed'}</h3><p>{state.result.reason}</p><div>ΔX {state.result.xErrorUm.toFixed(1)} µm &nbsp; · &nbsp; ΔY {state.result.yErrorUm.toFixed(1)} µm &nbsp; · &nbsp; Δθ {state.result.angleErrorDeg.toFixed(1)}°</div></div>}
      <div className="keyboard"><b>KEYBOARD SHORTCUTS</b><p>Arrows move XY · W/S raise/lower · Q/E rotate<br/>V vacuum · F precision · C camera · I inspect</p></div>
    </aside></main><footer><span>OPERANT AI &nbsp; / &nbsp; SIMULATION SYSTEMS</span><span>MISSION 001 &nbsp; • &nbsp; DEV DAY EDITION</span></footer>
  </div>
}


