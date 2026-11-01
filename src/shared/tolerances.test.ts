import { describe, expect, it } from 'vitest'
import { applyCommand, initialState } from '../simulation/engine'
import { toleranceChecks } from './tolerances'

describe('procedure tolerance display', () => {
  it('uses radial pickup distance and rejects a tilted tool', () => {
    let state = applyCommand(initialState(), {type:'move', dx:0.1, dy:0.1, dz:-2.5})
    state = applyCommand(state, {type:'tilt', x:5})
    const checks = toleranceChecks(state)
    expect(checks[0].within).toBe(true)
    expect(checks[2].within).toBe(false)
    expect(applyCommand(state, {type:'vacuum', on:true}).die.attached).toBe(false)
  })
  it('identifies the same failing conditions as the placement assessment', () => {
    let state = applyCommand(initialState(), {type:'move', dz:-2.5})
    state = applyCommand(state, {type:'vacuum', on:true})
    state = applyCommand(state, {type:'move', dx:8, dy:0.2, dz:0.1})
    state = applyCommand(state, {type:'vacuum', on:false})
    const checks = toleranceChecks(state)
    expect(checks.map(check => check.within)).toEqual([true,false,true,false])
    expect(state.result?.passed).toBe(false)
  })
  it('agrees with the assessment at and beyond the 50 µm boundary', () => {
    let state = applyCommand(initialState(), {type:'move', dz:-2.5})
    state = applyCommand(state, {type:'vacuum', on:true})
    state = applyCommand(state, {type:'move', dx:8.05})
    expect(toleranceChecks(state)[0].within).toBe(true)
    expect(applyCommand(state, {type:'vacuum', on:false}).result?.passed).toBe(true)
    state = applyCommand(state, {type:'move', dx:0.001})
    expect(toleranceChecks(state)[0].within).toBe(false)
    expect(applyCommand(state, {type:'vacuum', on:false}).result?.passed).toBe(false)
  })
})
