import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrthographicCamera } from '@react-three/drei'
import { useEffect } from 'react'
import { OrthographicCamera as ThreeOrthographicCamera } from 'three'
import type { SimulationState } from '../simulation/engine'

export type CameraMode = 'workstation' | 'microscope'

type SceneProps = { state: SimulationState; camera: CameraMode }

function CameraRig({ mode }: { mode: CameraMode }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (mode === 'microscope') {
      camera.position.set(4, 18, 0.001)
      camera.up.set(0, 0, -1)
      camera.lookAt(4, 0, 0)
      if (camera instanceof ThreeOrthographicCamera) camera.zoom = Math.min(size.width, size.height) / 7
    } else {
      camera.position.set(17, 19, 23)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)
      if (camera instanceof ThreeOrthographicCamera) camera.zoom = Math.min(size.width, size.height) / 23
    }
    if (camera instanceof ThreeOrthographicCamera) camera.updateProjectionMatrix()
  }, [camera, mode, size])
  return null
}

const steel = '#89939a'
const darkSteel = '#414b50'
const ceramic = '#d2d0c5'

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
    {/* Illustrative, low-profile epoxy deposit */}
    <mesh position={[4, 0.404, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.58, 48]} /><meshStandardMaterial color="#b39c76" roughness={0.42} transparent opacity={0.65} /></mesh>
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
  </group>
}

export function Scene({ state, camera }: SceneProps) {
  return <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} style={{ width: '100%', height: '100%' }}>
    <color attach="background" args={['#242c30']} />
    <OrthographicCamera makeDefault position={[17, 19, 23]} near={0.1} far={120} />
    <CameraRig mode={camera} />
    <ambientLight intensity={0.85} />
    <hemisphereLight args={['#e9f1f2', '#54514a', 1.15]} />
    <directionalLight position={[-5, 16, 9]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-bias={-0.0001} />
    <directionalLight position={[10, 8, -8]} intensity={0.7} color="#d5e1e5" />
    <Station /><Die state={state} /><Nozzle state={state} />
    <ContactShadows position={[0, -1.82, 0]} opacity={0.3} scale={30} blur={2.2} far={4} />
  </Canvas>
}

