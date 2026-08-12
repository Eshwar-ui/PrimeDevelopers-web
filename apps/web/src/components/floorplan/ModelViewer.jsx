import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, OrthographicCamera, PerspectiveCamera, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SCENERY_HEX, unitStatusMeta } from '../../lib/unitStatus'
import { groupBySharedVertices, meshUnitLabel, unitsByMeshName } from '../../lib/units'
import { prefersReducedMotion } from '../../lib/webgl'
import { useTheme } from '../../context/ThemeContext'

// This whole module lands in its own lazy chunk — three + fiber + drei is
// ~600KB gzipped and must never touch the main bundle. Nothing here is
// imported statically by anything a first paint depends on.

const ISO_AZIMUTH = Math.PI / 4
const ISO_POLAR = THREE.MathUtils.degToRad(58)

// Must not start with the unit prefix, or the merged block would be mistaken
// for a leasable unit and turn up in the admin's unmatched list.
const MERGED_SCENERY = 'merged-scenery'

// A shared constant, not a `= []` default. A fresh literal per render would
// change identity every time, and selection identity is what the material and
// framing effects key on — they would re-run on every render of any caller
// that does not pass a selection at all, which is the admin.
const NO_SELECTION = []

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

function Model({ url, units, bindings, rotation, selected, hoveredName, statusFilter, showLabels, flaggedMeshes, onHover, onSelect, onMeshClick, onReady, onFrames, onFacings }) {
  const { scene } = useGLTF(url, '/draco/')
  const invalidate = useThree((state) => state.invalidate)

  // Read as a boolean rather than taking the camera itself: this only decides
  // how labels are sized, and subscribing to the camera object would re-render
  // the whole model on any camera change.
  const isOrthographic = useThree((state) => state.camera.isOrthographicCamera === true)

  // Binding needs every shape to stay individually addressable; visitors need
  // the opposite. Derived as a boolean rather than depending on the callback
  // itself, whose identity changes on every arm/disarm and would rebuild the
  // whole scene graph mid-flow.
  const bindingMode = Boolean(onMeshClick)

  // Cloned because useGLTF caches the source scene globally — mutating it
  // would leak this building's status colours into every other viewer.
  const meshes = useMemo(() => {
    const root = scene.clone(true)
    root.updateMatrixWorld(true)

    // A mesh is addressable if it claims a unit by name *or* an admin has bound
    // it to one. The binding half is what makes converter output work at all:
    // those files name every object `Node1`, `Node2`… so no mesh can claim a
    // unit by name, and without this every one of them would be swept into the
    // merged scenery below — where it has no material of its own, cannot be
    // raycast, and so renders grey and ignores clicks. Binding then appeared to
    // work in the admin (which skips merging) and silently do nothing for
    // visitors, which is exactly backwards.
    const bound = new Set(Object.keys(bindings ?? {}).map((name) => name.trim().toLowerCase()))
    const isAddressable = (mesh) =>
      meshUnitLabel(mesh.name) !== null || bound.has(String(mesh.name ?? '').trim().toLowerCase())

    const unitMeshes = []
    const sceneryMeshes = []
    root.traverse((object) => {
      if (!object.isMesh) return
      ;(isAddressable(object) ? unitMeshes : sceneryMeshes).push(object)
    })

    // Bounds are recomputed from the actual vertex data before anything reads
    // them. GLTFLoader does not measure the geometry — it copies the bounding
    // box straight from each accessor's declared `min`/`max`, and the client's
    // CAD converter writes those in the *pre-conversion* Z-up space while
    // exporting the vertices already rotated to Y-up. Every reader downstream
    // (orientation detection, camera framing, per-unit focus, label placement)
    // would otherwise be working from a box that describes a model this file
    // does not contain: the site reads as 1678 x 2100 x 120 when it is really
    // 1678 x 120 x 2100, which tips the building onto its edge and aims the
    // camera at empty space.
    //
    // Geometry is shared with useGLTF's cached scene (clone does not copy it),
    // so this repairs the cache too — which is what we want, and is idempotent.
    for (const mesh of [...unitMeshes, ...sceneryMeshes]) {
      mesh.geometry?.computeBoundingBox()
      mesh.geometry?.computeBoundingSphere()
    }

    // Orientation. These are massing models — a footprint pushed straight up —
    // so the extrusion axis is the one whose extent is far shorter than either
    // of the other two, and the model sits on it at zero. Which axis that is
    // varies by exporter: the same converter emits Z-up for some files and
    // Y-up for others, and writes no orientation hint either way. A model that
    // does not match this shape is left alone and assumed Y-up.
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const extent = [size.x, size.y, size.z]
    const shortest = extent.indexOf(Math.min(...extent))
    const flanking = [0, 1, 2].filter((axis) => axis !== shortest)
    const isExtrusion =
      extent[shortest] > 0 &&
      extent[shortest] < Math.min(extent[flanking[0]], extent[flanking[1]]) / 2 &&
      Math.abs(box.min.getComponent(shortest)) < extent[shortest] * 0.05

    // Only a genuine Z-up file gets rotated. Rotating one that is already Y-up
    // is what stands the building on its edge.
    const upAxis = isExtrusion ? shortest : 1
    const zUp = upAxis === 2
    const planAxes = [0, 1, 2].filter((axis) => axis !== upAxis)

    // Blocks. A unit arrives as a dozen loose wall panels, so tapping has to
    // resolve to the whole connected block or it would tag a sliver of wall.
    // Keyed on the two *plan* axes — keying on the extrusion axis instead
    // collapses the model, since every wall in the building spans the same
    // floor-to-roof range and so shares a key with every other wall.
    const [planA, planB] = planAxes.map((axis) => 'xyz'[axis])
    const siteArea = extent[planAxes[0]] * extent[planAxes[1]]
    // A slab covering most of the site — the ground plane, a podium roof —
    // touches every unit and would fuse the whole model into one block.
    // Measured by footprint rather than proxied by vertex count, so a unit's
    // own floor and ceiling still join their block and light up with it.
    const SPAN_FRACTION = 0.6
    const grouped = []
    for (const mesh of sceneryMeshes) {
      const position = mesh.geometry?.getAttribute('position')
      if (!position) continue
      const keys = new Set()
      const v = new THREE.Vector3()
      let minA = Infinity
      let maxA = -Infinity
      let minB = Infinity
      let maxB = -Infinity
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
        const a = v[planA]
        const b = v[planB]
        if (a < minA) minA = a
        if (a > maxA) maxA = a
        if (b < minB) minB = b
        if (b > maxB) maxB = b
        keys.add(`${a.toFixed(2)}|${b.toFixed(2)}`)
      }
      if (siteArea > 0 && (maxA - minA) * (maxB - minB) > siteArea * SPAN_FRACTION) continue
      grouped.push({ name: mesh.name, keys })
    }
    const groupOf = groupBySharedVertices(grouped)
    const membersOf = new Map()
    for (const [name, gid] of groupOf) {
      if (!membersOf.has(gid)) membersOf.set(gid, [])
      membersOf.get(gid).push(name)
    }

    // Merging collapses the scenery into one object, which is right for a
    // visitor (one draw call instead of hundreds) and fatal while binding —
    // the individual shapes stop existing, so there is nothing left to click.
    const merged = !bindingMode && sceneryMeshes.length > 1 ? mergeScenery(sceneryMeshes) : null
    if (merged) {
      for (const mesh of sceneryMeshes) mesh.removeFromParent()
      root.add(merged)
    }

    // Applied to a wrapper, never to `root` itself: mergeScenery bakes each
    // mesh's matrixWorld into the merged geometry and parents the result back
    // under root, so a transform on root would land on that geometry twice.
    const stage = new THREE.Group()
    stage.add(root)
    if (zUp) stage.rotation.x = -Math.PI / 2
    // The admin's orientation, applied as a transform on the wrapper — never
    // to the geometry. The uploaded .glb is displayed exactly as delivered;
    // this only decides which way it faces on screen, and clearing the setting
    // puts it back where it was. Applied on the outer wrapper's Y so it stays
    // a turn about the *world* up whether or not the file needed the Z-up fix.
    const orientation = new THREE.Group()
    orientation.rotation.y = THREE.MathUtils.degToRad(rotation ?? 0)
    orientation.add(stage)
    orientation.updateMatrixWorld(true)

    return {
      root: orientation,
      list: merged ? [...unitMeshes, merged] : [...unitMeshes, ...sceneryMeshes],
      merged,
      zUp,
      groupOf,
      membersOf,
    }
    // `bindings` decides which meshes survive merging and `rotation` is baked
    // into the wrapper the bounds are measured from, so the scene graph has to
    // be rebuilt when either changes. Callers memoise `bindings` (a fresh
    // object every render would rebuild the graph continuously).
  }, [scene, bindingMode, bindings, rotation])

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
        // While binding, the block under the cursor lights up too. Whole block,
        // not the single panel: highlighting one wall of a shop would not tell
        // the admin what a tap is about to tag.
        const hoveredGroup = hoveredName ? meshes.groupOf.get(hoveredName) : undefined
        const isHovered =
          bindingMode &&
          hoveredName != null &&
          (mesh.name === hoveredName ||
            (hoveredGroup !== undefined && meshes.groupOf.get(mesh.name) === hoveredGroup))
        material.color.set(flagged ? '#fca42e' : SCENERY_HEX)
        material.emissive.set(flagged || isHovered ? '#fca42e' : '#000000')
        material.emissiveIntensity = flagged ? 0.35 : isHovered ? 0.55 : 0
        continue
      }

      const meta = unitStatusMeta(unit.status)
      const excluded = statusFilter && unit.status !== statusFilter
      const isSelected = selected.has(unit.index)
      const isHovered = mesh.name === hoveredName

      material.color.set(excluded ? meta.mutedHex : meta.hex)
      material.emissive.set(isSelected || isHovered ? meta.hex : '#000000')
      material.emissiveIntensity = isSelected ? 0.5 : isHovered ? 0.28 : 0
    }
    invalidate()
  }, [meshes, unitByMesh, selected, hoveredName, statusFilter, flaggedMeshes, bindingMode, invalidate])

  // Deliberately split from the frames effect below. Bounds drive the default
  // camera framing, so they must change only when the *model* changes — if
  // they were recomputed whenever unit data changed, every status edit or
  // binding change in the admin would yank the camera back to default
  // mid-flow.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(meshes.root)
    const sphere = box.getBoundingSphere(new THREE.Sphere())

    // The site's own box, measured with the orientation momentarily undone.
    // An axis-aligned box around a *turned* building is bigger than the
    // building and no longer follows its edges, so an apron sized from it
    // stops hugging the site the moment an orientation is set. Measuring
    // square to the building and then turning the apron with it keeps the plot
    // the same shape at every orientation.
    const turn = meshes.root.rotation.y
    meshes.root.rotation.y = 0
    meshes.root.updateMatrixWorld(true)
    const localBox = new THREE.Box3().setFromObject(meshes.root)
    meshes.root.rotation.y = turn
    meshes.root.updateMatrixWorld(true)

    onReady?.({
      meshNames: meshes.list.map((mesh) => mesh.name),
      bounds: {
        center: sphere.center.toArray(),
        radius: Math.max(sphere.radius, 1),
        turn,
        local: { min: localBox.min.toArray(), max: localBox.max.toArray() },
        // The box as well as the sphere: framing only needs a radius, but the
        // ground platform has to sit on the site's actual base and the pan
        // limits have to follow its actual footprint. A sphere around a long
        // thin site would put both in the wrong place.
        box: { min: box.min.toArray(), max: box.max.toArray() },
      },
    })
  }, [meshes, onReady])

  // Per-unit framing targets. These legitimately follow the unit data, since
  // a newly bound shape needs a frame the moment it is bound.
  useEffect(() => {
    // Unioned across the unit's whole block for the same reason as the labels:
    // framing a single wall panel of a shop flies the camera into the wall
    // instead of showing the shop.
    const boxes = new Map()
    for (const [name, unit] of unitByMesh) {
      const mesh = meshes.list.find((m) => m.name === name)
      if (!mesh) continue
      const box = new THREE.Box3().setFromObject(mesh)
      const existing = boxes.get(unit.index)
      if (existing) existing.union(box)
      else boxes.set(unit.index, box)
    }
    const frames = new Map()
    for (const [index, box] of boxes) {
      const sphere = box.getBoundingSphere(new THREE.Sphere())
      frames.set(index, { center: sphere.center.toArray(), radius: Math.max(sphere.radius, 0.5) })
    }
    onFrames?.(frames)

    // Which way each unit looks out.
    //
    // Derived from where the unit sits relative to the whole building, not
    // from wall normals: these are massing blocks whose walls are unwelded
    // zero-thickness planes with unreliable winding, so a normal is as likely
    // to point into the building as out of it. For a terrace — which is what
    // every one of these buildings is — the offset from the centre is exactly
    // the right answer, and it degrades honestly: a unit sitting dead centre
    // reports no aspect at all rather than a made-up one.
    const site = new THREE.Box3().setFromObject(meshes.root).getCenter(new THREE.Vector3())
    const span = new THREE.Box3().setFromObject(meshes.root).getSize(new THREE.Vector3())
    const reach = Math.max(span.x, span.z)
    const facings = new Map()
    for (const [index, box] of boxes) {
      const centre = box.getCenter(new THREE.Vector3())
      const dx = centre.x - site.x
      const dz = centre.z - site.z
      // Ignore an offset too small to mean anything — at the centre of a
      // building every direction is equally wrong.
      if (reach <= 0 || Math.hypot(dx, dz) < reach * 0.06) continue
      // Screen-up in plan view is -Z, and the admin turns the model until that
      // is north, so a bearing off -Z is a compass bearing.
      const bearing = (THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)) + 360) % 360
      facings.set(index, bearing)
    }
    onFacings?.(facings)
  }, [meshes, unitByMesh, onFrames, onFacings])

  // One label per *unit*, not per mesh. A unit bound by block owns a dozen or
  // more wall panels, and labelling each of them buries the model under a heap
  // of identical overlapping pills. The label belongs at the centre of the
  // whole block, so the boxes are unioned before a position is taken.
  const labels = useMemo(() => {
    if (!showLabels) return []
    const boxes = new Map()
    for (const [name, unit] of unitByMesh) {
      const mesh = meshes.list.find((m) => m.name === name)
      if (!mesh) continue
      const box = new THREE.Box3().setFromObject(mesh)
      const existing = boxes.get(unit.index)
      if (existing) existing.box.union(box)
      else boxes.set(unit.index, { unit, box })
    }
    // Lifted clear of the roof by a fraction of the block's own height rather
    // than a fixed 0.35. Model units vary by three orders of magnitude between
    // exports — 0.35 is a comfortable gap in a metres-scale model and invisible
    // in this one, where a unit is 120 tall — so the label sat *on* the roof and
    // read as part of the geometry.
    return [...boxes.values()].map(({ unit, box }) => {
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const lift = Math.max(size.y * 0.25, 0.35)
      return { unit, position: [center.x, box.max.y + lift, center.z] }
    })
  }, [showLabels, unitByMesh, meshes])

  const pick = (event) => unitByMesh.get(event.object.name) ?? null

  // Occlusion tests raycast against this subtree.
  const modelRef = useRef(null)

  // drei scales an <Html> by `distanceFactor / distance`, so the factor has to
  // be in the model's own units or labels come out microscopic in a model
  // measured in millimetres and enormous in one measured in metres. Tied to the
  // default camera distance (~3x the bounding radius) so a label is close to
  // its natural size in the view the viewer opens at.
  const labelDistance = useMemo(() => {
    const sphere = new THREE.Box3().setFromObject(meshes.root).getBoundingSphere(new THREE.Sphere())
    return Math.max(sphere.radius * 3, 1)
  }, [meshes])

  // The label pills, by unit index, so the declutter pass can hide them
  // without React re-rendering the model.
  const labelNodes = useRef(new Map())

  // The hovered *unit*, not the hovered mesh — a label belongs to a unit, and
  // hovering any panel of a block should protect that block's label.
  const hoveredUnitIndex = hoveredName ? (unitByMesh.get(hoveredName)?.index ?? null) : null

  return (
    <group>
      <primitive
        ref={modelRef}
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
          // letting the unit behind it stay lit — except while binding, where
          // the whole point is to see which unnamed shape is under the cursor.
          // `unit: null` marks it as a highlight with no tooltip.
          if (!unit) {
            if (bindingMode) {
              event.stopPropagation()
              onHover({
                name: event.object.name,
                unit: null,
                clientX: event.nativeEvent.clientX,
                clientY: event.nativeEvent.clientY,
              })
              return
            }
            onHover(null)
            return
          }
          event.stopPropagation()
          onHover({ name: event.object.name, unit, clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY })
        }}
        onPointerOut={() => onHover(null)}
        onClick={(event) => {
          const unit = pick(event)
          if (unit) {
            event.stopPropagation()
            // Whether the tap *asked* to be additive. Whether it actually is
            // additive is the section's call — it owns compare mode, which
            // this viewer deliberately knows nothing about.
            const native = event.nativeEvent
            onSelect(unit.index, native.shiftKey || native.metaKey || native.ctrlKey)
            return
          }
          // Admin click-to-bind: mirrors the arm-then-click pattern the 2D
          // pin picker already uses, so an admin who can place a pin already
          // knows how to bind a shape.
          if (onMeshClick) {
            event.stopPropagation()
            // The whole connected block, so one tap tags the shop rather than
            // the one wall panel the ray happened to hit. Falls back to the
            // single mesh when the geometry has no separable block — a
            // building modelled as one continuous outline.
            const gid = meshes.groupOf.get(event.object.name)
            const block = (gid !== undefined && meshes.membersOf.get(gid)) || [event.object.name]
            onMeshClick(event.object.name, block)
          }
        }}
      />

      {labels.map(({ unit, position }) => (
        <Html
          key={unit.index}
          position={position}
          center
          // Hidden while the block it names is behind other geometry. Without
          // this every label draws on top of everything, so labels from blocks
          // at the back of the site float over blocks at the front — which
          // reads as the numbering being scrambled, since the label you see
          // over a block is often not that block's label.
          occlude={[modelRef]}
          // Labels shrink with distance instead of staying a fixed screen size.
          // At a fixed size a far label competes with a near one for attention;
          // scaling them makes each read as belonging to its own block.
          //
          // Perspective only. drei scales an <Html> by `distanceFactor / distance`
          // under a perspective camera but by `distanceFactor * camera.zoom`
          // under an orthographic one, and this factor is in world units — in
          // plan view that multiplied out to roughly 700x, so a single unit
          // number filled the whole viewer. Dropping it there is also simply
          // correct: a plan is orthographic, every block is equidistant, and
          // equidistant labels belong at one screen size.
          distanceFactor={isOrthographic ? undefined : labelDistance}
          // drei defaults these to a z-index of 16,777,271, which paints over
          // the navbar and the mobile nav overlay. Kept low here, and the
          // viewer container isolates its own stacking context as a backstop.
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            ref={(node) => {
              if (node) labelNodes.current.set(unit.index, node)
              else labelNodes.current.delete(unit.index)
            }}
            className="whitespace-nowrap rounded-full bg-void/85 px-2 py-0.5 font-body text-[10px] font-bold tracking-[0.08em] text-bone"
          >
            {unit.label}
          </span>
        </Html>
      ))}

      {showLabels && (
        <LabelDeclutter
          labels={labels}
          nodes={labelNodes}
          selected={selected}
          hoveredIndex={hoveredUnitIndex}
          distanceFactor={isOrthographic ? null : labelDistance}
        />
      )}
    </group>
  )
}

