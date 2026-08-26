import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Float, OrbitControls, RoundedBox } from '@react-three/drei'
import { CursorClick, HandGrabbing } from '@phosphor-icons/react'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'

const GLYPHS = {
  4: ['1001', '1001', '1001', '1111', '0001', '0001', '0001'],
  0: ['1111', '1001', '1001', '1001', '1001', '1001', '1111'],
}

function BuildingCell({ position, seed, active, onEnter, onLeave }) {
  const windows = useMemo(() => {
    const result = []
    for (let floor = 0; floor < 4; floor += 1) {
      for (let bay = 0; bay < 2; bay += 1) {
        result.push({
          position: [(bay - 0.5) * 0.42, (floor - 1.5) * 0.34, 0.325],
          lit: (floor * 3 + bay + seed) % 4 !== 0,
        })
      }
    }
    return result
  }, [seed])

  return (
    <group position={position} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <RoundedBox args={[1, 1, 0.58]} radius={0.045} smoothness={3}>
        <meshStandardMaterial color={active ? '#163f50' : '#102934'} roughness={0.58} metalness={0.2} />
      </RoundedBox>
      {windows.map((window, index) => (
        <mesh key={index} position={window.position}>
          <planeGeometry args={[0.27, 0.17]} />
          <meshStandardMaterial
            color={window.lit ? '#8bdcff' : '#173a48'}
            emissive={window.lit ? '#168fc2' : '#081a21'}
            emissiveIntensity={active && window.lit ? 4 : window.lit ? 1.7 : 0.1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function NumberBuilding({ digit, x, onHover }) {
  const [active, setActive] = useState(false)
  const cells = useMemo(() => {
    const result = []
    GLYPHS[digit].forEach((row, rowIndex) => {
      ;[...row].forEach((value, columnIndex) => {
        if (value === '1') result.push([columnIndex - 1.5, 3 - rowIndex, 0])
      })
    })
    return result
  }, [digit])

  const handleEnter = (event) => {
    event.stopPropagation()
    setActive(true)
    onHover(true)
    document.body.style.cursor = 'grab'
  }

  const handleLeave = () => {
    setActive(false)
    onHover(false)
    document.body.style.cursor = ''
  }

  return (
    <group position={[x, -0.15, 0]} scale={0.78}>
      {cells.map((position, index) => (
        <BuildingCell
          key={`${digit}-${index}`}
          position={position}
          seed={index + x}
          active={active}
          onEnter={handleEnter}
          onLeave={handleLeave}
        />
      ))}
    </group>
  )
}

function Scene({ reducedMotion, onHover }) {
  const group = useRef(null)
  const pointer = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return
    pointer.current.x = THREE.MathUtils.damp(pointer.current.x, state.pointer.x * 0.08, 4, delta)
    pointer.current.y = THREE.MathUtils.damp(pointer.current.y, state.pointer.y * 0.04, 4, delta)
    group.current.rotation.y = pointer.current.x
    group.current.rotation.x = -pointer.current.y
  })

  return (
    <>
      <color attach="background" args={['#071116']} />
      <fog attach="fog" args={['#071116', 13, 26]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 7]} intensity={3.2} color="#d9f4ff" />
      <pointLight position={[-8, 2, 4]} intensity={34} distance={16} color="#0073a4" />
      <Float speed={reducedMotion ? 0 : 0.65} rotationIntensity={0.06} floatIntensity={0.18}>
        <group ref={group} rotation={[-0.08, -0.08, 0]}>
          <NumberBuilding digit="4" x={-4.3} onHover={onHover} />
          <NumberBuilding digit="0" x={0} onHover={onHover} />
          <NumberBuilding digit="4" x={4.3} onHover={onHover} />
        </group>
      </Float>
      <gridHelper args={[32, 32, '#16445a', '#0d2833']} position={[0, -3.1, 0]} />
      <ContactShadows position={[0, -3.05, 0]} opacity={0.75} scale={20} blur={2.8} far={10} color="#001018" />
      <Environment preset="city" environmentIntensity={0.25} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={10}
        maxDistance={18}
        minPolarAngle={Math.PI / 3.1}
        maxPolarAngle={Math.PI / 1.75}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.28}
        target={[0, 0, 0]}
      />
    </>
  )
}

export default function NotFoundPage() {
  const reducedMotion = useReducedMotion()
  const [hovering, setHovering] = useState(false)

  return (
    <section data-band="dark" className="relative min-h-[100svh] overflow-hidden bg-[#071116] text-bone">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_62%_42%,transparent_0,transparent_22%,rgba(7,17,22,.34)_58%,#071116_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="absolute inset-0 pt-20">
        <Canvas camera={{ position: [0, 1, 14], fov: 42 }} dpr={[1, 1.6]} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <Scene reducedMotion={reducedMotion} onHover={setHovering} />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute bottom-8 right-8 z-20 hidden items-center gap-3 font-body text-[11px] uppercase tracking-[0.16em] text-bone/45 md:flex">
        {hovering ? <HandGrabbing className="size-4 text-accent" /> : <CursorClick className="size-4" />}
        {hovering ? 'Drag to inspect' : 'Hover - drag - zoom'}
      </div>
    </section>
  )
}
