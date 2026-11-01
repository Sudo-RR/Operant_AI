import type { Point, GestureResult } from './gestureClassifier'

export type HandSide = 'Left' | 'Right'
export type HandCandidate = { landmarks: Point[]; label?: string; confidence?: number }
export type HandRoles = { xy?: HandCandidate; height?: HandCandidate; ambiguous: boolean }
export type RoleAnchors = { xy?: Point; height?: Point }

/** Tasks Vision labels the subject's hands for our unmirrored input; only the preview is mirrored. */
export function assignHandRoles(candidates: HandCandidate[], xySide: HandSide): HandRoles {
  const roles: HandRoles = { ambiguous: false }
  for (const candidate of candidates) {
    if ((candidate.confidence ?? 0) < 0.65 || (candidate.label !== 'Left' && candidate.label !== 'Right')) continue
    const physicalSide: HandSide = candidate.label
    const role = physicalSide === xySide ? 'xy' : 'height'
    // Never guess between two detections claiming the same role.
    if (roles[role]) return { ambiguous: true }
    roles[role] = candidate
  }
  return roles
}

/** Reset the affected clutch if identities jump or the two labels appear to swap. */
export function guardHandRoles(roles: HandRoles, previous: RoleAnchors): { roles: HandRoles; anchors: RoleAnchors } {
  if (roles.ambiguous) return { roles: { ambiguous: true }, anchors: {} }
  const xy = roles.xy?.landmarks[0], height = roles.height?.landmarks[0]
  const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x, a.y-b.y)
  if (xy && height && previous.xy && previous.height) {
    const same = distance(xy, previous.xy) + distance(height, previous.height)
    const swapped = distance(xy, previous.height) + distance(height, previous.xy)
    if (swapped + 0.08 < same) return { roles: { ambiguous: true }, anchors: {} }
  }
  const safeXY = xy && (!previous.xy || distance(xy, previous.xy) <= 0.25) ? roles.xy : undefined
  const safeHeight = height && (!previous.height || distance(height, previous.height) <= 0.25) ? roles.height : undefined
  return { roles: { xy: safeXY, height: safeHeight, ambiguous: false }, anchors: { xy: safeXY?.landmarks[0], height: safeHeight?.landmarks[0] } }
}

/** A raised depth hand moves the simulated nozzle upward; bounds remain in the engine. */
export function heightDelta(result: GestureResult): number {
  if (!result.tracked || !result.pinched) return 0
  return Math.max(-0.075, Math.min(0.075, -result.dy * 0.3))
}
