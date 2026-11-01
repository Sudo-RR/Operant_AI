import { precisionMeasurements } from '../shared/measurements'
import type { SimulationState } from '../simulation/engine'
import { SCENARIO } from '../simulation/engine'
import { toleranceChecks } from '../shared/tolerances'

export function PrecisionReadout({ state, fine, camera, magnification }: { state: SimulationState; fine: boolean; camera: 'workstation' | 'microscope'; magnification: number }) {
  const value = precisionMeasurements(state)
  const checks = toleranceChecks(state)
  const signed = (number: number) => `${number >= 0 ? '+' : ''}${number.toFixed(0)}`
  return <div className="precision-readout" aria-label="Simulated alignment and clearance">
    <div className="precision-heading"><span>LIVE ALIGNMENT</span><strong>{value.reference}</strong></div>
    <div className="precision-axes"><span>ΔX <b>{signed(value.xUm)}</b> µm</span><span>ΔY <b>{signed(value.yUm)}</b> µm</span></div>
    <div className="precision-meta"><span>Δθ <b>{value.angleDeg >= 0 ? '+' : ''}{value.angleDeg.toFixed(1)}°</b></span><span>{fine ? 'FINE' : 'COARSE'} · VAC {state.vacuum ? 'ON' : 'OFF'}</span></div>
    <div className="precision-clearance"><span>{value.clearanceLabel} CLEARANCE</span><strong>{value.clearanceMm.toFixed(3)} <small>mm</small></strong></div>
    <div className="precision-limits">{state.phase === 'ready' ? `PICKUP ≤${SCENARIO.pickupRadius * 1000} µm XY / ≤${SCENARIO.pickupHeightTolerance * 1000} µm Z · TOOL UPRIGHT` : `LIMITS ±${SCENARIO.placementTolerance * 1000} µm X/Y · ±${SCENARIO.angleTolerance}° · ±${SCENARIO.releaseHeightTolerance * 1000} µm HEIGHT`}</div>
    {state.phase === 'ready' && <div className={'pickup-ready ' + (checks.every(check => check.within) ? 'in-range' : '')}>{checks.every(check => check.within) ? 'WITHIN PICKUP LIMITS' : 'ADJUST FOR PICKUP'}<small>RADIAL {checks[0].value.toFixed(1)} µm · HEIGHT ERROR {checks[1].value.toFixed(1)} µm</small></div>}
    {state.phase === 'carrying' && <div className={'pickup-ready ' + (checks.every(check => check.within) ? 'in-range' : '')}>{checks.every(check => check.within) ? 'WITHIN RELEASE LIMITS' : 'ADJUST FOR DROP'}<small>{checks.filter(check => !check.within).length ? `ADJUST: ${checks.filter(check => !check.within).map(check => check.label.toUpperCase()).join(', ')}` : 'RELEASE VACUUM TO ASSESS'}</small></div>}
    <div className="precision-caption">{camera === 'microscope' ? `VIEW ZOOM ${magnification.toFixed(1)}× · HOUSING HIDDEN` : `${value.object} OFFSET · SIMULATED`}<br/>{state.result ? (state.result.passed ? 'ASSESSMENT: PASS' : 'ASSESSMENT: FAIL') : state.message.startsWith('Pickup failed') ? 'PICKUP FAILED' : `PHASE: ${state.phase.toUpperCase()}`}</div>
  </div>
}
