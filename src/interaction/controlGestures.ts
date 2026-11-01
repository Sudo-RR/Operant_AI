import type { ClutchMode, Point } from './gestureClassifier'

export type ControlGesture = 'vacuum' | 'camera' | 'fine' | 'raise' | 'lower' | 'rotate-left' | 'rotate-right' | 'inspect'
export type ActionState = { armed: boolean; neutralSince: number | null; candidate: ControlGesture | null; since: number; fired: boolean; lastRepeat: number }
export const initialAction = (): ActionState => ({ armed: false, neutralSince: null, candidate: null, since: 0, fired: false, lastRepeat: 0 })
export const GESTURE_LABEL: Record<ControlGesture, string> = { vacuum: 'Vacuum toggle', camera: 'Switch view', fine: 'Fine / coarse', raise: 'Raise tool', lower: 'Lower tool', 'rotate-left': 'Rotate left', 'rotate-right': 'Rotate right', inspect: 'Inspect placement' }

/** Returns deliberate shapes only. Distances are normalized by palm size and video aspect. */
export function detectControlGesture(points: Point[] | undefined, aspect = 1, mode: ClutchMode = 'pinch'): ControlGesture | null {
  if (!points || points.length < 21 || Array.from(points).some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null
  const d = (a: Point, b: Point) => Math.hypot((a.x-b.x)*aspect, a.y-b.y)
  const wrist = points[0], palm = Math.max(d(points[5], points[17]), d(wrist, points[9]))
  if (palm < 0.025) return null
  const extended = (tip: number, pip: number) => d(wrist, points[tip]) > d(wrist, points[pip]) + palm * 0.13
  const curled = (tip: number, pip: number) => d(wrist, points[tip]) < d(wrist, points[pip]) + palm * 0.03
  const index = extended(8,6), middle = extended(12,10), ring = extended(16,14), little = extended(20,18)
  const indexBent = curled(8,6), middleBent = curled(12,10), ringBent = curled(16,14), littleBent = curled(20,18)
  const indexGap = d(points[4],points[8]) / palm
  // These shapes are distinct from the thumb/index pinch used to move the tool.
  // In pen mode keep the pen in the thumb/index grip and lift middle + ring to switch views.
  if (mode === 'pen' && indexGap < 0.55 && middle && ring && littleBent) return 'camera'
  if (indexGap < 0.55) return null
  if (index && middle && ring && d(points[4],points[20]) / palm < 0.30) return 'vacuum'
  if (index && middleBent && ringBent && little) return 'inspect'
  const indexPointing = d(points[5], points[8]) > d(points[5], points[6]) + palm * 0.13
  if (indexPointing && middleBent && ringBent && littleBent) {
    const horizontal = -(points[8].x-points[6].x)*aspect/palm
    if (horizontal > 0.55) return 'rotate-right'
    if (horizontal < -0.55) return 'rotate-left'
  }
  if (index && middle && ringBent && littleBent) return 'camera'
  if (index && middle && ring && littleBent) return 'fine'
  if (indexBent && middleBent && ringBent && littleBent && d(points[4],points[2]) > palm * 0.55) {
    const vertical = (points[2].y-points[4].y) / palm
    if (vertical > 0.65) return 'raise'
    if (vertical < -0.65) return 'lower'
  }
  return null
}

/** One-shot actions require a new neutral pose; Z repeats only while its pose remains held. */
export function updateAction(state: ActionState, pose: ControlGesture | null, now: number, tracked: boolean, pinched: boolean): { state: ActionState; action: ControlGesture | null; progress: number } {
  if (!tracked || pinched) return { state: initialAction(), action: null, progress: 0 }
  if (pose === null) {
    const neutralSince = state.neutralSince ?? now
    const wasAwaitingNeutral = state.candidate !== null || !state.armed
    return { state: { ...initialAction(), armed: wasAwaitingNeutral ? now-neutralSince >= 300 : state.armed, neutralSince }, action: null, progress: 0 }
  }
  if (!state.armed) return { state: { ...initialAction() }, action: null, progress: 0 }
  if (pose !== state.candidate) {
    if (state.fired) return { state: initialAction(), action: null, progress: 0 }
    return { state: { ...state, neutralSince: null, candidate: pose, since: now, fired: false, lastRepeat: 0 }, action: null, progress: 0 }
  }
  const duration = pose === 'vacuum' ? 1400 : pose === 'camera' || pose === 'fine' || pose === 'inspect' ? 1000 : 800
  const progress = Math.min(1, Math.max(0,(now-state.since)/duration))
  if (!state.fired && progress >= 1) return { state: { ...state, fired: true, lastRepeat: now }, action: pose, progress: 1 }
  if ((pose === 'raise' || pose === 'lower' || pose === 'rotate-left' || pose === 'rotate-right') && state.fired && now-state.lastRepeat >= 450) return { state: { ...state, lastRepeat: now }, action: pose, progress: 1 }
  return { state, action: null, progress }
}
