import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SCENERY_HEX, unitStatusMeta } from '../../lib/unitStatus'
import { meshUnitLabel, unitsByMeshName } from '../../lib/units'
import { prefersReducedMotion } from '../../lib/webgl'

// This whole module lands in its own lazy chunk — three + fiber + drei is
// ~600KB gzipped and must never touch the main bundle. Nothing here is
// imported statically by anything a first paint depends on.

const ISO_AZIMUTH = Math.PI / 4
const ISO_POLAR = THREE.MathUtils.degToRad(58)

// Must not start with the unit prefix, or the merged block would be mistaken
// for a leasable unit and turn up in the admin's unmatched list.
const MERGED_SCENERY = 'merged-scenery'

/**
 * Collapses every non-unit mesh into a single geometry sharing one material.
 *
 * A site model carries far more scenery than units — parking bays, kerbs,
 * roads, landscaping — and because status colour is per-unit, every mesh
 * otherwise needs its own material and therefore its own draw call. Several
 * hundred draw calls of static ground is the difference between an orbit that
 * glides and one that stutters, and none of that geometry is interactive.
 *
 * Only meshes named `unit-*` stay individually addressable. That partition is
 * by *name*, not by whether the name resolved to a unit, so an unmatched
 * `unit-311` survives for the admin to bind and merging never has to re-run
 * when unit data changes.
 *
 * Returns null on any problem; the caller then keeps the scene as it was. A
 * merge that fails should cost performance, never correctness.
 */
function mergeScenery(meshes) {
  const scratch = []
  try {
    for (const mesh of meshes) {
      const source = mesh.geometry
      const position = source?.getAttribute('position')
      if (!position) return null

      // Rebuilt with only position and normal: models in the wild carry
      // inconsistent attribute sets (some meshes with UVs, some without) and
      // mergeGeometries refuses to merge those. Nothing here is textured, so
      // there is nothing to lose.
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', position.clone())
      const normal = source.getAttribute('normal')
      if (normal) geometry.setAttribute('normal', normal.clone())
      if (source.index) geometry.setIndex(source.index.clone())
      geometry.applyMatrix4(mesh.matrixWorld)
      if (!normal) geometry.computeVertexNormals()
      scratch.push(geometry)
    }

    // mergeGeometries needs every input to agree on being indexed or not.
    const allIndexed = scratch.every((geometry) => geometry.index)
    const prepared = allIndexed ? scratch : scratch.map((g) => (g.index ? g.toNonIndexed() : g))
    const merged = mergeGeometries(prepared, false)

    for (const geometry of prepared) if (geometry !== merged) geometry.dispose()
    if (!merged) return null

    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial())
    mesh.name = MERGED_SCENERY
    mesh.matrixAutoUpdate = false
    return mesh
  } catch {
    for (const geometry of scratch) geometry.dispose()
    return null
  }
}

/* ── model ─────────────────────────────────────────────────────────────── */

