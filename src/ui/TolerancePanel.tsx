import { toleranceChecks } from '../shared/tolerances'
import type { SimulationState } from '../simulation/engine'

export function TolerancePanel({ state }: { state: SimulationState }) {
  const pickup = state.phase === 'ready'
  return <section className="tolerance-panel" aria-label="Illustrative procedure tolerances">
    <div className="tolerance-title"><span>{pickup ? 'PICKUP REQUIREMENTS' : 'PLACEMENT LIMITS'}</span><strong>{state.result ? (state.result.passed ? 'PASS' : 'FAIL') : 'NOT YET ASSESSED'}</strong></div>
    <p>{pickup ? 'XY is radial distance from the die centre. Return the tool upright before pickup.' : state.result ? 'Measured at release; all limits must pass.' : 'Live die position relative to target. Final result is determined on release.'}</p>
    {toleranceChecks(state).map(check => <div className="tolerance-row" key={check.label}><span>{check.label}</span><span>{check.value.toFixed(check.unit === '°' ? 1 : 2)} / {check.relation} {check.limit.toFixed(check.unit === '°' ? 1 : 0)} {check.unit}</span><b className={check.within ? 'within' : 'outside'}>{check.within ? 'IN' : 'OUT'}</b></div>)}
    <small>Illustrative simulated geometry, not equipment qualification.</small>
  </section>
}
