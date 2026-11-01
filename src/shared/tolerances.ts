import { COMPARISON_EPSILON_MM, SCENARIO, type SimulationState } from '../simulation/engine'

/** Use the engine's exact comparison order so displayed checks agree at boundaries. */
export function toleranceChecks(state: SimulationState) {
  if (state.phase === 'ready') {
    const distance = Math.hypot(state.tool.x-state.die.x, state.tool.y-state.die.y)
    const height = Math.abs(state.tool.z-(state.die.z+SCENARIO.dieThickness))
    return [
      { label: 'Pickup XY distance', value: distance*1000, limit: SCENARIO.pickupRadius*1000, unit: 'µm', relation: '≤', within: distance <= SCENARIO.pickupRadius + COMPARISON_EPSILON_MM },
      { label: 'Pickup height error', value: height*1000, limit: SCENARIO.pickupHeightTolerance*1000, unit: 'µm', relation: '≤', within: height <= SCENARIO.pickupHeightTolerance + COMPARISON_EPSILON_MM },
      { label: 'Tool tilt X', value: Math.abs(state.tool.tiltX), limit: 0, unit: '°', relation: '=', within: state.tool.tiltX === 0 },
      { label: 'Tool tilt Y', value: Math.abs(state.tool.tiltY), limit: 0, unit: '°', relation: '=', within: state.tool.tiltY === 0 },
    ]
  }
  const angle = ((state.die.angle+180)%360+360)%360-180
  const x = (state.die.x-SCENARIO.target.x)*1000
  const y = (state.die.y-SCENARIO.target.y)*1000
  const height = state.die.z-SCENARIO.surfaceZ
  return [
    { label: 'X offset', value: Math.abs(x), limit: SCENARIO.placementTolerance*1000, unit: 'µm', relation: '≤', within: Math.abs(x) <= (SCENARIO.placementTolerance + COMPARISON_EPSILON_MM)*1000 },
    { label: 'Y offset', value: Math.abs(y), limit: SCENARIO.placementTolerance*1000, unit: 'µm', relation: '≤', within: Math.abs(y) <= (SCENARIO.placementTolerance + COMPARISON_EPSILON_MM)*1000 },
    { label: 'Rotation', value: Math.abs(angle), limit: SCENARIO.angleTolerance, unit: '°', relation: '≤', within: Math.abs(angle) <= SCENARIO.angleTolerance + 1e-9 },
    { label: 'Release height', value: Math.abs(height)*1000, limit: SCENARIO.releaseHeightTolerance*1000, unit: 'µm', relation: '≤', within: Math.abs(height) <= SCENARIO.releaseHeightTolerance + COMPARISON_EPSILON_MM },
  ]
}