function Model({ url, units, bindings, selectedIndex, hoveredName, statusFilter, showLabels, flaggedMeshes, onHover, onSelect, onMeshClick, onReady, onFrames }) {
  const { scene } = useGLTF(url, '/draco/')
  const invalidate = useThree((state) => state.invalidate)

  // Cloned because useGLTF caches the source scene globally — mutating it
  // would leak this building's status colours into every other viewer.
  const meshes = useMemo(() => {
    const root = scene.clone(true)
    root.updateMatrixWorld(true)

    const unitMeshes = []
    const sceneryMeshes = []
    root.traverse((object) => {
      if (!object.isMesh) return
      ;(meshUnitLabel(object.name) === null ? sceneryMeshes : unitMeshes).push(object)
    })

    const merged = sceneryMeshes.length > 1 ? mergeScenery(sceneryMeshes) : null
    if (merged) {
      for (const mesh of sceneryMeshes) mesh.removeFromParent()
      root.add(merged)
    }

    return {
      root,
      list: merged ? [...unitMeshes, merged] : [...unitMeshes, ...sceneryMeshes],
      merged,
      mergedFrom: merged ? sceneryMeshes.length : 0,
    }
  }, [scene])

  // The merged geometry is built here rather than loaded, so nothing else will
  // free it.
  useEffect(() => () => meshes.merged?.geometry.dispose(), [meshes])

  const unitByMesh = useMemo(
    () => unitsByMeshName(meshes.list.map((mesh) => mesh.name), units, bindings),
    [meshes, units, bindings],
  )

  // Every mesh gets its own material. The model's own materials are discarded
  // outright: the massing aesthetic is flat colour, and colour is owned by
  // live status data, not by whatever the modeller happened to assign.
  useLayoutEffect(() => {
    const created = meshes.list.map((mesh) => {
      const material = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 })
      mesh.material = material
      mesh.castShadow = false
      mesh.receiveShadow = false
      return material
    })
    return () => created.forEach((material) => material.dispose())
  }, [meshes])

  useLayoutEffect(() => {
    for (const mesh of meshes.list) {
      const unit = unitByMesh.get(mesh.name)
      const material = mesh.material
      if (!material) continue

      if (!unit) {
        // Admin only: meshes named `unit-*` that resolve to nothing are lit up
        // so the admin can see which shape needs binding instead of hunting
        // for it by name.
        const flagged = flaggedMeshes?.has(mesh.name)
        material.color.set(flagged ? '#fca42e' : SCENERY_HEX)
        material.emissive.set(flagged ? '#fca42e' : '#000000')
        material.emissiveIntensity = flagged ? 0.35 : 0
        continue
      }

      const meta = unitStatusMeta(unit.status)
      const excluded = statusFilter && unit.status !== statusFilter
      const isSelected = unit.index === selectedIndex
      const isHovered = mesh.name === hoveredName

      material.color.set(excluded ? meta.mutedHex : meta.hex)
      material.emissive.set(isSelected || isHovered ? meta.hex : '#000000')
      material.emissiveIntensity = isSelected ? 0.5 : isHovered ? 0.28 : 0
    }
    invalidate()
  }, [meshes, unitByMesh, selectedIndex, hoveredName, statusFilter, flaggedMeshes, invalidate])

  // Deliberately split from the frames effect below. Bounds drive the default
  // camera framing, so they must change only when the *model* changes — if
  // they were recomputed whenever unit data changed, every status edit or
  // binding change in the admin would yank the camera back to default
  // mid-flow.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(meshes.root)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    onReady?.({
      meshNames: meshes.list.map((mesh) => mesh.name),
      bounds: { center: sphere.center.toArray(), radius: Math.max(sphere.radius, 1) },
    })
  }, [meshes, onReady])

  // Per-unit framing targets. These legitimately follow the unit data, since
  // a newly bound shape needs a frame the moment it is bound.
  useEffect(() => {
    const frames = new Map()
    for (const [name, unit] of unitByMesh) {
      const mesh = meshes.list.find((m) => m.name === name)
      if (!mesh) continue
      const sphere = new THREE.Box3().setFromObject(mesh).getBoundingSphere(new THREE.Sphere())
      frames.set(unit.index, { center: sphere.center.toArray(), radius: Math.max(sphere.radius, 0.5) })
    }
    onFrames?.(frames)
  }, [meshes, unitByMesh, onFrames])

  const labels = useMemo(() => {
    if (!showLabels) return []
    const points = []
    for (const [name, unit] of unitByMesh) {
      const mesh = meshes.list.find((m) => m.name === name)
      if (!mesh) continue
      const box = new THREE.Box3().setFromObject(mesh)
      const center = box.getCenter(new THREE.Vector3())
      points.push({ unit, position: [center.x, box.max.y + 0.35, center.z] })
    }
    return points
  }, [showLabels, unitByMesh, meshes])

  const pick = (event) => unitByMesh.get(event.object.name) ?? null

  return (
    <group>
      <primitive
        object={meshes.root}
        onPointerMove={(event) => {
          // While a mouse button is held the user is orbitting or panning, not
          // hovering. Raycasting the whole scene on every move of a drag —
          // and re-rendering React for each hit — is enough to make the
          // rotation itself feel like it is stuttering.
          if (event.buttons !== 0) {
            onHover(null)
            return
          }

          const unit = pick(event)
          // Scenery in front of a unit correctly clears the hover rather than
          // letting the unit behind it stay lit.
          if (!unit) {
            onHover(null)
            return
          }
          event.stopPropagation()
          onHover({ name: event.object.name, unit, clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY })
        }}
        onPointerOut={() => onHover(null)}
        onClick={(event) => {
          const unit = pick(event)
          if (!unit) {
            // Admin click-to-bind: mirrors the arm-then-click pattern the 2D
            // pin picker already uses, so an admin who can place a pin
            // already knows how to bind a shape.
            if (onMeshClick) {
              event.stopPropagation()
              onMeshClick(event.object.name)
            }
            return
          }
          event.stopPropagation()
          onSelect(unit.index)
        }}
      />

      {labels.map(({ unit, position }) => (
        <Html
          key={unit.index}
          position={position}
          center
          // drei defaults these to a z-index of 16,777,271, which paints over
          // the navbar and the mobile nav overlay. Kept low here, and the
          // viewer container isolates its own stacking context as a backstop.
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="whitespace-nowrap rounded-full bg-void/85 px-2 py-0.5 font-body text-[10px] font-bold tracking-[0.08em] text-bone">
            {unit.label}
          </span>
        </Html>
      ))}
    </group>
  )
}

