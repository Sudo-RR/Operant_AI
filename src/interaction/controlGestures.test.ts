import { describe, expect, it } from 'vitest'
import { detectControlGesture, initialAction, updateAction, type ControlGesture } from './controlGestures'
import type { Point } from './gestureClassifier'
import { applyCommand, initialState } from '../simulation/engine'

function hand(indexExtended: boolean, middleExtended: boolean, ringExtended: boolean, thumb: Point = {x:.2,y:.65}): Point[] {
  const p = Array.from({length:21},()=>({x:.5,y:.65}))
  p[0]={x:.5,y:.85}; p[4]=thumb
  const groups = [[5,6,8,.37],[9,10,12,.45],[13,14,16,.55]] as const
  const ext = [indexExtended,middleExtended,ringExtended]
  groups.forEach(([base,pip,tip,x],i)=> { p[base]={x,y:.6}; p[pip]={x,y:.5}; p[tip]={x,y:ext[i] ? .3 : .58} })
  return p
}

describe('view and vacuum pose recognition',()=>{
  it('recognizes a V and ignores the unused fourth finger',()=>{
    const p=hand(true,true,false)
    expect(detectControlGesture(p)).toBe('camera')
    for (let i=17;i<=20;i++) p[i]={x:NaN,y:NaN}
    expect(detectControlGesture(p)).toBe('camera')
  })
  it('does not recognize a movement pinch, an open palm or lost hand as a V',()=>{
    expect(detectControlGesture(hand(true,true,false,{x:.37,y:.3}))).toBeNull()
    expect(detectControlGesture(hand(true,true,true))).toBeNull()
    expect(detectControlGesture(undefined)).toBeNull()
  })
})
function step(s: ReturnType<typeof initialAction>, pose: ControlGesture|null, t:number, tracked=true, pinched=false) { return updateAction(s,pose,t,tracked,pinched) }
describe('deliberate gesture timing',()=>{
  it('requires neutral then a full hold, fires once, and requires neutral again',()=>{
    let r=step(initialAction(),'vacuum',0); r=step(r.state,'vacuum',2000); expect(r.action).toBeNull()
    r=step(r.state,null,2100); r=step(r.state,null,2400); r=step(r.state,'vacuum',2500)
    r=step(r.state,'vacuum',3899); expect(r.action).toBeNull()
    r=step(r.state,'vacuum',3900); expect(r.action).toBe('vacuum')
    r=step(r.state,'vacuum',6000); expect(r.action).toBeNull()
    r=step(r.state,'camera',6100); r=step(r.state,'camera',8000); expect(r.action).toBeNull()
    r=step(r.state,null,8100); r=step(r.state,null,8400); r=step(r.state,'camera',8500); r=step(r.state,'camera',9500); expect(r.action).toBe('camera')
  })
  it('does not release vacuum on tracking loss or a height pinch',()=>{
    let sim=applyCommand(initialState(),{type:'move',dz:-2.5})
    let r=step(initialAction(),null,0); r=step(r.state,null,300); r=step(r.state,'vacuum',400); r=step(r.state,'vacuum',1800)
    if (r.action === 'vacuum') sim=applyCommand(sim,{type:'vacuum',on:!sim.vacuum})
    expect(sim.vacuum).toBe(true); expect(sim.die.attached).toBe(true)
    r=step(r.state,null,1900,false); expect(r.action).toBeNull()
    r=step(r.state,'vacuum',3000,true,true); expect(r.action).toBeNull()
    expect(sim.vacuum).toBe(true); expect(sim.die.attached).toBe(true)
  })
})
