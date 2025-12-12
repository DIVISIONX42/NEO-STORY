// NeonModel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * NeonModel
 * - modelPath: string (glb)
 * - curveConfigs: optional, kept for color choices (not required)
 * - initialPlay: optional animation name to auto-play
 */
const NeonModel = ({ modelPath, curveConfigs = {}, initialPlay = null }) => {
  const gltf = useGLTF(modelPath, true);
  const { scene, animations = [] } = gltf;
  const anim = useAnimations(animations, scene);

  const { camera, gl } = useThree();
  const mouse = useRef(new THREE.Vector3());
  const smoothMouse = useRef(new THREE.Vector3());
  const pointer = useRef(new THREE.Vector2());
  const ray = useRef(new THREE.Raycaster());
  const [availableAnims, setAvailableAnims] = useState([]);
  const [currentAnimName, setCurrentAnimName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // default neon colors (you can feed them via curveConfigs)
  const defaultA = curveConfigs?.Main?.defaultColorA || "#308bff";
  const defaultB = curveConfigs?.Main?.defaultColorB || "#4d35c4";

  // store outline objects so we can update them each frame
  const outlinesRef = useRef([]);

  // helper to create a slighly offset geometry along normals
  const makeOffsetGeometry = (geo, offset = 0.01) => {
    const g = geo.clone();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    if (!pos || !nor) return g;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + nor.getX(i) * offset,
        pos.getY(i) + nor.getY(i) * offset,
        pos.getZ(i) + nor.getZ(i) * offset
      );
    }
    pos.needsUpdate = true;
    return g;
  };

  // expose animation names and optionally start one
  useEffect(() => {
    const names = (animations || []).map((a) => a.name);
    console.log("Animations:", names);
    setAvailableAnims(names);

    if (initialPlay && anim.actions && anim.actions[initialPlay]) {
      Object.values(anim.actions || {}).forEach((a) => a.stop());
      anim.actions[initialPlay].reset().fadeIn(0.2).play();
      setCurrentAnimName(initialPlay);
      setIsPlaying(true);
    } else if (!initialPlay && names.length > 0) {
      // optionally auto-play first by default? Commented out - user controls via HUD.
      // anim.actions[names[0]]?.reset().fadeIn(0.2).play();
      // setCurrentAnimName(names[0]); setIsPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animations, anim]);

  // play/pause helpers
  const playAnimation = (name) => {
    if (!anim?.actions || !name) return;
    Object.values(anim.actions).forEach((a) => a.stop());
    anim.actions[name].reset().fadeIn(0.2).play();
    setCurrentAnimName(name);
    setIsPlaying(true);
  };
  const stopAnimation = (name) => {
    if (!anim?.actions) return;
    if (name) anim.actions[name]?.stop();
    else Object.values(anim.actions).forEach((a) => a.stop());
    setIsPlaying(false);
  };
  const pauseAnimation = (name) => {
    if (!anim?.actions) return;
    const a = name ? anim.actions[name] : anim.actions[currentAnimName];
    if (!a) return;
    a.paused = !a.paused;
    setIsPlaying(!a.paused);
  };

  // raycast mouse -> track last hit point on original meshes (exclude outlines)
  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.current.setFromCamera(pointer.current, camera);

      const hits = ray.current.intersectObjects(scene.children, true).filter((i) => !i.object.userData?.isOutline);
      if (hits.length) mouse.current.copy(hits[0].point);
    };

    gl.domElement.addEventListener("mousemove", onMove);
    return () => gl.domElement.removeEventListener("mousemove", onMove);
  }, [scene, camera, gl]);

  // Apply materials + create outlines (bound to skeleton for SkinnedMesh)
  useEffect(() => {
    if (!scene) return;
    // reset outlinesRef
    outlinesRef.current = [];

    scene.traverse((child) => {
      if (!child.isMesh) return;

      // ensure original materials keep skinning enabled (if present)
      if (child.isSkinnedMesh || child.skeleton) {
        // sometimes child.material is an array -> keep simple handling
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => (m.skinning = true));
        } else if (child.material) {
          child.material.skinning = true;
        }
      }

      // ---- make a subtle neon/emissive effect on the original material (no replacement) ----
      // Many GLBs have MeshStandardMaterial; we'll add emissive color and track it
      const origMat = child.material;
      if (Array.isArray(origMat)) {
        // for multi-material, set emissive on each
        origMat.forEach((m) => {
          if (m) {
            m.emissive = m.emissive || new THREE.Color(0x000000);
            m.emissiveIntensity = m.emissiveIntensity || 1;
            m.transparent = true;
            m.needsUpdate = true;
          }
        });
      } else if (origMat) {
        origMat.emissive = origMat.emissive || new THREE.Color(0x000000);
        origMat.emissiveIntensity = origMat.emissiveIntensity || 1;
        origMat.transparent = true;
        origMat.needsUpdate = true;
      }

      // ---- create outlines that follow the skeleton if necessary ----
      // We'll create:
      //  1) a rim SkinnedMesh with BackSide MeshBasicMaterial (faint)
      //  2) a neon SkinnedMesh (pulsing) that we update each frame
      //  3) a wireframe SkinnedMesh (wireframe:true) to avoid non-skinned LineSegments

      // compute parent for adding outline: add to same parent (keeps same local transform)
      const parent = child.parent || scene;

      // prepare a geometry clone
      const smallOffset = 0.012; // rim offset
      const neonOffset = 0.018;

      // If the mesh is skinned, create SkinnedMesh outlines bound to same skeleton
      if (child.isSkinnedMesh) {
        // Rim outline
        const rimGeo = makeOffsetGeometry(child.geometry, smallOffset);
        const rimMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.06,
          depthTest: true,
        });
        const rim = new THREE.SkinnedMesh(rimGeo, rimMat);
        rim.userData.isOutline = true;
        // bind to same skeleton & bindMatrix
        rim.bind(child.skeleton, child.bindMatrix);
        parent.add(rim);
        outlinesRef.current.push({ mesh: rim, type: "rim", base: child });

        // Neon pulsing outline
        const neonGeo = makeOffsetGeometry(child.geometry, neonOffset);
        const neonMat = new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.0, // we'll drive opacity
          depthTest: true,
        });
        const neon = new THREE.SkinnedMesh(neonGeo, neonMat);
        neon.userData.isOutline = true;
        neon.bind(child.skeleton, child.bindMatrix);
        parent.add(neon);
        outlinesRef.current.push({ mesh: neon, type: "neon", base: child });

        // Wireframe overlay (as skinned mesh with wireframe)
        const wireGeo = child.geometry.clone();
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0xff7aff,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
          depthTest: true,
        });
        const wire = new THREE.SkinnedMesh(wireGeo, wireMat);
        wire.userData.isOutline = true;
        wire.bind(child.skeleton, child.bindMatrix);
        parent.add(wire);
        outlinesRef.current.push({ mesh: wire, type: "wire", base: child });
      } else {
        // Non-skinned mesh: simpler outlines (these will inherit transforms normally)
        const rimGeo = makeOffsetGeometry(child.geometry, smallOffset);
        const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.06
        }));
        rim.userData.isOutline = true;
        parent.add(rim);
        outlinesRef.current.push({ mesh: rim, type: "rim", base: child });

        const neonGeo = makeOffsetGeometry(child.geometry, neonOffset);
        const neon = new THREE.Mesh(neonGeo, new THREE.MeshBasicMaterial({
          color: 0xff00ff, side: THREE.BackSide, transparent: true, opacity: 0
        }));
        neon.userData.isOutline = true;
        parent.add(neon);
        outlinesRef.current.push({ mesh: neon, type: "neon", base: child });

        const wireGeo = child.geometry.clone();
        const wire = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
          color: 0xff7aff, wireframe: true, transparent: true, opacity: 0.22
        }));
        wire.userData.isOutline = true;
        parent.add(wire);
        outlinesRef.current.push({ mesh: wire, type: "wire", base: child });
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // frame update: pulse neon outlines and drive emissive on original materials using ray hit
  useFrame((_, dt) => {
    // smooth the mouse point
    smoothMouse.current.lerp(mouse.current, 0.1);

    // pulse value
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.45 * Math.sin(t * 4.0);

    // update outlines
    outlinesRef.current.forEach(({ mesh, type, base }) => {
      if (!mesh || !base) return;

      if (type === "neon") {
        // compute distance from mesh position to pointer (approx using base bounding sphere)
        const pos = new THREE.Vector3();
        base.getWorldPosition(pos);
        const d = pos.distanceTo(smoothMouse.current);
        // reduce effect a bit (so hover small)
        const hover = 1.0 - THREE.MathUtils.clamp(d / 1.2, 0, 1);
        // opacity/pulse
        const alpha = THREE.MathUtils.clamp( Math.max(0.05, hover * 0.9) * (0.6 + pulse * 0.6), 0, 1);
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => (m.opacity = alpha));
        } else {
          mesh.material.opacity = alpha;
          mesh.material.needsUpdate = true;
        }
      } else if (type === "rim") {
        // keep rim faint but visible
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => (m.opacity = 0.06));
        } else mesh.material.opacity = 0.06;
      } else if (type === "wire") {
        // very subtle breathing
        const wireAlpha = 0.18 + 0.04 * Math.sin(t * 2.0);
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => (m.opacity = wireAlpha));
        } else mesh.material.opacity = wireAlpha;
      }
    });

    // Update emissive of original materials based on distance to smoothMouse (approx per mesh)
    // We'll iterate scene and update top-level mesh materials (cheap enough for single fox)
    scene.traverse((child) => {
      if (!child.isMesh || child.userData?.isOutline) return;
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      const dist = worldPos.distanceTo(smoothMouse.current);
      const influence = 1.0 - THREE.MathUtils.clamp(dist / 1.2, 0, 1); // falloff
      const neonColor = new THREE.Color(defaultA).lerp(new THREE.Color(defaultB), 0.5);
      // apply to material(s)
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => {
          if (!m) return;
          m.emissive = m.emissive || new THREE.Color(0x000000);
          m.emissive.lerp(neonColor, 0.02 + influence * 0.8); // smooth lerp
          m.emissiveIntensity = 0.6 + influence * 2.0;
        });
      } else if (child.material) {
        const m = child.material;
        m.emissive = m.emissive || new THREE.Color(0x000000);
        // small lerp per frame for smoothness
        const target = neonColor.clone().multiplyScalar(0.3 + influence * 1.2);
        m.emissive.lerp(target, 0.06);
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity || 1, 0.6 + influence * 2.0, 0.06);
        m.needsUpdate = true;
      }
    });
  });

  // render model + HTML HUD for animations
  return (
    <>
      <primitive object={scene} scale={4} rotation={[0, 0.7, 0]} position={[-0.5, -0.42, -0.69]} />

      <Html fullscreen style={{ pointerEvents: "none" }}>
        <div style={{ position: "fixed", left: 16, top: 16, zIndex: 999, pointerEvents: "auto", fontFamily: "Inter, Roboto, sans-serif", color: "#fff" }}>
          <div style={{ background: "rgba(0,0,0,0.45)", padding: 10, borderRadius: 8, minWidth: 240 }}>
            <strong style={{ display: "block", marginBottom: 8 }}>Animations</strong>

            {availableAnims.length === 0 ? (
              <div style={{ opacity: 0.85, fontSize: 13 }}>No animations found</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {availableAnims.map((name) => (
                  <div key={name} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13 }}>{name}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => playAnimation(name)} style={{ background: currentAnimName === name && isPlaying ? "#7b47ff" : "#222", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 6 }}>
                        Play
                      </button>
                      <button onClick={() => pauseAnimation(name)} style={{ background: "#333", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 6 }}>
                        Pause
                      </button>
                      <button onClick={() => stopAnimation(name)} style={{ background: "#511515", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 6 }}>
                        Stop
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button onClick={() => availableAnims.length && playAnimation(availableAnims[0])} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#2b6cff", color: "#fff" }}>Play first</button>
              <button onClick={() => stopAnimation()} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#444", color: "#fff" }}>Stop all</button>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Console logs animation names on load.
            </div>
          </div>
        </div>
      </Html>
    </>
  );
};

export default NeonModel;