/* ── camera ────────────────────────────────────────────────────────────── */

function CameraRig({ bounds, focus, mode, resetSignal, onDragStart, onDragEnd }) {
  const controls = useRef(null)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const goal = useRef({ target: new THREE.Vector3(), distance: 0, active: false })

  const frameDefault = useCallback(() => {
    if (!bounds || !controls.current) return
    const target = new THREE.Vector3(...bounds.center)
    controls.current.target.copy(target)

    if (mode === '2d') {
      camera.position.set(target.x, target.y + bounds.radius * 4, target.z + 0.001)
      camera.zoom = Math.min(size.width, size.height) / (bounds.radius * 2.4)
      camera.updateProjectionMatrix()
    } else {
      const fov = THREE.MathUtils.degToRad(camera.fov ?? 45)
      const distance = (bounds.radius / Math.sin(fov / 2)) * 1.05
      camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(distance, ISO_POLAR, ISO_AZIMUTH))
    }

    goal.current.active = false
    controls.current.update()
    invalidate()
  }, [bounds, camera, size, mode, invalidate])

  const frameDefaultRef = useRef(frameDefault)
  frameDefaultRef.current = frameDefault

  // Deliberately NOT depending on `frameDefault`: it closes over the canvas
  // size, so every resize — a scrollbar appearing, entering fullscreen, a
  // phone rotating — used to re-run this and snap the camera back to default,
  // which reads as the view zooming out on its own.
  useEffect(() => {
    frameDefaultRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, mode, resetSignal])

  // Framing a unit deliberately keeps the viewer's current orbit angle and
  // only moves the target and distance. Snapping to a canonical angle throws
  // away the orientation they just chose, which reads as the app fighting them.
  useEffect(() => {
    if (!focus || !controls.current || mode === '2d') return
    const target = new THREE.Vector3(...focus.center)
    const distance = Math.max(focus.radius * 3.4, (bounds?.radius ?? 10) * 0.4)

    if (prefersReducedMotion()) {
      const direction = camera.position.clone().sub(controls.current.target).normalize()
      controls.current.target.copy(target)
      camera.position.copy(target).addScaledVector(direction, distance)
      controls.current.update()
    } else {
      goal.current = { target, distance, active: true }
    }
    invalidate()
  }, [focus, bounds, camera, mode, invalidate])

  // Damping needs a *continuous* stream of frames to decay smoothly, but
  // frameloop="demand" only draws when something asks it to. Without this,
  // orbit and zoom advance one frame per input event and then stall, which is
  // what makes them feel steppy rather than fluid. Each control change opens a
  // ~0.75s window of frames; once the user stops, the window closes and the
  // GPU goes fully idle again, so the render-on-demand budget still holds.
  const settle = useRef(0)

  // Memoised because drei re-subscribes the controls' event listeners whenever
  // these props change identity — inline arrows would tear down and re-add
  // them on every render.
  const cancelEasing = useCallback(() => {
    goal.current.active = false
    onDragStart?.()
  }, [onDragStart])
  const keepFramesComing = useCallback(() => {
    settle.current = 45
  }, [])

  useFrame(() => {
    const control = controls.current
    if (!control) return

    if (settle.current > 0) {
      settle.current -= 1
      invalidate()
    }

    if (!goal.current.active) return

    control.target.lerp(goal.current.target, 0.14)
    const direction = camera.position.clone().sub(control.target).normalize()
    const distance = THREE.MathUtils.lerp(camera.position.distanceTo(control.target), goal.current.distance, 0.14)
    camera.position.copy(control.target).addScaledVector(direction, distance)
    control.update()

    if (control.target.distanceTo(goal.current.target) < 0.02 && Math.abs(distance - goal.current.distance) < 0.02) {
      goal.current.active = false
    }
    invalidate()
  })

  const radius = bounds?.radius ?? 10

  return (
    <OrbitControls
      key={mode}
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      zoomToCursor
      enableRotate={mode === '3d'}
      screenSpacePanning={false}
      // The moment the user touches the controls, abandon any in-flight camera
      // easing. Otherwise selecting a unit and then immediately grabbing to
      // rotate leaves the easing still pulling distance toward its goal every
      // frame — which feels exactly like the view zooming itself out from
      // under you.
      onStart={cancelEasing}
      onEnd={onDragEnd}
      onChange={keepFramesComing}
      // Clamped so the camera can never end up beneath the site looking up
      // through the ground, which is disorienting and impossible to recover
      // from without the reset button.
      minPolarAngle={mode === '2d' ? 0 : 0.15}
      maxPolarAngle={mode === '2d' ? 0 : THREE.MathUtils.degToRad(80)}
      // Wide enough that there is real travel in both directions: the default
      // framing sits at ~2.9x radius, so the old 4x ceiling gave almost no
      // room to pull back.
      minDistance={radius * 0.4}
      maxDistance={radius * 6}
    />
  )
}