/* ── labels ────────────────────────────────────────────────────────────── */

/**
 * Hides unit labels that would land on top of each other.
 *
 * Twenty units in a terrace put twenty pills within a few hundred pixels, and
 * every one of them overlapped its neighbours — the numbers became a smear
 * that was worse than no labels at all. There is no honest way to fit them, so
 * the ones that cannot be read are dropped and the rest stay legible.
 *
 * Two things make this cheap enough to run every frame. It writes `visibility`
 * straight to the DOM nodes instead of going through React, so an orbit does
 * not re-render the viewer sixty times a second; and it compares screen
 * positions rather than measuring rectangles, so it never forces a layout —
 * label size is computed from the one measurement taken on mount.
 */
function LabelDeclutter({ labels, nodes, selected, hoveredIndex, distanceFactor }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const point = useRef(new THREE.Vector3())

  useFrame(() => {
    if (!labels.length) return

    // Base pill size, measured once — every label is the same three-character
    // shape, and `offsetWidth` ignores the transform drei applies, so this is
    // the unscaled size and stays valid as the camera moves.
    const sample = nodes.current.get(labels[0].unit.index)
    if (!sample) return
    const baseWidth = sample.offsetWidth || 30
    const baseHeight = sample.offsetHeight || 16

    const placed = []
    // Selected first, then hovered, then nearest the camera: when two labels
    // collide the one the visitor is dealing with — or the one in front —
    // survives, which is the opposite of letting draw order decide.
    const ordered = labels
      .map((label) => {
        point.current.set(...label.position)
        const distance = camera.position.distanceTo(point.current)
        point.current.project(camera)
        return {
          index: label.unit.index,
          distance,
          x: ((point.current.x + 1) / 2) * size.width,
          y: ((1 - point.current.y) / 2) * size.height,
          behind: point.current.z > 1,
          rank:
            (selected.has(label.unit.index) ? 0 : hoveredIndex === label.unit.index ? 1 : 2) * 1e9 +
            distance,
        }
      })
      .sort((a, b) => a.rank - b.rank)

    for (const candidate of ordered) {
      const node = nodes.current.get(candidate.index)
      if (!node) continue

      // drei scales an <Html> by `distanceFactor / distance` under a
      // perspective camera and leaves it alone when no factor is given, which
      // is what plan view uses. Mirrored here so the collision box matches the
      // pill actually on screen at this distance.
      const scale = distanceFactor
        ? (1 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov ?? 45) / 2) * candidate.distance)) *
          distanceFactor
        : 1
      const halfWidth = (baseWidth * scale) / 2
      const halfHeight = (baseHeight * scale) / 2

      const clash =
        candidate.behind ||
        placed.some(
          (other) =>
            Math.abs(other.x - candidate.x) < halfWidth + other.halfWidth &&
            Math.abs(other.y - candidate.y) < halfHeight + other.halfHeight,
        )

      node.style.visibility = clash ? 'hidden' : 'visible'
      if (!clash) placed.push({ x: candidate.x, y: candidate.y, halfWidth, halfHeight })
    }
  })

  return null
}

