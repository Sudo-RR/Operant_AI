import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useEffect } from 'react'
import { CatmullRomCurve3, OrthographicCamera as ThreeOrthographicCamera, Vector3 } from 'three'
import type { SimulationState } from '../simulation/engine'

export type CameraMode = 'workstation' | 'microscope'

type SceneProps = { state: SimulationState; camera: CameraMode; magnification: number; illumination: number }

function CameraRig({ mode, magnification }: { mode: CameraMode; magnification: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (mode === 'microscope') {
      camera.position.set(4, 18, 0.001)
      camera.up.set(0, 0, -1)
      camera.lookAt(4, 0, 0)
      if (camera instanceof ThreeOrthographicCamera) camera.zoom = Math.min(size.width, size.height) / 7 * magnification
    } else {
      camera.position.set(21, 20, 26)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)
      if (camera instanceof ThreeOrthographicCamera) camera.zoom = Math.min(size.width, size.height) / 23
    }
    if (camera instanceof ThreeOrthographicCamera) camera.updateProjectionMatrix()
  }, [camera, mode, size, magnification])
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

function Screw({ x, z, y = 0.4 }: { x: number; z: number; y?: number }) {
  return <group position={[x, y, z]}>
    <mesh castShadow><cylinderGeometry args={[0.22, 0.22, 0.1, 24]} /><meshStandardMaterial color="#565e61" metalness={0.8} roughness={0.3} /></mesh>
    <Box position={[0, 0.06, 0]} size={[0.22, 0.02, 0.035]} color="#252d30" />
  </group>
}

/** Workbench and instrumentation are visual context; the simulation owns all procedure decisions. */
function Laboratory() {
  return <group>
    <Box position={[0,-2.2,0]} size={[38,0.7,27]} color="#9da8a7" metalness={0.38} roughness={0.55}/>
    <Box position={[0,-2.6,0]} size={[38,0.15,27]} color="#657174" metalness={0.6} roughness={0.45}/>
    <Box position={[0,3.3,-13.8]} size={[38,11,0.5]} color="#a6b0ad" metalness={0.05} roughness={0.8}/>
    <Box position={[0,0.1,-13.45]} size={[38,0.18,0.35]} color="#6b7977" metalness={0.5} roughness={0.45}/>
    {[ -11, 0, 11 ].map(x => <Box key={x} position={[x,3.3,-13.48]} size={[0.06,10.5,0.04]} color="#7e8b88" roughness={0.75}/>)}
    {/* Compact controller, with modeled switches and knobs. Values remain in the UI. */}
    <Box position={[13,-0.6,-5.2]} size={[4.1,2.15,3.2]} color="#556163" metalness={0.65} roughness={0.46}/>
    <Box position={[13,-0.6,-3.56]} size={[3.8,1.85,0.12]} color="#303b3c" metalness={0.55} roughness={0.45}/>
    <Box position={[12.45,-0.32,-3.48]} size={[1.65,0.57,0.04]} color="#4a5c57" metalness={0.2} roughness={0.65}/>
    {[12.1,12.65,13.2].map(x => <Box key={x} position={[x,-1.05,-3.46]} size={[0.36,0.19,0.08]} color="#8f9a93" metalness={0.5} roughness={0.4}/>)}
    <group position={[14.15,-0.47,-3.44]} rotation={[Math.PI/2,0,0]}><mesh castShadow><cylinderGeometry args={[0.42,0.42,0.16,40]}/><meshStandardMaterial color="#a1aaa5" metalness={0.8} roughness={0.3}/></mesh><mesh position={[0,0.1,0]}><cylinderGeometry args={[0.28,0.28,0.08,40]}/><meshStandardMaterial color="#35413f" metalness={0.5} roughness={0.5}/></mesh></group>
    <mesh><tubeGeometry args={[instrumentCable,48,0.09,10,false]}/><meshStandardMaterial color="#292f30" roughness={0.72}/></mesh>
  </group>
}

