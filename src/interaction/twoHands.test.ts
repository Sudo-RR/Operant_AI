import { describe, expect, it } from 'vitest'
import { assignHandRoles, guardHandRoles, heightDelta, type HandCandidate } from './twoHands'
import { classifyGesture, initialGesture, type Point } from './gestureClassifier'
import { applyCommand, initialState } from '../simulation/engine'

const hand = (label: string, confidence = 0.99): HandCandidate => ({ landmarks: [], label, confidence })
const points = (ratio: number, y = 0): Point[] => {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5+y }))
  p[0] = {x:0.5,y:0.7+y}; p[5] = {x:0.5,y:0.5+y}; p[17] = {x:0.7,y:0.5+y}
  p[4] = {x:0.5,y:0.4+y}; p[8] = {x:0.5+ratio*0.2,y:0.4+y}
  return p
}

describe('two-hand roles', () => {
  it('assigns physical right and left independent of detection order, and can swap roles', () => {
    const physicalRight = hand('Right'), physicalLeft = hand('Left')
    expect(assignHandRoles([physicalLeft, physicalRight], 'Right')).toMatchObject({xy:physicalRight,height:physicalLeft})
    expect(assignHandRoles([physicalRight, physicalLeft], 'Left')).toMatchObject({xy:physicalLeft,height:physicalRight})
  })
  it('fails closed for ambiguous labels and ignores low-confidence labels', () => {
    expect(assignHandRoles([hand('Left'),hand('Left')], 'Right')).toEqual({ambiguous:true})
    expect(assignHandRoles([hand('Right',0.4)], 'Right')).toEqual({ambiguous:false})
  })
  it('disarms on swapped or suddenly jumping role identities', () => {
    const xy = { ...hand('Right'), landmarks: [{x:.2,y:.4}] }
    const height = { ...hand('Left'), landmarks: [{x:.8,y:.4}] }
    const previous = {xy:{x:.2,y:.4},height:{x:.8,y:.4}}
    expect(guardHandRoles({xy:height,height:xy,ambiguous:false},previous).roles).toEqual({ambiguous:true})
    expect(guardHandRoles({xy:{...xy,landmarks:[{x:.6,y:.4}]},height,ambiguous:false},previous).roles.xy).toBeUndefined()
    expect(guardHandRoles({xy,height,ambiguous:false},previous).roles.xy).toBe(xy)
  })
  it('requires a fresh pinch after loss and maps upward movement to positive height', () => {
    let r = classifyGesture(initialGesture(),points(.6),0,1,false)
    r = classifyGesture(r.state,points(.2),10,1,false)
    r = classifyGesture(r.state,points(.2),130,1,false)
    r = classifyGesture(r.state,points(.2,-.08),180,1,false)
    expect(heightDelta(r)).toBeGreaterThan(0)
    r = classifyGesture(r.state,undefined,200,1,false)
    expect(heightDelta(r)).toBe(0)
    r = classifyGesture(r.state,points(.2,-.15),400,1,false)
    expect(heightDelta(r)).toBe(0)
  })
  it('leaves vacuum and the attached die intact when the height hand is lost', () => {
    let sim = applyCommand(initialState(), {type:'move', dz:-2.5})
    sim = applyCommand(sim, {type:'vacuum', on:true})
    let r = classifyGesture(initialGesture(),points(.6),0,1,false)
    r = classifyGesture(r.state,points(.2),10,1,false)
    r = classifyGesture(r.state,points(.2),130,1,false)
    r = classifyGesture(r.state,points(.2,-.08),180,1,false)
    sim = applyCommand(sim, {type:'move', dz:heightDelta(r)})
    r = classifyGesture(r.state,undefined,200,1,false)
    expect(heightDelta(r)).toBe(0)
    expect(sim.vacuum).toBe(true)
    expect(sim.die.attached).toBe(true)
  })
})