/* ── compass ───────────────────────────────────────────────────────────── */

// North after the admin's orientation: screen-up in plan view, which is the
// direction they turn the model to match.
const NORTH = new THREE.Vector3(0, 0, -1)

/**
 * A compass that follows the camera.
 *
 * Written straight to the DOM node's transform from the render loop rather
 * than held in React state: the azimuth changes every frame of an orbit, and
 * re-rendering the whole viewer sixty times a second to spin a needle would
 * cost more than the model does.
 *
 * Only meaningful once an admin has said which way north is, so the caller
 * does not render it until then.
 */
function CompassNeedle({ dialRef, bounds }) {
  const camera = useThree((state) => state.camera)
  // Reused across frames — this runs every frame of an orbit, and three
  // vectors of garbage per frame is exactly the kind of allocation that shows
  // up as jitter on a mid-range phone.
  const base = useRef(new THREE.Vector3())
  const tip = useRef(new THREE.Vector3())

  useFrame(() => {
    const node = dialRef.current
    if (!node || !bounds) return
    // North projected into screen space, rather than derived from the camera's
    // azimuth: that would need special-casing for plan view, where the camera
    // looks straight down and its azimuth is degenerate. Projecting two points
    // and taking the angle between them is the same code for both cameras.
    //
    // The step is a fraction of the model so the two points stay far enough
    // apart to be numerically stable at this site's scale, where coordinates
    // run into the thousands.
    const step = Math.max(bounds.radius * 0.25, 1)
    base.current.set(...bounds.center)
    tip.current.copy(base.current).add(NORTH.clone().multiplyScalar(step))
    base.current.project(camera)
    tip.current.project(camera)
    // NDC y points up, CSS rotation runs clockwise from up — which is what
    // atan2(dx, dy) already gives.
    const dx = tip.current.x - base.current.x
    const dy = tip.current.y - base.current.y
    if (!dx && !dy) return
    node.style.transform = `rotate(${THREE.MathUtils.radToDeg(Math.atan2(dx, dy))}deg)`
  })
  return null
}

