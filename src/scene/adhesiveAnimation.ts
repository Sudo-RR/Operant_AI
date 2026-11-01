/** Timing and poses are an illustrative animation, not an adhesive-flow model. */
export const DISPENSE_DEMO_SECONDS = 5.2
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp01(value); return t*t*(3-2*t) }

export function sampleDispense(seconds: number) {
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const approach = smooth(t / 1.3)
  const dispensing = clamp01((t - 1.3) / 2.1)
  const withdrawal = smooth((t - 3.4) / 1.8)
  const needleHeight = 4.3 - 3.1 * approach + 3.1 * withdrawal
  return {
    needleHeight,
    depositScale: dispensing,
    dropletHeight: dispensing > 0 && dispensing < 1 ? 1.12 - 0.65 * dispensing : null,
    phase: t < 1.3 ? 'approach' : t < 3.4 ? 'dispense' : t < DISPENSE_DEMO_SECONDS ? 'retract' : 'complete',
  } as const
}
