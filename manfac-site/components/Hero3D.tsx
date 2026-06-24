'use client'

import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'

type Volume = { position: [number, number, number]; size: [number, number, number] }

const VOLUMES_FULL: Volume[] = [
  { position: [-1.6, -0.3, 0], size: [0.7, 1.4, 0.7] },
  { position: [-0.7, 0.1, 0.3], size: [0.6, 2.2, 0.6] },
  { position: [0.2, -0.5, -0.2], size: [0.8, 1.0, 0.8] },
  { position: [1.1, 0.3, 0.1], size: [0.6, 2.6, 0.6] },
  { position: [1.9, -0.4, 0.4], size: [0.55, 1.2, 0.55] },
]

const VOLUMES_SIMPLIFIED: Volume[] = [
  { position: [-1.0, -0.2, 0], size: [0.7, 1.6, 0.7] },
  { position: [0.2, 0.2, 0.1], size: [0.65, 2.4, 0.65] },
  { position: [1.2, -0.3, -0.1], size: [0.6, 1.3, 0.6] },
]

function BlueprintStructure({ progress, simplified }: { progress: number; simplified: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const targetRotation = useRef({ x: 0, y: 0 })
  const { pointer } = useThree()
  const volumes = simplified ? VOLUMES_SIMPLIFIED : VOLUMES_FULL

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (!simplified) {
      targetRotation.current.y = pointer.x * 0.35
      targetRotation.current.x = -pointer.y * 0.2
    } else {
      targetRotation.current.y += delta * 0.15
    }

    groupRef.current.rotation.y += (targetRotation.current.y - groupRef.current.rotation.y) * 0.05
    groupRef.current.rotation.x += (targetRotation.current.x - groupRef.current.rotation.x) * 0.05
  })

  const solidOpacity = THREE.MathUtils.clamp(progress, 0, 1)

  return (
    <group ref={groupRef} rotation={[0.15, -0.3, 0]}>
      {volumes.map((volume, i) => (
        <mesh key={i} position={volume.position}>
          <boxGeometry args={volume.size} />
          <meshStandardMaterial
            color="#00345e"
            transparent
            opacity={solidOpacity * 0.92}
            roughness={0.45}
            metalness={0.1}
          />
          <Edges color={i % 2 === 0 ? '#f85e0b' : '#00345e'} linewidth={1.25} />
        </mesh>
      ))}
    </group>
  )
}

export default function Hero3D({ progress, simplified = false }: { progress: number; simplified?: boolean }) {
  const dpr = useMemo<[number, number]>(() => (simplified ? [1, 1] : [1, 1.5]), [simplified])

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0.4, 6], fov: 38 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <Suspense fallback={null}>
        <BlueprintStructure progress={progress} simplified={simplified} />
      </Suspense>
    </Canvas>
  )
}