/* ── ground ────────────────────────────────────────────────────────────── */

/**
 * The platform the blocks stand on.
 *
 * The client's massing exports carry the buildings and nothing else — no site
 * slab, no podium — so the blocks hang in an empty void. That costs more than
 * looks: with no horizon in the frame, orbiting reads as the *model* spinning
 * rather than the camera moving around it, and a pan that carries the last
 * block off screen leaves nothing at all to navigate back by.
 *
 * Built here rather than merged into the model so it stays out of the bounding
 * box that frames the camera — an apron wider than the site would otherwise
 * pull the default view back and shrink the buildings inside it.
 */
/**
 * The apron the building stands on, and the survey grid ruled across it.
 *
 * Both colours are passed in rather than fixed, because the canvas is
 * transparent: whatever these are not covering is the container's own ground.
 * A slab dark enough to read as a site plan against the old dark page is a
 * black rectangle floating in the light one, which reads as a broken image
 * rather than as a drawing.
 *
 * The grid keeps roughly the same contrast against the apron in both, so the
 * plan reads as the same drawing rendered on different paper.
 */
const APRON = {
  dark: { slab: '#232a30', grid: '#4a555e' },
  // Light neutral paper with a considerably darker rule — the convention a
  // printed site plan already follows, and the reason this is not simply the
  // dark pair inverted.
  light: { slab: '#e4e7e9', grid: '#8a949c' },
}

