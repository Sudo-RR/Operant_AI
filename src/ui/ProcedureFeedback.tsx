import { useEffect, useRef, useState } from 'react'
import type { SimulationState } from '../simulation/engine'

/** Brief visual acknowledgements; they never change or predict the simulation state. */
export function ProcedureFeedback({ state }: { state: SimulationState }) {
  const previous = useRef(state.phase)
  const [event, setEvent] = useState<{ text: string; kind: string } | null>(null)
  useEffect(() => {
    const before = previous.current
    previous.current = state.phase
    if (before === 'ready' && state.phase === 'carrying') setEvent({ text: 'DIE SECURED · RETRACT THE TOOL', kind: 'secured' })
    else if (before === 'carrying' && state.phase === 'placed' && state.result) setEvent({ text: state.result.passed ? 'RELEASED · PLACEMENT PASSED' : 'RELEASED · PLACEMENT FAILED', kind: state.result.passed ? 'pass' : 'fail' })
    else { setEvent(null); return }
    const timeout = window.setTimeout(() => setEvent(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [state.phase, state.result])
  return event ? <div role="status" className={'procedure-feedback ' + event.kind}>{event.text}</div> : null
}
