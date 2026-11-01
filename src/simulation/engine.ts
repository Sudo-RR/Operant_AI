/** All distances in this module are in millimetres; angles are degrees. */
export const SCENARIO = {
  source: { x: -4, y: 0 }, target: { x: 4, y: 0 },
  surfaceZ: 0.4, dieThickness: 0.1,
  pickupRadius: 0.15, pickupHeightTolerance: 0.08,
  placementTolerance: 0.05, angleTolerance: 2, releaseHeightTolerance: 0.03,
} as const;

export type Pose = { x: number; y: number; z: number; angle: number };
export type Assessment = { passed: boolean; xErrorUm: number; yErrorUm: number; angleErrorDeg: number; reason: string };
export type SimulationState = {
  tool: Pose;
  die: Pose & { attached: boolean };
  vacuum: boolean;
  phase: 'ready' | 'carrying' | 'placed';
  message: string;
  result: Assessment | null;
};
export type Command =
  | { type: 'move'; dx?: number; dy?: number; dz?: number }
  | { type: 'rotate'; degrees: number }
  | { type: 'vacuum'; on: boolean }
  | { type: 'inspect' }
  | { type: 'reset' };

export function initialState(): SimulationState {
  return {
    tool: { x: -4, y: 0, z: 3, angle: 0 },
    die: { x: -4, y: 0, z: SCENARIO.surfaceZ, angle: 0, attached: false },
    vacuum: false, phase: 'ready', result: null,
    message: 'Position the nozzle over the die and lower it to contact height (0.50 mm).',
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const normalAngle = (a: number) => ((a + 180) % 360 + 360) % 360 - 180;
const safe = (n: number | undefined) => Number.isFinite(n) ? n! : 0;

function assess(die: Pose): Assessment {
  const x = (die.x - SCENARIO.target.x) * 1000;
  const y = (die.y - SCENARIO.target.y) * 1000;
  const angle = normalAngle(die.angle);
  const height = die.z - SCENARIO.surfaceZ;
  const reasons: string[] = [];
  if (Math.abs(height) > SCENARIO.releaseHeightTolerance) reasons.push(`release height ${Math.round(height * 1000)} µm above the surface exceeds ±${SCENARIO.releaseHeightTolerance * 1000} µm`);
  if (Math.abs(x) > SCENARIO.placementTolerance * 1000 || Math.abs(y) > SCENARIO.placementTolerance * 1000) reasons.push(`X/Y offset exceeds ±${SCENARIO.placementTolerance * 1000} µm`);
  if (Math.abs(angle) > SCENARIO.angleTolerance) reasons.push(`rotation exceeds ±${SCENARIO.angleTolerance}°`);
  return { passed: reasons.length === 0, xErrorUm: x, yErrorUm: y, angleErrorDeg: angle,
    reason: reasons.length ? `Placement failed: ${reasons.join('; ')}.` : 'Placement within the illustrative geometric tolerances.' };
}

export function applyCommand(state: SimulationState, command: Command): SimulationState {
  if (command.type === 'reset') return initialState();
  if (command.type === 'inspect') {
    return { ...state, message: state.result?.reason ?? 'Release the die onto the target before inspecting the placement.' };
  }
  if (command.type === 'move') {
    const minimumZ = state.die.attached ? state.tool.z - state.die.z + SCENARIO.surfaceZ : SCENARIO.surfaceZ + SCENARIO.dieThickness;
    const tool = { ...state.tool, x: clamp(state.tool.x + safe(command.dx), -8, 8), y: clamp(state.tool.y + safe(command.dy), -5, 5), z: clamp(state.tool.z + safe(command.dz), minimumZ, 5) };
    const die = state.die.attached ? { ...state.die, x: state.die.x + tool.x - state.tool.x, y: state.die.y + tool.y - state.tool.y, z: state.die.z + tool.z - state.tool.z } : state.die;
    return { ...state, tool, die };
  }
  if (command.type === 'rotate') {
    const tool = { ...state.tool, angle: normalAngle(state.tool.angle + safe(command.degrees)) };
    const radians = safe(command.degrees) * Math.PI / 180;
    const x = state.die.x - state.tool.x, y = state.die.y - state.tool.y;
    return { ...state, tool, die: state.die.attached ? { ...state.die, x: tool.x + x * Math.cos(radians) - y * Math.sin(radians), y: tool.y + x * Math.sin(radians) + y * Math.cos(radians), angle: normalAngle(state.die.angle + safe(command.degrees)) } : state.die };
  }
  if (command.on === state.vacuum) return state;
  if (command.on) {
    if (state.phase !== 'ready') return { ...state, message: 'Reset the mission to attempt another pickup.' };
    const distance = Math.hypot(state.tool.x - state.die.x, state.tool.y - state.die.y);
    const heightError = Math.abs(state.tool.z - (state.die.z + SCENARIO.dieThickness));
    if (distance > SCENARIO.pickupRadius || heightError > SCENARIO.pickupHeightTolerance) {
      return { ...state, message: `Pickup failed: nozzle offset ${(distance * 1000).toFixed(0)} µm, height error ${(heightError * 1000).toFixed(0)} µm. Limits are ${SCENARIO.pickupRadius * 1000} µm and ${SCENARIO.pickupHeightTolerance * 1000} µm.` };
    }
    return { ...state, vacuum: true, phase: 'carrying', die: { ...state.die, attached: true }, message: 'Die secured. Retract, transfer to the target and align under the microscope.' };
  }
  if (!state.die.attached) return { ...state, vacuum: false };
  const die = { ...state.die, attached: false };
  const result = assess(die);
  return { ...state, vacuum: false, phase: 'placed', die, result, message: result.reason };
}