function SiteGround({ bounds, dark = true }) {
  const apron = dark ? APRON.dark : APRON.light
  const site = useMemo(() => {
    // The square-to-the-building box, not the screen-aligned one — see the
    // note where it is measured.
    const min = bounds?.local?.min
    const max = bounds?.local?.max
    if (!min || !max || ![...min, ...max].every(Number.isFinite)) return null

    const spanX = max[0] - min[0]
    const spanZ = max[2] - min[2]
    const footprint = Math.max(spanX, spanZ)
    if (!(footprint > 0)) return null

    // The apron follows the site's own proportions rather than squaring it
    // off, and the setback is taken per axis rather than from the longer one.
    // A strip mall is three times longer than it is deep: a single setback
    // sized off its length is a tenth of the frontage but triples the depth,
    // which leaves the terrace marooned in a field. The floor keeps a very
    // shallow site from ending up with no visible apron at all.
    //
    // Every dimension here is a fraction of the model's own size — exports of
    // the same site arrive measured in metres and in millimetres, so a fixed
    // figure is invisible in one and enormous in the other.
    const setback = (span) => Math.max(span * 0.18, footprint * 0.05)
    const width = spanX + setback(spanX) * 2
    const depth = spanZ + setback(spanZ) * 2
    // Thin against the site, but never so thin it z-fights whatever ground a
    // future export does happen to carry.
    const thickness = Math.max(footprint * 0.004, (max[1] - min[1]) * 0.02)

    return {
      width,
      depth,
      thickness,
      // A cell *count* across the long axis, not a cell size: the grid is not
      // a scale bar, it is there so the eye has something to track while
      // panning, and a count reads the same whatever units the export uses.
      cell: Math.max(width, depth) / 16,
      // Top face a hair below the base of the buildings rather than flush with
      // it. These exports do carry a site slab — CENTRO's is a zero-thickness
      // plane at y=0 covering the whole plot — it just renders invisibly,
      // being flat and wound to face away from the camera. Invisible is not
      // absent: coplanar with this one it would z-fight the moment anything
      // (a double-sided material, a differently wound export) made it draw.
      // The offset is a fraction of the slab, far too small to read as a gap.
      center: [(min[0] + max[0]) / 2, min[1] - thickness * 0.52, (min[2] + max[2]) / 2],
      // The grid sits above that plane, so it reads against the apron either way.
      gridY: min[1] + thickness * 0.05,
    }
  }, [bounds])

  // Built by hand rather than with gridHelper, which is square-only: squaring
  // a rectangular apron either overhangs it or forces oblong cells, and oblong
  // cells read as the ground being stretched.
  const grid = useMemo(() => {
    if (!site) return null
    const { width, depth, cell } = site
    const columns = Math.max(2, Math.round(width / cell))
    const rows = Math.max(2, Math.round(depth / cell))
    const halfWidth = width / 2
    const halfDepth = depth / 2
    const points = []
    for (let i = 0; i <= columns; i++) {
      const x = -halfWidth + (width * i) / columns
      points.push(x, 0, -halfDepth, x, 0, halfDepth)
    }
    for (let i = 0; i <= rows; i++) {
      const z = -halfDepth + (depth * i) / rows
      points.push(-halfWidth, 0, z, halfWidth, 0, z)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [site])

  useEffect(() => () => grid?.dispose(), [grid])

  if (!site) return null

  return (
    // Turned by the same angle as the model, so the plot stays square to the
    // building it belongs to rather than to the screen.
    <group rotation-y={bounds?.turn ?? 0}>
      <mesh position={site.center}>
        <boxGeometry args={[site.width, site.thickness, site.depth]} />
        <meshStandardMaterial color={apron.slab} roughness={1} metalness={0} />
      </mesh>
      <lineSegments geometry={grid} position={[site.center[0], site.gridY, site.center[2]]}>
        <lineBasicMaterial color={apron.grid} transparent opacity={0.35} depthWrite={false} />
      </lineSegments>
    </group>
  )
}

/* ── camera ────────────────────────────────────────────────────────────── */

function CameraRig({ bounds, focus, mode, navMode, resetSignal, onDragStart, onDragEnd }) {
  const controls = useRef(null)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const goal = useRef({ target: new THREE.Vector3(), distance: 0, active: false })

  const frameDefault = useCallback(() => {
    if (!bounds || !controls.current) return
    const target = new THREE.Vector3(...bounds.center)
    controls.current.target.copy(target)

    // Clip planes sized from the model rather than fixed. A fixed far plane
    // cannot work here: exports arrive measured in anything from metres to
    // millimetres, and at 5000 this site — 1678 x 120 x 2100 — fell entirely
    // outside it. Plan view, which sits at 4x the radius, rendered an empty
    // frame, and pulling back to the 6x zoom limit in 3D made the buildings
    // vanish. Both read as the model failing to load.
    //
    // The far plane clears the furthest the controls can travel (6x radius)
    // plus the far side of the model itself, with headroom; the near plane
    // stays a small fraction of the radius so the depth buffer keeps enough
    // precision to separate one block from the next.
    camera.far = Math.max(bounds.radius * 12, 100)
    camera.near = Math.max(bounds.radius / 2000, 0.05)

    if (mode === '2d') {
      camera.position.set(target.x, target.y + bounds.radius * 4, target.z + 0.001)
      camera.zoom = Math.min(size.width, size.height) / (bounds.radius * 2.4)
    } else {
      const fov = THREE.MathUtils.degToRad(camera.fov ?? 45)
      const distance = (bounds.radius / Math.sin(fov / 2)) * 1.05
      camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(distance, ISO_POLAR, ISO_AZIMUTH))
    }

    // Unconditional: both branches now change clip planes, and the 2D branch
    // additionally changes zoom.
    camera.updateProjectionMatrix()

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
  //
  // `camera` *is* a dependency, and has to be. Switching mode mounts a
  // different camera and drei's `makeDefault` swaps it into the store during
  // layout effects — after this component has rendered but before this effect
  // runs. On `mode` alone the effect therefore fired holding the *outgoing*
  // camera, so the newly mounted one was never positioned, zoomed or given
  // clip planes: it sat at the R3F default looking at the origin, with the
  // site a thousand units off screen. Plan view rendered an empty frame every
  // time. Re-running on the camera swap is what makes the ortho view exist.
  useEffect(() => {
    frameDefaultRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, mode, camera, resetSignal])


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

  // How far the orbit target may travel from the site. Panning is the only
  // control with no natural limit — rotation wraps and zoom is already clamped
  // — so without this a single drag carries the buildings off screen and the
  // only way back is the recenter button. The margin is generous enough to put
  // any corner of the site comfortably in frame and tight enough that the
  // model never leaves it.
  const panLimit = useMemo(() => {
    const min = bounds?.box?.min
    const max = bounds?.box?.max
    if (!min || !max || ![...min, ...max].every(Number.isFinite)) return null
    const margin = (bounds.radius ?? 1) * 0.35
    return {
      min: min.map((value) => value - margin),
      max: max.map((value) => value + margin),
    }
  }, [bounds])

  useFrame(() => {
    const control = controls.current
    if (!control) return

    if (settle.current > 0) {
      settle.current -= 1
      invalidate()
    }

    // Applied as a correction to both target and camera rather than by
    // rejecting the pan outright: moving them together holds the orbit angle
    // and distance exactly, so overshooting the edge feels like the view
    // resting against a wall instead of the camera swinging.
    if (panLimit) {
      const target = control.target
      const clamped = ['x', 'y', 'z'].map((axis, i) =>
        THREE.MathUtils.clamp(target[axis], panLimit.min[i], panLimit.max[i]),
      )
      if (clamped[0] !== target.x || clamped[1] !== target.y || clamped[2] !== target.z) {
        camera.position.add(
          new THREE.Vector3(clamped[0] - target.x, clamped[1] - target.y, clamped[2] - target.z),
        )
        target.set(clamped[0], clamped[1], clamped[2])
        control.update()
        invalidate()
      }
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

  // Which gesture the primary drag performs. Plan view is forced to pan
  // whatever the toggle says: rotation is disabled there, so leaving the
  // primary drag bound to it makes the one obvious gesture do nothing at all.
  const panFirst = navMode === 'pan' || mode === '2d'

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
      // World-space panning, not screen-space: a site is explored by sliding
      // along the ground, and screen-space panning would lift the camera off
      // the ground plane the moment the view is tilted.
      screenSpacePanning={false}
      // Panning is otherwise buried on the right button and on two fingers,
      // which no visitor discovers. The toggle promotes it to the primary
      // drag and demotes rotation to the secondary one, so both gestures stay
      // reachable in either mode.
      mouseButtons={{
        LEFT: panFirst ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: panFirst ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: panFirst ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: panFirst && mode === '3d' ? THREE.TOUCH.DOLLY_ROTATE : THREE.TOUCH.DOLLY_PAN,
      }}
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
  selection = NO_SELECTION,
  onSelect,
  statusFilter,
  flaggedMeshes,
  onMeshClick,
  onModelReady,
  onCaptureReady,
  onFacings,
  onError,
  // Degrees clockwise about the world up. A display transform only — see the
  // note where it is applied. `null` means the admin has not set an
  // orientation, which is what suppresses the compass: a compass that points
  // at an unverified north is worse than no compass.
  orientation = null,
  defaultMode = '2d',
  height = 'h-[420px] md:h-[560px]',
  // Forces the site apron's palette instead of following the visitor's theme.
  // The admin passes `true`: its panels are dark whatever the site theme is, so
  // an editor in light mode would otherwise get a pale plan in a dark chrome.
  darkGround,
}) {
  const containerRef = useRef(null)
  const { isDark } = useTheme()
  const groundIsDark = darkGround ?? isDark
  const [hovered, setHovered] = useState(null)
  const [showLabels, setShowLabels] = useState(true)
  // Plan view first. A leasing map answers "which unit, and is it free" before
  // it answers "what does it look like", and a top-down plan answers the first
  // question immediately — no orbiting to work out what you are looking at.
  // 3D is one tap away for the second question. The admin overrides this.
  const [mode, setMode] = useState(defaultMode)
  // Rotate stays the default *within* 3D: it is what reads as "3D". Plan view
  // overrides this to pan regardless, since rotation is disabled there.
  const [navMode, setNavMode] = useState('orbit')
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

  const selected = useMemo(() => new Set(selection), [selection])

  // What the camera flies to. With several units selected it is the frame that
  // holds all of them, which is the whole point of comparing on a plan: you
  // want the two shops you are weighing up on screen together, not the camera
  // parked on whichever you happened to tap last.
  const focus = useMemo(() => {
    if (!frames || !selection.length) return null
    const picked = selection.map((index) => frames.get(index)).filter(Boolean)
    if (!picked.length) return null
    // Identity matters here — CameraRig re-frames whenever `focus` changes —
    // so a single selection returns the stored frame rather than a copy of it.
    if (picked.length === 1) return picked[0]

    const box = new THREE.Box3()
    const center = new THREE.Vector3()
    for (const frame of picked) {
      center.set(...frame.center)
      box.expandByPoint(center.clone().subScalar(frame.radius))
      box.expandByPoint(center.clone().addScalar(frame.radius))
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    return { center: sphere.center.toArray(), radius: Math.max(sphere.radius, 0.5) }
  }, [frames, selection])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else containerRef.current?.requestFullscreen?.()
  }

  // Mirrors CameraRig's `panFirst`: the hand shows exactly when a primary drag
  // moves the site rather than orbits it. Plan view is always in that state,
  // because rotation is disabled there.
  const handCursor = navMode === 'pan' || mode === '2d'

  // `0` is a real orientation (north already up), so this checks for a value
  // rather than truthiness.
  const hasOrientation = orientation != null && Number.isFinite(orientation)
  const dialRef = useRef(null)

  const chip = useMemo(() => {
    // A hover carrying no unit is a binding-mode highlight: it colours the
    // shape under the cursor but has nothing to put in a tooltip.
    if (!hovered?.unit || !containerRef.current) return null
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
        // The hand tool made visible. Without a cursor the pan mode is a
        // button that silently changes what a drag does, which is the kind of
        // mode you forget you are in; grab/grabbing says it before you drag
        // and confirms it while you do. Applied to the canvas wrapper only, so
        // the control buttons keep their own pointer.
        style={{ cursor: handCursor ? (dragging ? 'grabbing' : 'grab') : undefined }}
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

        <SiteGround bounds={bounds} dark={groundIsDark} />

        <ModelErrorBoundary onError={onError}>
          <Suspense fallback={null}>
            <Model
              url={url}
              units={units}
              bindings={bindings}
              rotation={orientation ?? 0}
              selected={selected}
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
              onFacings={onFacings}
            />
          </Suspense>
        </ModelErrorBoundary>

        <CameraRig
          bounds={bounds}
          focus={focus}
          mode={mode}
          navMode={navMode}
          resetSignal={resetSignal}
          onDragStart={startDrag}
          onDragEnd={endDrag}
        />

        {hasOrientation && <CompassNeedle dialRef={dialRef} bounds={bounds} />}
      </Canvas>

      {/* Suppressed until an admin has set the orientation. An unset model has
          no idea where north is, and a compass pointing confidently at the
          wrong quarter is worse than none — a broker would repeat it to a
          client. */}
      {hasOrientation && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-4 right-4 z-10 flex size-12 items-center justify-center rounded-full border border-[var(--color-line-inv)] bg-void/80 backdrop-blur"
        >
          <div ref={dialRef} className="relative size-full transition-none">
            <span className="absolute left-1/2 top-1 -translate-x-1/2 font-body text-[9px] font-bold tracking-[0.08em] text-accent-soft">
              N
            </span>
            <span className="absolute left-1/2 top-[13px] h-3 w-px -translate-x-1/2 bg-accent-soft/70" />
            <span className="absolute bottom-[13px] left-1/2 h-3 w-px -translate-x-1/2 bg-bone/25" />
          </div>
        </div>
      )}

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
          <div className="mt-0.5 font-body text-[11px] text-content/70">
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
          // Hidden in plan view, where the primary drag already pans and the
          // toggle would be a control with nothing to switch.
          hidden={mode === '2d'}
          label={navMode === 'pan' ? 'Drag to rotate' : 'Hand tool — drag to move the model'}
          active={navMode === 'pan'}
          onClick={() => setNavMode((m) => (m === 'pan' ? 'orbit' : 'pan'))}
        >
          <HandIcon />
        </ViewerButton>
        <ViewerButton
          label={showLabels ? 'Hide unit labels' : 'Show unit labels'}
          active={showLabels}
          onClick={() => setShowLabels((v) => !v)}
        >
          ⌗
        </ViewerButton>
      </div>

      {/* The one control that changes what the visitor is looking at, so it is
          a labelled button in its own corner rather than another glyph in the
          stack of view options. Its old form — a 11px square reading "3D" —
          was the only route from the plan into the model, and nothing about it
          said so. Same corner in both modes, so it never moves out from under
          the pointer that just used it. */}
      <button
        type="button"
        onClick={() => setMode((m) => (m === '3d' ? '2d' : '3d'))}
        className="absolute top-4 right-4 z-10 flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-line-inv)] bg-void/80 px-4 py-2.5 font-body text-[11px] font-bold tracking-[0.12em] text-bone uppercase backdrop-blur transition-colors duration-200 hover:border-bone/35 hover:bg-void"
      >
        {mode === '2d' ? <CubeIcon /> : <PlanIcon />}
        {mode === '2d' ? 'View in 3D' : 'View plan'}
      </button>
    </div>
  )
}

// An isometric box for "3D" and a stack of rooms for "plan". Both drawn for
// the same reason as the hand: the glyphs that would do this job do not render
// consistently, and this button is too load-bearing to risk a tofu box.
function CubeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  )
}

function PlanIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 10h10M13.5 3.5v17M13.5 15h7" />
    </svg>
  )
}

// The other controls are unicode glyphs, but no hand renders reliably across
// the fonts this site ships. Drawn instead, at the same optical weight — and a
// hand rather than a four-way arrow because it is the same tool every map and
// drawing app calls a hand, and it matches the grab cursor the mode turns on.
function HandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11V5.6a1.4 1.4 0 0 1 2.8 0V11" />
      <path d="M11.8 10.6V4.4a1.4 1.4 0 0 1 2.8 0v6.2" />
      <path d="M14.6 11V6.2a1.4 1.4 0 0 1 2.8 0V14a6 6 0 0 1-6 6h-.6a5 5 0 0 1-3.6-1.6l-3.2-3.6a1.4 1.4 0 0 1 2-2L9 14.4V11" />
    </svg>
  )
}

function ViewerButton({ children, label, onClick, active, hidden }) {
  if (hidden) return null
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
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
