import { describe, expect, it } from 'vitest'
import { detectControlGesture, initialAction, updateAction, type ControlGesture } from './controlGestures'
import type { Point } from './gestureClassifier'
import { applyCommand, initialState } from '../simulation/engine'

function makeHand(extended: boolean[], thumb: Point = {x: .2, y: .65}): Point[] {
  const p = Array.from({length:21},()=>({x:.5,y:.65}))
  p[0]={x:.5,y:.85}; p[2]={x:.32,y:.65}; p[4]=thumb
  const groups = [[5,6,8,.37],[9,10,12,.45],[13,14,16,.55],[17,18,20,.63]] as const
  groups.forEach(([base,pip,tip,x],i)=> { p[base]={x,y:.6}; p[pip]={x,y:.5}; p[tip]={x,y:extended[i] ? .3 : .58} })
  return p
}
describe('control hand poses',()=>{
  it('identifies distinct view and fine-mode gestures',()=>{
    expect(detectControlGesture(makeHand([true,true,false,false]))).toBe('camera')
    expect(detectControlGesture(makeHand([true,true,true,false]))).toBe('fine')
  })
  it('identifies a thumb-little touch and a vertical thumb',()=>{
    expect(detectControlGesture(makeHand([true,true,true,true],{x:.63,y:.3}))).toBe('vacuum')
    expect(detectControlGesture(makeHand([false,false,false,false],{x:.32,y:.35}))).toBe('raise')
    expect(detectControlGesture(makeHand([false,false,false,false],{x:.32,y:.95}))).toBe('lower')
  })
  it('switches view in pen mode without releasing thumb/index grip',()=>{
    const points=makeHand([false,true,true,false],{x:.37,y:.58})
    expect(detectControlGesture(points,1,'pen')).toBe('camera')
    expect(detectControlGesture(points,1,'pinch')).toBeNull()
    points[20]={x:.63,y:.3}; expect(detectControlGesture(points,1,'pen')).toBeNull()
  })
  it('identifies inspection and sideways index rotation',()=>{
    expect(detectControlGesture(makeHand([true,false,false,true]))).toBe('inspect')
    const right=makeHand([true,false,false,false]); right[8]={x:.18,y:.49}; expect(detectControlGesture(right)).toBe('rotate-right')
    const left=makeHand([true,false,false,false]); left[8]={x:.58,y:.49}; expect(detectControlGesture(left)).toBe('rotate-left')
  })
  it('does not treat a movement pinch or missing landmarks as an action',()=>{
    expect(detectControlGesture(makeHand([true,true,false,false],{x:.37,y:.3}))).toBe(null)
    expect(detectControlGesture(undefined)).toBe(null)
  })
})
function step(s: ReturnType<typeof initialAction>, pose: ControlGesture|null, t:number, tracked=true, pinched=false) { return updateAction(s,pose,t,tracked,pinched) }
describe('deliberate control gesture timing',()=>{
  it('requires neutral then a full hold, fires once, and requires neutral again',()=>{
    let r=step(initialAction(),'vacuum',0); r=step(r.state,'vacuum',2000); expect(r.action).toBeNull()
    r=step(r.state,null,2100); r=step(r.state,null,2400); r=step(r.state,'vacuum',2500)
    r=step(r.state,'vacuum',3899); expect(r.action).toBeNull()
    r=step(r.state,'vacuum',3900); expect(r.action).toBe('vacuum')
    r=step(r.state,'vacuum',6000); expect(r.action).toBeNull()
    r=step(r.state,'camera',6100); r=step(r.state,'camera',8000); expect(r.action).toBeNull()
    r=step(r.state,null,8100); r=step(r.state,null,8400); r=step(r.state,'camera',8500); r=step(r.state,'camera',9500); expect(r.action).toBe('camera')
  })
  it('uses a held vacuum action once, and tracking loss does not release the die',()=>{
    let sim=applyCommand(initialState(),{type:'move',dz:-2.5})
    let r=step(initialAction(),null,0); r=step(r.state,null,300); r=step(r.state,'vacuum',400); r=step(r.state,'vacuum',1800)
    if (r.action === 'vacuum') sim=applyCommand(sim,{type:'vacuum',on:!sim.vacuum})
    expect(sim.vacuum).toBe(true); expect(sim.die.attached).toBe(true)
    r=step(r.state,'vacuum',4000); expect(r.action).toBeNull()
    r=step(r.state,null,4100,false); expect(r.action).toBeNull(); expect(sim.vacuum).toBe(true); expect(sim.die.attached).toBe(true)
  })
  it('repeats height steps only while held and stops on loss or pinch',()=>{
    let r=step(initialAction(),null,0); r=step(r.state,null,300); r=step(r.state,'raise',400)
    r=step(r.state,'raise',1200); expect(r.action).toBe('raise')
    r=step(r.state,'raise',1649); expect(r.action).toBeNull()
    r=step(r.state,'raise',1650); expect(r.action).toBe('raise')
    r=step(r.state,'raise',1700,false); expect(r.action).toBeNull()
    r=step(r.state,'raise',3000); expect(r.action).toBeNull()
    r=step(r.state,'raise',4000,true,true); expect(r.state.armed).toBe(false)
  })
})
