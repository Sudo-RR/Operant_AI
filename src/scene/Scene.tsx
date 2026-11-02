import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, Line, OrbitControls, OrthographicCamera, PerspectiveCamera, RoundedBox, useGLTF, useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { BackSide, CanvasTexture, CatmullRomCurve3, Euler, Group, MathUtils, Mesh, MeshBasicMaterial, OrthographicCamera as ThreeOrthographicCamera, RepeatWrapping, SRGBColorSpace, Vector2, Vector3 } from 'three'
import type { SimulationState } from '../simulation/engine'
import { SCENARIO } from '../simulation/engine'
import { sampleDispense } from './adhesiveAnimation'

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`

export type CameraMode = 'workstation' | 'microscope'
export type TechnicianPosture = 'seated' | 'leaning'

type SceneProps = { state: SimulationState; camera: CameraMode; posture: TechnicianPosture; viewAngle: number; inspectionAngle: 'top' | 'oblique'; magnification: number; illumination: number; adhesivePlaying: boolean; adhesiveCycle: number }

function CameraRig({ mode, posture, viewAngle, inspectionAngle, magnification, focusX, focusHeight, adhesivePlaying }: { mode: CameraMode; posture: TechnicianPosture; viewAngle: number; inspectionAngle: 'top' | 'oblique'; magnification: number; focusX: number; focusHeight: number; adhesivePlaying: boolean }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (mode === 'microscope') {
      camera.position.set(focusX, focusHeight + (inspectionAngle === 'top' ? 18 : 14), inspectionAngle === 'top' ? 0.001 : 11)
      camera.up.set(0, inspectionAngle === 'top' ? 0 : 1, inspectionAngle === 'top' ? -1 : 0)
      camera.lookAt(focusX, focusHeight, 0)
      if (camera instanceof ThreeOrthographicCamera) camera.zoom = Math.min(size.width, size.height) / 7 * magnification
    } else {
      const distance = adhesivePlaying ? 12 : posture === 'seated' ? 17 : 9
      const angle = adhesivePlaying ? 0 : viewAngle
      camera.position.set((adhesivePlaying ? SCENARIO.target.x : 0) + Math.sin(angle) * distance, adhesivePlaying ? 10.5 : posture === 'seated' ? 14.5 : 16, Math.cos(angle) * distance)
      camera.up.set(0, 1, 0)
      camera.lookAt(adhesivePlaying ? SCENARIO.target.x : 0, adhesivePlaying ? SCENARIO.surfaceZ : 0, 0)
      if (camera instanceof ThreeOrthographicCamera) camera.zoom = Math.min(size.width, size.height) / 23
    }
    if (camera instanceof ThreeOrthographicCamera) camera.updateProjectionMatrix()
  }, [camera, mode, posture, viewAngle, inspectionAngle, size, magnification, focusX, focusHeight, adhesivePlaying])
  return null
}

const steel = '#89939a'
const darkSteel = '#414b50'
const ceramic = '#d2d0c5'
const instrumentCable = new CatmullRomCurve3([
  new Vector3(10.8,-1.75,-5.4), new Vector3(9.5,-1.74,-7),
  new Vector3(5,-1.74,-7.6), new Vector3(3,-1.74,-6.5),
])

function Box({ position, size, color, metalness = 0, roughness = 0.5 }: { position: [number, number, number]; size: [number, number, number]; color: string; metalness?: number; roughness?: number }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
  </mesh>
}

function LabBackdrop() {
  const texture = useTexture(asset('lab-panorama.png'))
  texture.colorSpace = SRGBColorSpace
  return <mesh><sphereGeometry args={[70,64,32]}/><meshBasicMaterial map={texture} side={BackSide} toneMapped={false}/></mesh>
}

/** Brushed stainless maps from ambientCG Metal012, CC0. */
function BrushedPlate() {
  const maps = useTexture({
    map: asset('metal012/Metal012_1K-JPG_Color.jpg'),
    normalMap: asset('metal012/Metal012_1K-JPG_NormalGL.jpg'),
    roughnessMap: asset('metal012/Metal012_1K-JPG_Roughness.jpg'),
  })
  useMemo(() => {
    maps.map.colorSpace = SRGBColorSpace
    for (const texture of Object.values(maps)) {
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.repeat.set(3, 2)
      texture.needsUpdate = true
    }
  }, [maps])
  return <mesh position={[0,-0.25,0]} receiveShadow castShadow><boxGeometry args={[19.8,0.2,13]}/><meshStandardMaterial {...maps} metalness={0.72} roughness={0.55} normalScale={new Vector2(0.22,0.22)} color="#a5b4b2"/></mesh>
}

function Screw({ x, z, y = 0.4 }: { x: number; z: number; y?: number }) {
  return <group position={[x, y, z]}>
    <mesh castShadow><cylinderGeometry args={[0.22, 0.22, 0.1, 24]} /><meshStandardMaterial color="#565e61" metalness={0.8} roughness={0.3} /></mesh>
    <Box position={[0, 0.06, 0]} size={[0.22, 0.02, 0.035]} color="#252d30" />
  </group>
}

/** Workbench and instrumentation are visual context; the simulation owns all procedure decisions. */
function InstrumentDisplay({ state }: { state: SimulationState }) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 192
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return { canvas, texture }
  }, [])
  useEffect(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#1d3030'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#bad8cc'; ctx.font = '24px monospace'; ctx.fillText('PLACEMENT STATION', 22, 40)
    ctx.fillStyle = '#e2eee8'; ctx.font = '34px monospace'; ctx.fillText(`Z ${state.tool.z.toFixed(2)} mm`, 22, 98)
    ctx.fillStyle = state.vacuum ? '#a8d6b2' : '#a4b6af'; ctx.font = '25px monospace'; ctx.fillText(`VACUUM ${state.vacuum ? 'ON' : 'OFF'}`, 22, 151)
    texture.needsUpdate = true
  }, [canvas, texture, state.tool.z, state.vacuum])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={[12.45,-0.32,-3.405]}><planeGeometry args={[1.55,0.54]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}

function EquipmentLabel({ title, subtitle, position, width = 3 }: { title: string; subtitle: string; position: [number, number, number]; width?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 768; canvas.height = 192
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#142d3d'; ctx.fillRect(0, 0, 768, 192)
    ctx.fillStyle = '#59b9d1'; ctx.fillRect(0, 0, 12, 192)
    ctx.fillStyle = '#dcecf1'; ctx.font = '600 48px sans-serif'; ctx.fillText(title, 38, 75)
    ctx.fillStyle = '#89b4c0'; ctx.font = '28px monospace'; ctx.fillText(subtitle, 38, 130)
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    return result
  }, [title, subtitle])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={position}><planeGeometry args={[width, width / 4]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}

/** Decorative bench instruments, visually separate from the simulated manipulator. */
function CoolingFan() {
  const rotor = useRef<Group>(null)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  useFrame((_, delta) => { if (rotor.current && !reducedMotion.matches) rotor.current.rotation.z -= Math.min(delta, 0.05) * 0.55 })
  return <group position={[13.55,-0.48,-6.65]}>
    <mesh><circleGeometry args={[0.44,32]}/><meshStandardMaterial color="#263b42" metalness={0.35} roughness={0.55}/></mesh>
    <group ref={rotor} position={[0,0,0.01]}>{[0,1,2,3].map(i=><group key={i} rotation={[0,0,i*Math.PI/2]}><mesh position={[0.16,0.04,0]} rotation={[0,0,0.45]}><planeGeometry args={[0.32,0.1]}/><meshStandardMaterial color="#93a5a4" metalness={0.45} roughness={0.5}/></mesh></group>)}</group>
    <mesh position={[0,0,0.02]}><ringGeometry args={[0.31,0.34,32]}/><meshStandardMaterial color="#a2afab" metalness={0.65} roughness={0.4}/></mesh>
  </group>
}

function BenchDetails({ state }: { state: SimulationState }) {
  return <group>
    {/* Blue antistatic work surface and its restrained safety edge. */}
    <Box position={[0,-1.824,0]} size={[31,0.035,21]} color="#3f7788" roughness={0.9}/>
    <Box position={[0,-1.802,9.95]} size={[30.6,0.012,0.06]} color="#a2d4d7" roughness={0.65}/>
    {/* Rear instrument rail and sockets. */}
    <Box position={[0,0.25,-10.9]} size={[32,2.15,1.1]} color="#d8dfdc" metalness={0.18} roughness={0.5}/>
    <Box position={[0,0.2,-10.32]} size={[31.4,1.5,0.08]} color="#526a76" metalness={0.45} roughness={0.5}/>
    <mesh position={[0,1.3,-10.28]}><boxGeometry args={[29,0.09,0.1]}/><meshStandardMaterial color="#e4f3f0" emissive="#b6e6e1" emissiveIntensity={0.65}/></mesh>
    {[-12,-7,-2,3,8,13].map(x => <group key={x} position={[x,0.25,-10.24]}>
      <Box position={[0,0,0]} size={[1.35,0.9,0.08]} color="#d6e0dd" roughness={0.65}/>
      {[-0.32,0.32].map(v => <mesh key={v} position={[v,0,0.055]}><circleGeometry args={[0.12,20]}/><meshStandardMaterial color="#4c6067" roughness={0.6}/></mesh>)}
    </group>)}
    {/* ESD storage drawers on the left. */}
    <RoundedBox args={[4.3,2.45,3]} radius={0.16} smoothness={4} position={[-13, -0.56,-7.9]} castShadow receiveShadow><meshStandardMaterial color="#dae5e2" metalness={0.15} roughness={0.42}/></RoundedBox>
    {[0,1,2].map(i => <group key={i} position={[-13,-1.3+i*0.73,-6.35]}>
      <Box position={[0,0,0]} size={[3.9,0.57,0.08]} color={i === 1 ? '#8bbac3' : '#a9cbd0'} roughness={0.38}/>
      <Box position={[0,0,0.07]} size={[1.2,0.1,0.08]} color="#526b72" metalness={0.5} roughness={0.4}/>
    </group>)}
    {/* A compact power and vacuum module: screen, lamps, bezel, and ventilation slots. */}
    <RoundedBox args={[5.2,2.75,3]} radius={0.18} smoothness={4} position={[12,-0.4,-8.3]} castShadow receiveShadow><meshStandardMaterial color="#d3ddda" metalness={0.2} roughness={0.44}/></RoundedBox>
    <Box position={[12,-0.35,-6.76]} size={[4.65,2.05,0.08]} color="#263e4d" metalness={0.4} roughness={0.4}/>
    <EquipmentLabel title="VACUUM CONTROL" subtitle={state.vacuum ? 'VACUUM  /  ON' : 'VACUUM  /  OFF'} position={[11.55,0.1,-6.7]} width={2.5}/>
    {[state.vacuum ? '#67dfb7' : '#405956', state.result?.passed ? '#a4e5b1' : '#405956', (state.result && !state.result.passed) || state.message.startsWith('Pickup failed') ? '#efad70' : '#554c42'].map((color,i)=><mesh key={i} position={[13.25+i*0.33,0.45,-6.68]}><circleGeometry args={[0.105,20]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55}/></mesh>)}
    {[0,1,2,3].map(i=><Box key={i} position={[11.45,-0.82+i*0.12,-6.68]} size={[2.25,0.035,0.02]} color="#718d94" metalness={0.45}/>)}
    <CoolingFan />
    {/* A capped sample vial and a covered parts tray add scale and color. */}
    <group position={[-13,-1.72,3.5]}><mesh position={[0,0.52,0]} castShadow><cylinderGeometry args={[0.35,0.35,1,32]}/><meshPhysicalMaterial color="#d8eff0" transparent opacity={0.65} roughness={0.14} metalness={0.05}/></mesh><mesh position={[0,1.04,0]}><cylinderGeometry args={[0.38,0.38,0.16,32]}/><meshStandardMaterial color="#4289a0" roughness={0.42}/></mesh><mesh position={[0,0.48,0]}><cylinderGeometry args={[0.355,0.355,0.34,32]}/><meshStandardMaterial color="#f2eee0" roughness={0.75}/></mesh></group>
    <RoundedBox args={[3.2,0.25,2.2]} radius={0.12} smoothness={3} position={[13,-1.67,2.8]} castShadow><meshStandardMaterial color="#bdcfd0" metalness={0.35} roughness={0.36}/></RoundedBox>
    {[-0.8,0,0.8].map(x=><mesh key={x} position={[13+x,-1.52,2.8]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.27,0.36,32]}/><meshStandardMaterial color="#596f75" metalness={0.65} roughness={0.32}/></mesh>)}
  </group>
}

function Laboratory({ state }: { state: SimulationState }) {
  return <group>
    <Box position={[0,-2.2,0]} size={[38,0.7,27]} color="#c8d2cf" metalness={0.22} roughness={0.5}/>
    <Box position={[0,-2.6,0]} size={[38,0.15,27]} color="#607680" metalness={0.6} roughness={0.45}/>
    <Suspense fallback={<mesh><sphereGeometry args={[70,32,16]}/><meshBasicMaterial color="#b9c6c5" side={BackSide}/></mesh>}><LabBackdrop /></Suspense>
    <BenchDetails state={state} /><Suspense fallback={null}><BenchMicroscope /></Suspense>
    {/* Compact controller, with modeled switches and knobs. Values remain in the UI. */}
    <Box position={[13,-0.6,-5.2]} size={[4.1,2.15,3.2]} color="#556163" metalness={0.65} roughness={0.46}/>
    <Box position={[13,-0.6,-3.56]} size={[3.8,1.85,0.12]} color="#303b3c" metalness={0.55} roughness={0.45}/>
    <Box position={[12.45,-0.32,-3.48]} size={[1.65,0.57,0.04]} color="#4a5c57" metalness={0.2} roughness={0.65}/>
    <InstrumentDisplay state={state}/>
    {[12.1,12.65,13.2].map(x => <Box key={x} position={[x,-1.05,-3.46]} size={[0.36,0.19,0.08]} color="#8f9a93" metalness={0.5} roughness={0.4}/>)}
    <group position={[14.15,-0.47,-3.44]} rotation={[Math.PI/2,0,0]}><mesh castShadow><cylinderGeometry args={[0.42,0.42,0.16,40]}/><meshStandardMaterial color="#a1aaa5" metalness={0.8} roughness={0.3}/></mesh><mesh position={[0,0.1,0]}><cylinderGeometry args={[0.28,0.28,0.08,40]}/><meshStandardMaterial color="#35413f" metalness={0.5} roughness={0.5}/></mesh></group>
    <mesh><tubeGeometry args={[instrumentCable,48,0.09,10,false]}/><meshStandardMaterial color="#292f30" roughness={0.72}/></mesh>
    {/* Spare sample carrier and hand tools on the bench, separate from the active fixture. */}
    <Box position={[-13,-1.79,-3.8]} size={[4.5,0.16,3.5]} color="#687577" metalness={0.7} roughness={0.48}/>
    {[-14.1,-12.95,-11.8].flatMap(x=>[-4.65,-3.35].map(z=><mesh key={x+':'+z} position={[x,-1.67,z]}><cylinderGeometry args={[0.38,0.38,0.12,32]}/><meshStandardMaterial color="#b6bdb5" metalness={0.75} roughness={0.35}/></mesh>))}
    <group position={[-13,-1.62,1.8]} rotation={[0,0.35,0]}><Box position={[0,0,0]} size={[4.8,0.12,0.18]} color="#aab4b0" metalness={0.8} roughness={0.3}/><Box position={[1.5,0,0.3]} size={[1.8,0.1,0.1]} color="#8c9995" metalness={0.8} roughness={0.3}/></group>
  </group>
}

/** Visual guides only: their positions are derived from the authoritative state. */
function ToolGuides({ state }: { state: SimulationState }) {
  const { x, y, z } = state.tool
  const workZ = state.phase === 'ready' ? state.die.z + SCENARIO.dieThickness : SCENARIO.surfaceZ
  const target = state.phase === 'ready' ? state.die : SCENARIO.target
  return <group>
    <Line points={[[x,z,y],[x,workZ+0.015,y]]} color="#e2e8d8" transparent opacity={0.6} lineWidth={1}/>
    <mesh position={[x,workZ+0.018,y]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.18,0.205,40]}/><meshBasicMaterial color="#dce8d1" transparent opacity={0.8} depthTest={false}/></mesh>
    <mesh position={[target.x,SCENARIO.surfaceZ+0.02,target.y]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.04,1.055,64]}/><meshBasicMaterial color="#a8b7a1" transparent opacity={0.65}/></mesh>
  </group>
}

function Station() {
  return <group>
    {/* Machined base, guide rails, and sample carrier */}
    <RoundedBox position={[0,-1.05,0]} args={[22,1.5,15]} radius={0.16} smoothness={4} castShadow receiveShadow><meshStandardMaterial color="#273e4b" metalness={0.65} roughness={0.42}/></RoundedBox>
    <Suspense fallback={<Box position={[0,-0.25,0]} size={[19.8,0.2,13]} color="#71898d" metalness={0.7} roughness={0.4}/>}><BrushedPlate /></Suspense>
    {[-5.2, 5.2].map(z => <group key={z}>
      <Box position={[0, -0.02, z]} size={[19, 0.25, 0.75]} color="#a0a7a8" metalness={0.85} roughness={0.3} />
      <Box position={[0, 0.12, z]} size={[18.5, 0.04, 0.12]} color="#3e484c" metalness={0.8} />
    </group>)}
    {Array.from({length: 33}, (_, i) => <Box key={i} position={[-8+i*0.5,0.115,5.46]} size={[0.025,0.012,i%4 === 0 ? 0.23 : 0.12]} color="#354d55" metalness={0.45}/>)}
    <Box position={[0,0.115,-5.52]} size={[17,0.012,0.045]} color="#60adbb" metalness={0.35}/>
    <Box position={[0, 0.03, 0]} size={[16, 0.35, 8.7]} color="#405660" metalness={0.65} roughness={0.48} />
    <Box position={[-4, 0.29, 0]} size={[4.2, 0.22, 4.2]} color="#858a87" metalness={0.65} />
    <Box position={[4, 0.29, 0]} size={[5.2, 0.22, 5.2]} color={ceramic} roughness={0.65} />
    {[-7, 7].flatMap(x => [-3.5, 3.5].map(z => <Screw key={`${x}:${z}`} x={x} z={z} y={0.25} />))}
    {/* Low-profile machined clamps at the corners of the two carriers. */}
    {[-4,4].flatMap(center => [-1,1].flatMap(side => [-1,1].map(front => {
      const radius = center < 0 ? 1.98 : 2.48
      return <group key={center+':'+side+':'+front} position={[center+side*radius,0.425,front*radius]}>
        <mesh castShadow><boxGeometry args={[0.36,0.09,0.5]}/><meshStandardMaterial color="#aeb8b5" metalness={0.78} roughness={0.31}/></mesh>
        <mesh position={[0,0.055,0]}><cylinderGeometry args={[0.095,0.095,0.025,20]}/><meshStandardMaterial color="#3d4a4c" metalness={0.75} roughness={0.4}/></mesh>
      </group>
    })))}
    {/* Fine target frame and fiducials printed on the substrate */}
    {[[-1.12, 0], [1.12, 0]].map(([x,z], i) => <Box key={`v${i}`} position={[4+x, 0.404, z]} size={[0.025, 0.008, 2.26]} color="#9b8661" metalness={0.55} />)}
    {[-1.12, 1.12].map((z, i) => <Box key={`h${i}`} position={[4, 0.405, z]} size={[2.26, 0.008, 0.025]} color="#9b8661" metalness={0.55} />)}
    {[-1.55, 1.55].flatMap(x => [-1.55, 1.55].map(z => <group key={`${x}:${z}`} position={[4+x, 0.407, z]}>
      <Box position={[0,0,0]} size={[0.3,0.008,0.025]} color="#8d7652" metalness={0.6} />
      <Box position={[0,0,0]} size={[0.025,0.008,0.3]} color="#8d7652" metalness={0.6} />
    </group>))}
    {/* Fine bond pads, traces and vias on the ceramic carrier. */}
    {Array.from({length: 10}, (_, i) => {
      const offset = -0.9 + i * 0.2
      return <group key={i}>
        {[-1,1].map(side => <group key={side}>
          <Box position={[4+offset,0.408,side*1.35]} size={[0.09,0.008,0.24]} color="#b9a47b" metalness={0.72} roughness={0.35}/>
          <Box position={[4+offset,0.407,side*1.82]} size={[0.015,0.006,0.72]} color="#a99773" metalness={0.65} roughness={0.45}/>
          <Box position={[4+side*1.35,0.408,offset]} size={[0.24,0.008,0.09]} color="#b9a47b" metalness={0.72} roughness={0.35}/>
          <Box position={[4+side*1.82,0.407,offset]} size={[0.72,0.006,0.015]} color="#a99773" metalness={0.65} roughness={0.45}/>
        </group>)}
      </group>
    })}
    {[-2.05,2.05].flatMap(x=>[-2.05,2.05].map(z=><mesh key={x+':'+z} position={[4+x,0.41,z]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.035,0.065,20]}/><meshStandardMaterial color="#9a8661" metalness={0.7} roughness={0.4}/></mesh>))}
  </group>
}

/** Presentation only: this animation does not simulate adhesive flow, volume or curing. */
function AdhesiveDispensing({ playing, cycle }: { playing: boolean; cycle: number }) {
  const applicator = useRef<Group>(null)
  const deposit = useRef<Mesh>(null)
  const droplet = useRef<Mesh>(null)
  const started = useRef(0)
  useEffect(() => { started.current = performance.now() }, [cycle])
  useFrame(() => {
    if (!applicator.current || !deposit.current || !droplet.current) return
    const sample = sampleDispense(playing ? (performance.now() - started.current) / 1000 : 5.2)
    applicator.current.visible = playing && sample.phase !== 'complete'
    applicator.current.position.y = sample.needleHeight
    const radius = Math.max(0.001, sample.depositScale)
    deposit.current.scale.set(radius, 0.04 * radius, radius)
    droplet.current.visible = playing && sample.dropletHeight !== null
    if (sample.dropletHeight !== null) droplet.current.position.y = sample.dropletHeight
  })
  return <group>
    <mesh ref={deposit} position={[4,0.406,0]} scale={[playing ? 0.001 : 1,0.04,playing ? 0.001 : 1]}><sphereGeometry args={[0.58,48,24,0,Math.PI*2,0,Math.PI/2]}/><meshPhysicalMaterial color="#bba982" roughness={0.27} metalness={0.03} transparent opacity={0.8} clearcoat={0.25}/></mesh>
    <mesh ref={droplet} position={[4,1.12,0]} scale={[0.085,0.12,0.085]} visible={false}><sphereGeometry args={[1,24,16]}/><meshPhysicalMaterial color="#c4ab7d" roughness={0.25} transparent opacity={0.85} clearcoat={0.3}/></mesh>
    <group ref={applicator} position={[4,4.3,0]} visible={playing}>
      <mesh position={[0,0.32,0]} castShadow><cylinderGeometry args={[0.24,0.065,0.64,32]}/><meshStandardMaterial color="#b6beb9" metalness={0.85} roughness={0.27}/></mesh>
      <mesh position={[0,0.92,0]} castShadow><cylinderGeometry args={[0.34,0.24,0.6,32]}/><meshStandardMaterial color="#6e7e7e" metalness={0.72} roughness={0.35}/></mesh>
      <mesh position={[0,1.56,0]} castShadow><cylinderGeometry args={[0.42,0.34,0.75,32]}/><meshPhysicalMaterial color="#c6d9d3" metalness={0.15} roughness={0.24} transparent opacity={0.78}/></mesh>
      <mesh position={[0,2.04,0]} castShadow><cylinderGeometry args={[0.44,0.44,0.18,32]}/><meshStandardMaterial color="#537784" metalness={0.55} roughness={0.4}/></mesh>
    </group>
  </group>
}


/** Independent visual equipment on the neighboring bench; it does not control the simulated microscope. */
function BenchMicroscope() {
  const { scene } = useGLTF(asset('industrial_microscope/industrial_microscope_1k.gltf'))
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(object => { if ('isMesh' in object) { object.castShadow = true; object.receiveShadow = true } })
    return clone
  }, [scene])
  return <primitive object={model} position={[-8.7,-1.8,-8]} scale={18} rotation={[0,Math.PI,0]}/>
}

function MicroscopeStand() {
  return <group>
    <Box position={[8.8,1.7,-5.9]} size={[1.1,4.2,1.1]} color="#626d6d" metalness={0.75} roughness={0.35}/>
    <Box position={[6.3,3.7,-5.9]} size={[5.8,0.65,1.3]} color="#899391" metalness={0.75} roughness={0.35}/>
    <Box position={[4,3.7,-3.2]} size={[1.3,0.65,6]} color="#899391" metalness={0.75} roughness={0.35}/>
    <mesh position={[4,3.2,0]} castShadow><cylinderGeometry args={[0.85,0.7,0.8,48]}/><meshStandardMaterial color="#343e41" metalness={0.78} roughness={0.32}/></mesh>
    <mesh position={[4,2.65,0]} castShadow><cylinderGeometry args={[0.7,0.42,0.5,48]}/><meshStandardMaterial color="#aeb6b2" metalness={0.82} roughness={0.25}/></mesh>
    <mesh position={[4,2.38,0]}><cylinderGeometry args={[0.42,0.42,0.08,40]}/><meshStandardMaterial color="#303b3d" metalness={0.65} roughness={0.32}/></mesh><mesh position={[4,2.33,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.25,0.35,40]}/><meshStandardMaterial color="#e5e6d8" emissive="#d3dfcf" emissiveIntensity={0.5} roughness={0.4}/></mesh>
    {[-1,1].map(x=><group key={x} position={[4+x*0.65,3.7,-3.6]} rotation={[0,0,Math.PI/2]}><mesh><cylinderGeometry args={[0.43,0.43,0.22,32]}/><meshStandardMaterial color="#303a3b" metalness={0.7} roughness={0.4}/></mesh><mesh position={[0,0.13,0]}><cylinderGeometry args={[0.31,0.31,0.05,32]}/><meshStandardMaterial color="#aab3ad" metalness={0.8} roughness={0.3}/></mesh></group>)}
  </group>
}

function RetractableMicroscope({ raised }: { raised: boolean }) {
  const group = useRef<Group>(null)
  useFrame((_, delta) => { if (group.current) group.current.position.y = MathUtils.damp(group.current.position.y, raised ? 4 : 0, 4, Math.min(delta, 0.05)) })
  return <group ref={group}><MicroscopeStand /></group>
}

/** A subtle visual shadow follows the actual die and fades with simulated clearance. */
function DieContactShadow({ state }: { state: SimulationState }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(64,64,10,64,64,64)
    gradient.addColorStop(0,'rgba(10,18,24,0.55)'); gradient.addColorStop(1,'rgba(10,18,24,0)')
    ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128)
    return new CanvasTexture(canvas)
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  const height = Math.max(0, state.die.z - SCENARIO.surfaceZ)
  return <mesh position={[state.die.x,SCENARIO.surfaceZ+0.012,state.die.y]} rotation={[-Math.PI/2,0,0]}>
    <planeGeometry args={[2.8+height*0.25,2.8+height*0.25]}/><meshBasicMaterial map={texture} transparent opacity={Math.max(0.12,0.55-height*0.1)} depthWrite={false}/>
  </mesh>
}

/** A transient annotation of real attachment/release events; the die never animates away from its authoritative pose. */
function ProcedurePulse({ state }: { state: SimulationState }) {
  const ring = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const previous = useRef(state.phase)
  const elapsed = useRef(-1)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  useEffect(() => {
    const before = previous.current
    previous.current = state.phase
    elapsed.current = (before === 'ready' && state.phase === 'carrying') || (before === 'carrying' && state.phase === 'placed') ? 0 : -1
  }, [state.phase])
  useFrame((_, delta) => {
    if (!ring.current || !material.current) return
    if (elapsed.current < 0) { ring.current.visible = false; return }
    elapsed.current += Math.min(delta, 0.05)
    const t = elapsed.current / 1.5
    ring.current.visible = t < 1
    ring.current.scale.setScalar(reducedMotion.matches ? 1 : 1 + t * 0.22)
    material.current.opacity = reducedMotion.matches ? 0.65 : Math.max(0, (1-t)*0.7)
  })
  return <mesh ref={ring} position={[state.die.x,state.die.z+0.13,state.die.y]} rotation={[-Math.PI/2,0,0]} renderOrder={3} visible={false}>
    <ringGeometry args={[1.12,1.145,64]}/><meshBasicMaterial ref={material} color={state.phase === 'placed' && !state.result?.passed ? '#d39f78' : '#b0d4bb'} transparent opacity={0} depthWrite={false} />
  </mesh>
}

/** Decorative silicon metallization; its geometry does not affect the placement. */
function DieSurface() {
  const texture = useTexture(asset('silicon-circuit.png'))
  texture.colorSpace = SRGBColorSpace
  return <mesh position={[0,0.121,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.22,1.22]}/><meshStandardMaterial map={texture} metalness={0.48} roughness={0.38}/></mesh>
}

function Die({ state }: { state: SimulationState }) {
  const { x, y, z, angle } = state.die
  return <group position={[x, z, y]} rotation={[0, -angle * Math.PI / 180, 0]}>
    <Box position={[0, 0.05, 0]} size={[2, 0.1, 2]} color="#303e49" metalness={0.7} roughness={0.3} />
    <Box position={[0, 0.103, 0]} size={[1.87, 0.008, 1.87]} color="#50616b" metalness={0.7} roughness={0.35} />
    {/* Bond pads and an intentionally restrained circuit pattern */}
    {Array.from({ length: 8 }, (_, i) => {
      const t = -0.77 + i * 0.22
      return <group key={i}>
        <Box position={[t, 0.111, -0.84]} size={[0.12, 0.008, 0.08]} color="#d0b67c" metalness={0.85} roughness={0.28} />
        <Box position={[t, 0.111, 0.84]} size={[0.12, 0.008, 0.08]} color="#d0b67c" metalness={0.85} roughness={0.28} />
        <Box position={[-0.84, 0.111, t]} size={[0.08, 0.008, 0.12]} color="#d0b67c" metalness={0.85} roughness={0.28} />
        <Box position={[0.84, 0.111, t]} size={[0.08, 0.008, 0.12]} color="#d0b67c" metalness={0.85} roughness={0.28} />
      </group>
    })}
    <Suspense fallback={<Box position={[0,0.117,0]} size={[1.22,0.006,1.22]} color="#314953" metalness={0.5}/>}><DieSurface /></Suspense>
    <mesh position={[-0.68, 0.12, -0.68]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.07, 16]} /><meshStandardMaterial color="#dfc992" metalness={0.7} /></mesh>
    {/* Fine registration marks move with the simulated die and leave its centre unobscured. */}
    {[-1,1].map(side => <group key={side}>
      <Line points={[[side*1.04,0.125,0],[side*1.36,0.125,0]]} color="#e6d6a8" lineWidth={1}/>
      <Line points={[[0,0.125,side*1.04],[0,0.125,side*1.36]]} color="#e6d6a8" lineWidth={1}/>
      <Line points={[[side*1.10,0.125,-0.09],[side*1.10,0.125,0.09]]} color="#e6d6a8" lineWidth={1}/>
      <Line points={[[-0.09,0.125,side*1.10],[0.09,0.125,side*1.10]]} color="#e6d6a8" lineWidth={1}/>
    </group>)}
  </group>
}

function Nozzle({ state, camera }: { state: SimulationState; camera: CameraMode }) {
  const { x, y, z, angle, tiltX, tiltY } = state.tool
  return <group position={[x, z, y]} rotation={[tiltY * Math.PI / 180, -angle * Math.PI / 180, -tiltX * Math.PI / 180]}>
    {/* The simulation position denotes the very tip of the nozzle. */}
    <mesh position={[0, 0.27, 0]} castShadow><cylinderGeometry args={[0.32, 0.13, 0.54, 32]} /><meshStandardMaterial color="#adb4b3" metalness={0.9} roughness={0.24} /></mesh>
    <mesh position={[0, 0.035, 0]} castShadow><cylinderGeometry args={[0.14, 0.14, 0.07, 32]} /><meshStandardMaterial color="#31393b" metalness={0.5} roughness={0.48} /></mesh>
    <group visible={camera === 'workstation'}>
    <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.38, 0.32, 2.15, 32]} /><meshStandardMaterial color="#8d989c" metalness={0.9} roughness={0.3} /></mesh>
    <mesh position={[0, 2.55, 0]} castShadow><cylinderGeometry args={[0.49, 0.49, 0.25, 32]} /><meshStandardMaterial color="#4b565a" metalness={0.85} roughness={0.34} /></mesh>
    <mesh position={[0,2.58,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[0.495,0.035,10,48]}/><meshStandardMaterial color={state.vacuum ? '#a9cbb3' : '#455653'} emissive={state.vacuum ? '#79aa87' : '#111a17'} emissiveIntensity={state.vacuum ? 0.65 : 0.05} metalness={0.3} roughness={0.48}/></mesh>
    <mesh position={[0, 3.1, 0]} castShadow><cylinderGeometry args={[0.5,0.42,1,48]}/><meshStandardMaterial color="#3c4749" metalness={0.68} roughness={0.4}/></mesh>
    {[2.78,2.9,3.02,3.14,3.26,3.38,3.5].map(y=><mesh key={y} position={[0,y,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[0.49,0.025,8,48]}/><meshStandardMaterial color="#a1a8a3" metalness={0.8} roughness={0.35}/></mesh>)}
    <mesh position={[0,3.68,0]}><cylinderGeometry args={[0.36,0.5,0.3,40]}/><meshStandardMaterial color="#7b8685" metalness={0.8} roughness={0.3}/></mesh>
    </group>
  </group>
}

/** A visual proxy for the operator: it follows the simulated tool, not tracked finger joints. */
function OperatorHand({ state }: { state: SimulationState }) {
  const { x, y, z, angle, tiltX, tiltY } = state.tool
  const sleeve = useMemo(() => new CatmullRomCurve3([
    new Vector3(12, 3.8, 13),
    new Vector3(8, 4.4, 9),
    new Vector3(x + 2.2, z + 4, y + 2.5),
    new Vector3(1.05, 3.5, 0.8).applyEuler(new Euler(tiltY * Math.PI / 180, -angle * Math.PI / 180, -tiltX * Math.PI / 180)).add(new Vector3(x,z,y)),
  ]), [x, y, z, angle, tiltX, tiltY])
  return <group>
    <mesh castShadow><tubeGeometry args={[sleeve, 36, 0.10, 16, false]}/><meshStandardMaterial color="#354b50" roughness={0.8}/></mesh>
    <group position={[x,z,y]} rotation={[tiltY * Math.PI / 180, -angle * Math.PI / 180, -tiltX * Math.PI / 180]}><group position={[0,3.15,0]}>
      <mesh position={[0.79,0.27,0.31]} rotation={[0,-0.35,-0.3]} scale={[0.78,0.33,0.55]} castShadow><sphereGeometry args={[1,32,24]}/><meshPhysicalMaterial color="#b4cbd2" roughness={0.57} metalness={0.02} clearcoat={0.12}/></mesh>
      {/* Curled fingertips grip the upper barrel, leaving the tip in view. */}
      {[0.3, 0.05, -0.2].map((offset, i) => <group key={i}><mesh position={[0.18, 0.23 + offset * 0.25, -0.42 + offset]} rotation={[0, 0, -0.75]} castShadow><capsuleGeometry args={[0.15,0.58,8,20]}/><meshPhysicalMaterial color="#c1d4d9" roughness={0.56} clearcoat={0.1}/></mesh><mesh position={[0.4,0.42+offset*0.25,-0.42+offset]} scale={[0.18,0.15,0.15]}><sphereGeometry args={[1,20,16]}/><meshStandardMaterial color="#b1c8ce" roughness={0.7}/></mesh></group>)}
      <mesh position={[-0.32,-0.03,0.24]} rotation={[0,0,0.8]} castShadow><capsuleGeometry args={[0.19,0.58,8,20]}/><meshPhysicalMaterial color="#c1d4d9" roughness={0.56} clearcoat={0.1}/></mesh>
    </group></group>
  </group>
}

export function Scene({ state, camera, posture, viewAngle, inspectionAngle, magnification, illumination, adhesivePlaying, adhesiveCycle }: SceneProps) {
  return <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} style={{ width: '100%', height: '100%' }}>
    <color attach="background" args={['#242c30']} />
    {camera === 'workstation'
      ? <PerspectiveCamera makeDefault position={[0, 14.5, 17]} fov={54} near={0.1} far={150} />
      : <OrthographicCamera makeDefault position={[4,18,0]} near={0.1} far={120} />}
    <CameraRig mode={camera} posture={posture} viewAngle={viewAngle} inspectionAngle={inspectionAngle} magnification={magnification} focusX={camera === 'microscope' ? (state.phase === 'ready' ? state.die.x : SCENARIO.target.x) : 0} focusHeight={camera === 'microscope' ? (state.phase === 'ready' ? state.die.z + SCENARIO.dieThickness : SCENARIO.surfaceZ) : 0} adhesivePlaying={adhesivePlaying} />
    {camera === 'workstation' && <OrbitControls makeDefault target={adhesivePlaying ? [SCENARIO.target.x,SCENARIO.surfaceZ,0] : [0,0,0]} enablePan={false} minDistance={12} maxDistance={35} minPolarAngle={0.2} maxPolarAngle={1.35}/>}
    <Environment resolution={128}>
      <Lightformer form="rect" intensity={2} position={[0,12,0]} rotation={[-Math.PI/2,0,0]} scale={[18,10,1]} />
      <Lightformer form="rect" intensity={1.2} position={[-12,5,3]} rotation={[0,Math.PI/2,0]} scale={[12,7,1]} />
      <Lightformer form="rect" intensity={0.8} position={[12,5,-3]} rotation={[0,-Math.PI/2,0]} scale={[10,6,1]} />
    </Environment>
    <ambientLight intensity={0.6 * illumination} />
    <hemisphereLight args={['#e9f1f2', '#54514a', 0.85]} />
    <directionalLight position={[-5, 16, 9]} intensity={1.9 * illumination} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-bias={-0.0001} />
    <directionalLight position={[10, 8, -8]} intensity={0.7} color="#d5e1e5" />
    {camera === 'workstation' && <Laboratory state={state} />}<Station /><AdhesiveDispensing playing={adhesivePlaying} cycle={adhesiveCycle}/>{camera === 'workstation' && <RetractableMicroscope raised={adhesivePlaying} />}<DieContactShadow state={state} /><Die state={state} /><ProcedurePulse state={state} /><Nozzle state={state} camera={camera} />{camera === 'workstation' && <OperatorHand state={state} />}<ToolGuides state={state} />
    <ContactShadows position={[0, -1.82, 0]} opacity={0.3} scale={30} blur={2.2} far={4} />
  </Canvas>
}

