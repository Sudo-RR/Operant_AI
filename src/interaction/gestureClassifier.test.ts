import { describe, expect, it } from 'vitest'
import { classifyGesture, initialGesture, type Point } from './gestureClassifier'
import { applyCommand, initialState } from '../simulation/engine'
function hand(ratio: number, x = 0): Point[] {
  const p = Array.from({length: 21}, () => ({x: 0.5+x, y: 0.5}))
  p[0] = {x: 0.5+x,y: 0.7}; p[5] = {x: 0.5+x,y: 0.5}; p[17] = {x: 0.7+x,y: 0.5}
  p[4] = {x: 0.5+x,y: 0.4}; p[8] = {x: 0.5+x+ratio*0.2,y: 0.4}
  return p
}
const step = (s: ReturnType<typeof initialGesture>, ratio: number, t: number, x = 0) => classifyGesture(s,hand(ratio,x),t,1,false)
describe('hand gesture clutch', () => {
  it('requires an open hand and stable pinch before movement', () => {
    let s=initialGesture(); let r=step(s,0.2,0); expect(r.pinched).toBe(false)
    r=step(r.state,0.6,1); r=step(r.state,0.2,10); r=step(r.state,0.2,129); expect(r.pinched).toBe(false)
    r=step(r.state,0.2,130); expect(r.pinched).toBe(true); expect(r.dx).toBe(0)
    r=step(r.state,0.2,180,0.1); expect(r.dx).toBeLessThan(0)
  })
  it('uses hysteresis and stops on release without issuing movement', () => {
    let r=step(initialGesture(),0.6,0); r=step(r.state,0.2,10); r=step(r.state,0.2,130)
    r=step(r.state,0.45,160); expect(r.pinched).toBe(true)
    r=step(r.state,0.56,200); expect(r.pinched).toBe(false); expect(r.dx).toBe(0)
  })
  it('requires an open hand after tracking is lost', () => {
    let r=step(initialGesture(),0.6,0); r=step(r.state,0.2,10); r=step(r.state,0.2,130)
    r=classifyGesture(r.state,undefined,140,1,false); expect(r.tracked).toBe(false)
    r=step(r.state,0.2,300); r=step(r.state,0.2,500,0.1); expect(r.pinched).toBe(false); expect(r.dx).toBe(0)
    r=step(r.state,0.6,510); r=step(r.state,0.2,520); r=step(r.state,0.2,640); expect(r.pinched).toBe(true)
  })
  it('scales fine movement and never toggles vacuum on pinch release', () => {
    let sim=applyCommand(initialState(), {type:'move', dz:-2.5})
    sim=applyCommand(sim, {type:'vacuum', on:true})
    let r=step(initialGesture(),0.6,0); r=step(r.state,0.2,10); r=step(r.state,0.2,130)
    const fine=classifyGesture(r.state,hand(0.2,0.05),180,1,true)
    const coarse=classifyGesture(r.state,hand(0.2,0.05),180,1,false)
    expect(Math.abs(fine.dx)).toBeLessThan(Math.abs(coarse.dx))
    sim=applyCommand(sim,{type:'move',dx:coarse.dx,dy:coarse.dy})
    const released=classifyGesture(coarse.state,hand(0.6),220,1,false)
    expect(released.dx).toBe(0); expect(released.pinched).toBe(false)
    expect(sim.vacuum).toBe(true); expect(sim.die.attached).toBe(true)
  })
  it('uses a raised little finger as a clutch while thumb and index keep holding a pen', () => {
    const penHand = (raised: boolean, x=0) => { const p=hand(0.2,x); p[18]={x:.7+x,y:.55}; p[20]=raised ? {x:.7+x,y:.3} : {x:.7+x,y:.55}; return p }
    let r=classifyGesture(initialGesture(),penHand(false),0,1,false,1,'pen')
    expect(r.state.armed).toBe(true)
    r=classifyGesture(r.state,penHand(true),10,1,false,1,'pen'); r=classifyGesture(r.state,penHand(true),130,1,false,1,'pen'); expect(r.pinched).toBe(true)
    r=classifyGesture(r.state,penHand(true,.1),180,1,false,1,'pen'); expect(r.dx).not.toBe(0)
    r=classifyGesture(r.state,penHand(false,.1),200,1,false,1,'pen'); expect(r.pinched).toBe(false); expect(r.dx).toBe(0)
    r=classifyGesture(r.state,undefined,220,1,false,1,'pen'); r=classifyGesture(r.state,penHand(true,.2),400,1,false,1,'pen'); expect(r.pinched).toBe(false); expect(r.dx).toBe(0)
  })
  it('normalizes pinch distance for hand size', () => {
    const points=hand(0.2); const scaled=points.map(p=>({x:p.x*0.5,y:p.y*0.5}))
    let a=step(initialGesture(),0.6,0); let b=classifyGesture(initialGesture(),hand(0.6).map(p=>({x:p.x*0.5,y:p.y*0.5})),0,1,false)
    a=classifyGesture(a.state,points,10,1,false); b=classifyGesture(b.state,scaled,10,1,false)
    a=classifyGesture(a.state,points,130,1,false); b=classifyGesture(b.state,scaled,130,1,false)
    expect(a.pinched).toBe(true); expect(b.pinched).toBe(true)
  })
})
