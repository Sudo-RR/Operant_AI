import { describe, expect, it } from 'vitest';
import { applyCommand, initialState, SCENARIO, type SimulationState } from './engine';

const command = applyCommand;
const pickup = (): SimulationState => command(command(initialState(), { type: 'move', dz: -2.5 }), { type: 'vacuum', on: true });

describe('die placement procedure', () => {
  it('rejects pickup out of proximity', () => {
    const state = command(initialState(), { type: 'vacuum', on: true });
    expect(state.die.attached).toBe(false);
    expect(state.message).toContain('Pickup failed');
  });
  it('attaches at contact and transports the rigid die', () => {
    const state = command(pickup(), { type: 'move', dx: 8, dy: 0.1, dz: 1 });
    expect(state.die.attached).toBe(true);
    expect(state.die.x).toBe(state.tool.x);
    expect(state.die.y).toBe(state.tool.y);
    expect(state.die.z).toBeCloseTo(state.tool.z - SCENARIO.dieThickness);
  });
  it('reports misalignment and excessive release height', () => {
    let state = command(pickup(), { type: 'move', dx: 8, dy: 0.2, dz: 1 });
    state = command(state, { type: 'vacuum', on: false });
    expect(state.result?.passed).toBe(false);
    expect(state.result?.reason).toContain('release height');
    expect(state.result?.reason).toContain('X/Y offset');
  });
  it('passes an accurately placed die and reset restores the mission', () => {
    let state = command(pickup(), { type: 'move', dx: 8 });
    state = command(state, { type: 'vacuum', on: false });
    expect(state.result?.passed).toBe(true);
    expect(command(state, { type: 'reset' })).toEqual(initialState());
  });
  it('detects excessive rotation', () => {
    let state = command(pickup(), { type: 'move', dx: 8 });
    state = command(state, { type: 'rotate', degrees: 3 });
    state = command(state, { type: 'vacuum', on: false });
    expect(state.result?.reason).toContain('rotation');
  });
});
