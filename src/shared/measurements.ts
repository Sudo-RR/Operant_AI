import { SCENARIO, type SimulationState } from '../simulation/engine'

/** Readouts are computed in millimetres from the simulated pose, never from webcam estimates. */
export function precisionMeasurements(state: SimulationState) {
  const source = state.phase === 'ready'
  const point = source ? state.tool : state.die
  const reference = source ? state.die : SCENARIO.target
  const clearance = source
    ? state.tool.z - (state.die.z + SCENARIO.dieThickness)
    : state.die.z - SCENARIO.surfaceZ
  return {
    reference: source ? 'DIE PICKUP' : 'SUBSTRATE TARGET',
    object: source ? 'TOOL' : 'DIE',
    xUm: (point.x - reference.x) * 1000,
    yUm: (point.y - reference.y) * 1000,
    angleDeg: ((point.angle - (source ? state.die.angle : 0) + 180) % 360 + 360) % 360 - 180,
    clearanceMm: clearance,
    clearanceLabel: source ? 'TIP TO DIE' : 'DIE TO SURFACE',
  }
}
