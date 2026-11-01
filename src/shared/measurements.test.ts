import { describe, expect, it } from 'vitest'
import { applyCommand, initialState } from '../simulation/engine'
import { precisionMeasurements } from './measurements'

describe('simulated instrument readouts', () => {
  it('shows the source-relative pickup offset and tip clearance', () => {
    const state = applyCommand(initialState(), {type:'move', dx:0.1, dy:-0.05, dz:-1})
    const value = precisionMeasurements(state)
    expect(value.reference).toBe('DIE PICKUP')
    expect(value.xUm).toBeCloseTo(100)
    expect(value.yUm).toBeCloseTo(-50)
    expect(value.clearanceMm).toBeCloseTo(1.5)
  })
  it('switches to die-relative target offset and surface clearance after pickup', () => {
    let state = applyCommand(initialState(), {type:'move', dz:-2.5})
    state = applyCommand(state, {type:'vacuum', on:true})
    state = applyCommand(state, {type:'move', dx:8.02, dy:-0.03, dz:0.4})
    const value = precisionMeasurements(state)
    expect(value.reference).toBe('SUBSTRATE TARGET')
    expect(value.xUm).toBeCloseTo(20)
    expect(value.yUm).toBeCloseTo(-30)
    expect(value.clearanceMm).toBeCloseTo(0.4)
  })
  it('reports normalized die rotation relative to the target', () => {
    let state = applyCommand(initialState(), {type:'move', dz:-2.5})
    state = applyCommand(state, {type:'vacuum', on:true})
    state = applyCommand(state, {type:'rotate', degrees:181})
    expect(precisionMeasurements(state).angleDeg).toBeCloseTo(-179)
  })
})
