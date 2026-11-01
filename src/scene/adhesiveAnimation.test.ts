import { describe, expect, it } from 'vitest'
import { DISPENSE_DEMO_SECONDS, sampleDispense } from './adhesiveAnimation'

describe('illustrative dispensing sequence', () => {
  it('approaches, deposits and retracts with a finished deposit', () => {
    const initial = sampleDispense(0)
    const dispensing = sampleDispense(2.35)
    const final = sampleDispense(DISPENSE_DEMO_SECONDS)
    expect(initial.phase).toBe('approach')
    expect(initial.depositScale).toBe(0)
    expect(dispensing.phase).toBe('dispense')
    expect(dispensing.depositScale).toBeCloseTo(0.5)
    expect(dispensing.dropletHeight).not.toBeNull()
    expect(final.phase).toBe('complete')
    expect(final.depositScale).toBe(1)
    expect(final.needleHeight).toBeCloseTo(initial.needleHeight)
    expect(final.dropletHeight).toBeNull()
  })
})
