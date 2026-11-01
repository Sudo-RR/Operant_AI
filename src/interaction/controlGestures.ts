import type { Point } from './gestureClassifier'

export type ControlGesture = 'vacuum' | 'camera'
export type ActionState = { armed: boolean; neutralSince: number | null; candidate: ControlGesture | null; since: number; fired: boolean; lastRepeat: number }
export const initialAction = (): ActionState => ({ armed: false, neutralSince: null, candidate: null, since: 0, fired: false, lastRepeat: 0 })
export const GESTURE_LABEL: Record<ControlGesture, string> = { vacuum: 'Vacuum toggle', camera: 'Switch view' }

/** Returns deliberate shapes only. Distances are normalized by palm size and video aspect. */
export function detectControlGesture(points: Point[] | undefined, aspect = 1): ControlGesture | null {
  const required = [0,4,5,6,8,9,10,12,13,14,16]
  if (!points || points.length < 17 || required.some(i => !points[i] || !Number.isFinite(points[i].x) || !Number.isFinite(points[i].y))) return null
  const d = (a: Point, b: Point) => Math.hypot((a.x-b.x)*aspect, a.y-b.y)
  const wrist = points[0], palm = Math.max(d(points[5], points[13]), d(wrist, points[9]))
  if (palm < 0.025) return null
  const extended = (tip: number, pip: number) => d(wrist, points[tip]) > d(wrist, points[pip]) + palm * 0.13
  const curled = (tip: number, pip: number) => d(wrist, points[tip]) < d(wrist, points[pip]) + palm * 0.03
  const index = extended(8,6), middle = extended(12,10)
  const ringBent = curled(16,14)
  const indexGap = d(points[4],points[8]) / palm
  // A V gesture is separate from the thumb/index movement clutch.
  if (indexGap < 0.55) return null
  if (index && middle && ringBent) return 'camera'
  return null
}

/** One-shot actions require a new neutral pose before another activation. */
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
  const duration = pose === 'vacuum' ? 1400 : 1000
  const progress = Math.min(1, Math.max(0,(now-state.since)/duration))
  if (!state.fired && progress >= 1) return { state: { ...state, fired: true, lastRepeat: now }, action: pose, progress: 1 }
  return { state, action: null, progress }
}