function Station() {
  return <group>
    {/* Machined base, guide rails, and sample carrier */}
    <Box position={[0, -1.05, 0]} size={[22, 1.5, 15]} color="#343e43" metalness={0.7} roughness={0.42} />
    <Box position={[0, -0.25, 0]} size={[19.8, 0.2, 13]} color="#687277" metalness={0.8} roughness={0.4} />
    {[-5.2, 5.2].map(z => <group key={z}>
      <Box position={[0, -0.02, z]} size={[19, 0.25, 0.75]} color="#a0a7a8" metalness={0.85} roughness={0.3} />
      <Box position={[0, 0.12, z]} size={[18.5, 0.04, 0.12]} color="#3e484c" metalness={0.8} />
    </group>)}
    <Box position={[0, 0.03, 0]} size={[16, 0.35, 8.7]} color="#575f61" metalness={0.75} roughness={0.42} />
    <Box position={[-4, 0.29, 0]} size={[4.2, 0.22, 4.2]} color="#858a87" metalness={0.65} />
    <Box position={[4, 0.29, 0]} size={[5.2, 0.22, 5.2]} color={ceramic} roughness={0.65} />
    {[-7, 7].flatMap(x => [-3.5, 3.5].map(z => <Screw key={`${x}:${z}`} x={x} z={z} y={0.25} />))}
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
    {/* Illustrative, low-profile epoxy deposit */}
    <mesh position={[4, 0.406, 0]} scale={[1,0.04,1]}><sphereGeometry args={[0.58,48,24,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color="#bba982" roughness={0.32} metalness={0.05} transparent opacity={0.78} /></mesh>
  </group>
}


function MicroscopeStand() {
  return <group>
    <Box position={[8.8,1.7,-5.9]} size={[1.1,4.2,1.1]} color="#626d6d" metalness={0.75} roughness={0.35}/>
    <Box position={[6.3,3.7,-5.9]} size={[5.8,0.65,1.3]} color="#899391" metalness={0.75} roughness={0.35}/>
    <Box position={[4,3.7,-3.2]} size={[1.3,0.65,6]} color="#899391" metalness={0.75} roughness={0.35}/>
    <mesh position={[4,3.2,0]} castShadow><cylinderGeometry args={[0.85,0.7,0.8,48]}/><meshStandardMaterial color="#343e41" metalness={0.78} roughness={0.32}/></mesh>
    <mesh position={[4,2.65,0]} castShadow><cylinderGeometry args={[0.7,0.42,0.5,48]}/><meshStandardMaterial color="#aeb6b2" metalness={0.82} roughness={0.25}/></mesh>
    <mesh position={[4,2.38,0]}><cylinderGeometry args={[0.42,0.42,0.08,40]}/><meshStandardMaterial color="#303b3d" metalness={0.65} roughness={0.32}/></mesh>
    {[-1,1].map(x=><group key={x} position={[4+x*0.65,3.7,-3.6]} rotation={[0,0,Math.PI/2]}><mesh><cylinderGeometry args={[0.43,0.43,0.22,32]}/><meshStandardMaterial color="#303a3b" metalness={0.7} roughness={0.4}/></mesh><mesh position={[0,0.13,0]}><cylinderGeometry args={[0.31,0.31,0.05,32]}/><meshStandardMaterial color="#aab3ad" metalness={0.8} roughness={0.3}/></mesh></group>)}
  </group>
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
    <Box position={[0, 0.112, 0]} size={[1.22, 0.008, 1.22]} color="#273b47" metalness={0.7} />
    {[-0.45, -0.27, -0.09, 0.09, 0.27, 0.45].map(v => <group key={v}>
      <Box position={[v,0.118,0]} size={[0.012,0.006,1.1]} color="#71878b" metalness={0.7} />
      <Box position={[0,0.119,v]} size={[1.1,0.006,0.012]} color="#71878b" metalness={0.7} />
    </group>)}
    <mesh position={[-0.68, 0.12, -0.68]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.07, 16]} /><meshStandardMaterial color="#dfc992" metalness={0.7} /></mesh>
  </group>
}

function Nozzle({ state }: { state: SimulationState }) {
  const { x, y, z, angle } = state.tool
  return <group position={[x, z, y]} rotation={[0, -angle * Math.PI / 180, 0]}>
    {/* The simulation position denotes the very tip of the nozzle. */}
    <mesh position={[0, 0.27, 0]} castShadow><cylinderGeometry args={[0.32, 0.13, 0.54, 32]} /><meshStandardMaterial color="#adb4b3" metalness={0.9} roughness={0.24} /></mesh>
    <mesh position={[0, 0.035, 0]} castShadow><cylinderGeometry args={[0.14, 0.14, 0.07, 32]} /><meshStandardMaterial color="#31393b" metalness={0.5} roughness={0.48} /></mesh>
    <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.38, 0.32, 2.15, 32]} /><meshStandardMaterial color="#8d989c" metalness={0.9} roughness={0.3} /></mesh>
    <mesh position={[0, 2.55, 0]} castShadow><cylinderGeometry args={[0.49, 0.49, 0.25, 32]} /><meshStandardMaterial color="#4b565a" metalness={0.85} roughness={0.34} /></mesh>
    <mesh position={[0, 3.1, 0]} castShadow><cylinderGeometry args={[0.5,0.42,1,48]}/><meshStandardMaterial color="#3c4749" metalness={0.68} roughness={0.4}/></mesh>
    {[2.78,2.9,3.02,3.14,3.26,3.38,3.5].map(y=><mesh key={y} position={[0,y,0]}><torusGeometry args={[0.49,0.025,8,48]}/><meshStandardMaterial color="#a1a8a3" metalness={0.8} roughness={0.35}/></mesh>)}
    <mesh position={[0,3.68,0]}><cylinderGeometry args={[0.36,0.5,0.3,40]}/><meshStandardMaterial color="#7b8685" metalness={0.8} roughness={0.3}/></mesh>
  </group>
}

export function Scene({ state, camera, magnification, illumination }: SceneProps) {
  return <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} style={{ width: '100%', height: '100%' }}>
    <color attach="background" args={['#242c30']} />
    {camera === 'workstation'
      ? <PerspectiveCamera makeDefault position={[21, 20, 26]} fov={38} near={0.1} far={150} />
      : <OrthographicCamera makeDefault position={[4,18,0]} near={0.1} far={120} />}
    <CameraRig mode={camera} magnification={magnification} />
    {camera === 'workstation' && <OrbitControls makeDefault target={[0,0,0]} enablePan={false} minDistance={18} maxDistance={70} minPolarAngle={0.2} maxPolarAngle={1.48}/>}
    <ambientLight intensity={0.85 * illumination} />
    <hemisphereLight args={['#e9f1f2', '#54514a', 1.15]} />
    <directionalLight position={[-5, 16, 9]} intensity={2.5 * illumination} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-bias={-0.0001} />
    <directionalLight position={[10, 8, -8]} intensity={0.7} color="#d5e1e5" />
    {camera === 'workstation' && <Laboratory />}<Station />{camera === 'workstation' && <MicroscopeStand />}<Die state={state} /><Nozzle state={state} />
    <ContactShadows position={[0, -1.82, 0]} opacity={0.3} scale={30} blur={2.2} far={4} />
  </Canvas>
}

