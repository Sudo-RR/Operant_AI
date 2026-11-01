/** Hand-scale-normalised clutch classifier. A lost hand must open before it can re-arm. */
export type Point = { x: number; y: number }
export type GestureState = { armed: boolean; pinched: boolean; candidateSince: number | null; previous: Point | null; smooth: Point | null }
export const initialGesture = (): GestureState => ({ armed: false, pinched: false, candidateSince: null, previous: null, smooth: null })
export type GestureResult = { state: GestureState; tracked: boolean; pinched: boolean; dx: number; dy: number }
export function classifyGesture(state: GestureState, points: Point[] | undefined, now: number, sensitivity: number, fine: boolean, aspect = 1): GestureResult {
  const stop = (next: GestureState, tracked: boolean): GestureResult => ({ state: next, tracked, pinched: next.pinched, dx: 0, dy: 0 })
  if (!points || points.length < 18) return stop(initialGesture(), false)
  const [wrist, indexBase, pinkyBase, thumb, index] = [points[0], points[5], points[17], points[4], points[8]]
  const distance = (a: Point, b: Point) => Math.hypot((a.x-b.x)*aspect, a.y-b.y)
  const size = Math.max(0.001, distance(wrist,indexBase), distance(indexBase,pinkyBase))
  const ratio = distance(thumb,index) / size
  const open = ratio >= 0.55
  if (!state.armed) return stop(open ? { ...initialGesture(), armed: true } : initialGesture(), true)
  if (state.pinched && open) return stop({ ...initialGesture(), armed: true }, true)
  if (!state.pinched) {
    if (ratio > 0.35) return stop({ ...state, candidateSince: null }, true)
    const candidateSince = state.candidateSince ?? now
    if (now - candidateSince < 120) return stop({ ...state, candidateSince }, true)
    const point = { x: 1-(thumb.x+index.x)/2, y: (thumb.y+index.y)/2 }
    return stop({ armed: true, pinched: true, candidateSince: null, previous: point, smooth: point }, true)
  }
  const point = { x: 1-(thumb.x+index.x)/2, y: (thumb.y+index.y)/2 }
  const old = state.smooth ?? point
  const smooth = { x: old.x + (point.x-old.x)*0.35, y: old.y + (point.y-old.y)*0.35 }
  const previous = state.previous ?? smooth
  const scale = (fine ? 0.6 : 12) * sensitivity
  const rawX = (smooth.x-previous.x)*scale, rawY = (smooth.y-previous.y)*scale
  const deadZone = fine ? 0.001 : 0.006
  if (Math.hypot(rawX,rawY) < deadZone) return stop({ ...state, smooth }, true)
  const clamp = (value: number) => Math.max(-0.25, Math.min(0.25, value))
  return { state: { ...state, smooth, previous: smooth }, tracked: true, pinched: true, dx: clamp(rawX), dy: clamp(rawY) }
}