/* ── failure handling ──────────────────────────────────────────────────── */

class ModelErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/* ── viewer ────────────────────────────────────────────────────────────── */

export default function ModelViewer({
  url,
  units,
  bindings,
  selectedIndex,
  onSelect,
  statusFilter,
  flaggedMeshes,
  onMeshClick,
  onModelReady,
  onCaptureReady,
  onError,
  height = 'h-[420px] md:h-[560px]',
}) {
  const containerRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [showLabels, setShowLabels] = useState(true)
  const [mode, setMode] = useState('3d')
  const [resetSignal, setResetSignal] = useState(0)
  const [frames, setFrames] = useState(null)
  const [bounds, setBounds] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dragging, setDragging] = useState(false)

  // `frameloop="demand"` is the right idle behaviour but the wrong interactive
  // one: it draws one frame per input event, so damped orbit advances in steps
  // instead of gliding. While the pointer is over the viewer we run a real
  // 60fps loop, and drop back to demand a beat after it leaves — so the GPU
  // still goes fully idle for a visitor who is only scrolling past.
  const [live, setLive] = useState(false)
  const idleTimer = useRef(null)

  const wake = useCallback(() => {
    clearTimeout(idleTimer.current)
    setLive(true)
  }, [])

  const sleepSoon = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setLive(false), 1200)
  }, [])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  // A drag that starts inside the viewer keeps the loop live even if the
  // pointer wanders outside it mid-gesture.
  const startDrag = useCallback(() => {
    wake()
    setDragging(true)
    setHovered(null)
  }, [wake])

  const endDrag = useCallback(() => {
    setDragging(false)
    sleepSoon()
  }, [sleepSoon])

  const handleReady = useCallback(
    (payload) => {
      setBounds(payload.bounds)
      onModelReady?.(payload.meshNames)
    },
    [onModelReady],
  )

  const focus = selectedIndex != null && frames ? frames.get(selectedIndex) : null

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else containerRef.current?.requestFullscreen?.()
  }

  const chip = useMemo(() => {
    if (!hovered || !containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return {
      unit: hovered.unit,
      left: hovered.clientX - rect.left,
      top: hovered.clientY - rect.top,
    }
  }, [hovered])

  return (
    <div
      ref={containerRef}
      // The site runs Lenis smooth scroll, which swallows wheel and touch
      // events globally — so a wheel over the model scrolled the page instead
      // of zooming, and the scroll animation competed with the render loop for
      // the main thread, which is a large part of why orbiting felt heavy.
      // `data-lenis-prevent` makes Lenis ignore gestures that start in here.
      data-lenis-prevent
      onPointerEnter={wake}
      onPointerLeave={sleepSoon}
      // `touch-action: none` stops a touch drag from panning the page, and
      // `overscroll-contain` stops a wheel that reaches the end of the model's
      // zoom range from chaining out to the document.
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      // `isolate` is load-bearing, not cosmetic: `relative` alone leaves
      // z-index:auto, so descendants compete with the whole page. Isolating
      // means nothing inside the viewer can ever paint over the navbar or the
      // mobile nav overlay, whatever z-index a library reaches for.
      className={`relative isolate overflow-hidden rounded-2xl border border-[var(--color-line)] bg-surface-alt ${isFullscreen ? 'h-screen' : height}`}
    >
      <Canvas
        frameloop={live ? 'always' : 'demand'}
        dpr={[1, 1.6]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          // Transparent, so the panel's ground is the container's `bg-surface-alt`
          // and follows the theme. Opaque was cheaper, but it clears to black
          // whatever the CSS says — the reason an earlier attempt to light this
          // panel by restyling the wrapper had no visible effect at all.
          alpha: true,
          stencil: false,
          // Only for the admin capture flow — keeping the drawing buffer around
          // costs memory and bandwidth on every frame, so visitors never pay it.
          preserveDrawingBuffer: Boolean(onCaptureReady),
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault()
            onError?.(new Error('WebGL context lost'))
          })
          onCaptureReady?.(
            () => new Promise((resolve) => gl.domElement.toBlob(resolve, 'image/jpeg', 0.85)),
          )
        }}
      >
        {mode === '2d' ? (
          <OrthographicCamera makeDefault near={0.1} far={5000} />
        ) : (
          <PerspectiveCamera makeDefault fov={42} near={0.1} far={5000} />
        )}

        {/* No shadow maps. They are the single most expensive thing available
            and contribute nothing to flat massing — depth reads from the
            hemisphere gradient and the model's own baked AO. */}
        <hemisphereLight args={['#ffffff', '#4a5560', 1.15]} />
        <directionalLight position={[1, 2, 1.4]} intensity={1.5} />
        <directionalLight position={[-1.5, 1, -1]} intensity={0.4} />

        <ModelErrorBoundary onError={onError}>
          <Suspense fallback={null}>
            <Model
              url={url}
              units={units}
              bindings={bindings}
              selectedIndex={selectedIndex}
              hoveredName={hovered?.name ?? null}
              statusFilter={statusFilter}
              // Each drei <Html> label writes a CSS transform every frame.
              // Nine of them during a drag is real main-thread cost for
              // something you cannot read while the model is moving anyway.
              showLabels={showLabels && !dragging}
              flaggedMeshes={flaggedMeshes}
              onHover={setHovered}
              onSelect={onSelect}
              onMeshClick={onMeshClick}
              onReady={handleReady}
              onFrames={setFrames}
            />
          </Suspense>
        </ModelErrorBoundary>

        <CameraRig
          bounds={bounds}
          focus={focus}
          mode={mode}
          resetSignal={resetSignal}
          onDragStart={startDrag}
          onDragEnd={endDrag}
        />
      </Canvas>

      {/* Hover chip lives in the DOM rather than in the scene: it stays crisp
          at any zoom and costs nothing to render. Suppressed on touch, where
          there is no hover and the detail panel does this job. */}
      {chip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-[var(--color-line)] bg-surface/95 px-3 py-2 shadow-xl"
          style={{ left: chip.left, top: chip.top }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-sm ${unitStatusMeta(chip.unit.status).swatch}`} />
            <span className="font-display text-sm font-medium text-content">{chip.unit.label}</span>
          </div>
          <div className="mt-0.5 font-body text-[11px] text-content/55">
            {unitStatusMeta(chip.unit.status).label}
            {chip.unit.size ? ` · ${Number(String(chip.unit.size).replace(/[^\d.]/g, '')).toLocaleString()} sq ft` : ''}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5">
        <ViewerButton label="Toggle fullscreen" onClick={toggleFullscreen}>
          {isFullscreen ? '⤡' : '⤢'}
        </ViewerButton>
        <ViewerButton label="Recenter view" onClick={() => setResetSignal((n) => n + 1)}>
          ⌖
        </ViewerButton>
        <ViewerButton
          label={showLabels ? 'Hide unit labels' : 'Show unit labels'}
          active={showLabels}
          onClick={() => setShowLabels((v) => !v)}
        >
          ⌗
        </ViewerButton>
        <ViewerButton
          label={mode === '3d' ? 'Switch to plan view' : 'Switch to 3D view'}
          active={mode === '2d'}
          onClick={() => setMode((m) => (m === '3d' ? '2d' : '3d'))}
        >
          <span className="text-[10px] font-bold">{mode === '3d' ? '2D' : '3D'}</span>
        </ViewerButton>
      </div>
    </div>
  )
}

function ViewerButton({ children, label, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex size-11 items-center justify-center rounded-lg border text-sm backdrop-blur transition-colors duration-200 ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-[var(--color-line)] bg-surface/80 text-content/70 hover:border-content/35 hover:text-content'
      }`}
    >
      {children}
    </button>
  )
}
