import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export default function NeonModel({ modelPath, onAnimChange }) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

  /* =========================================================
     SHADER (EXACT SAME AS YOUR ORIGINAL)
  ========================================================= */

  const vertexShader = `
    uniform vec3 uMouseWorld;
    uniform float uTime;

    varying vec3 vPosition;
    varying float vDistanceToMouse;

    void main() {
      vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      float d = distance(worldPosition, uMouseWorld);

      float fall = 1.0 - smoothstep(0.0, 0.7, d);
      fall = pow(fall, 2.0);

      vec3 dir = normalize(worldPosition - uMouseWorld);
      vec3 newPos = position + dir * sin(d * 10.0 - uTime * 3.0) * 0.05 * fall * 0.5;

      vPosition = newPos;
      vDistanceToMouse = d;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uTime;
    uniform float uIntensity;

    varying vec3 vPosition;
    varying float vDistanceToMouse;

    void main() {
      float wave = sin(vPosition.y * 3.0 + uTime * 2.5) * 0.5 + 0.5;
      float pulse = pow(abs(sin(uTime * 1.5)), 2.0) * 0.3 + 0.7;
      float dist = 1.0 - smoothstep(0.0, 0.5, vDistanceToMouse);

      vec3 color = mix(uColor1, uColor2, wave)
        * pulse
        * uIntensity
        * (1.0 + dist * 0.3);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const outlineVertex = `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const pulseOutlineFragment = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;

    void main() {
      float pulse = 0.5 + 0.4 * sin(uTime * 4.0);
      vec3 c = mix(uColor1, uColor2, pulse);
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  /* ========================================================= */

  const shader = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uMouseWorld: { value: new THREE.Vector3() },
          uColor1: { value: new THREE.Color("#308bff") },
          uColor2: { value: new THREE.Color("#4d35c4") },
          uIntensity: { value: 2.0 },
        },
        vertexShader,
        fragmentShader,
      }),
    []
  );

  const outlineShader = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
          uTime: { value: 0 },
          uColor1: { value: new THREE.Color("#ff00ff") },
          uColor2: { value: new THREE.Color("#aa00ff") },
        },
        vertexShader: outlineVertex,
        fragmentShader: pulseOutlineFragment,
      }),
    []
  );

  /* =========================================================
     APPLY MATERIALS (ONCE)
  ========================================================= */

useEffect(() => {
  if (!scene) return;

  scene.traverse((m) => {
    if (!m.isMesh) return;

    // 🚫 DO NOT TOUCH OUTLINES OR ALREADY-PROCESSED MESHES
    if (m.userData.isOutline || m.userData.neonApplied) return;

    m.userData.neonApplied = true;

    // MAIN NEON MATERIAL
    m.material = shader;
    m.material.transparent = true;
    m.material.opacity = 0.12;

    // ---------- OUTLINE ----------
    const geo = m.geometry.clone();
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;

    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + nor.getX(i) * 0.017,
        pos.getY(i) + nor.getY(i) * 0.017,
        pos.getZ(i) + nor.getZ(i) * 0.017
      );
    }
    pos.needsUpdate = true;

    const outline = new THREE.Mesh(geo, outlineShader);
    outline.userData.isOutline = true;
    outline.frustumCulled = false;

    m.add(outline);
  });
}, [scene, shader, outlineShader]);


  /* =========================================================
     MOUSE INTERACTION
  ========================================================= */

  const { camera, gl } = useThree();
  const mouse = useRef(new THREE.Vector3());
  const smoothMouse = useRef(new THREE.Vector3());
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  useEffect(() => {
    const onMove = (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(pointer, camera);

      const hits = ray
        .intersectObjects(scene.children, true)
        .filter((i) => !i.object.userData?.isOutline);

      if (hits.length) mouse.current.copy(hits[0].point);
    };

    gl.domElement.addEventListener("mousemove", onMove);
    return () => gl.domElement.removeEventListener("mousemove", onMove);
  }, [scene, camera, gl]);

  /* =========================================================
     ANIMATION
  ========================================================= */

  const currentAction = useRef(null);

  const play = (name) => {
    const next = actions?.[name];
    if (!next || currentAction.current === next) return;

    currentAction.current?.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    currentAction.current = next;

    onAnimChange?.(name);
  };

  useEffect(() => {
    if (!actions) return;
    play("Idle");
  }, [actions]);

  /* =========================================================
     FRAME LOOP
  ========================================================= */

  useFrame((_, dt) => {
    smoothMouse.current.lerp(mouse.current, 0.1);

    shader.uniforms.uTime.value += dt;
    shader.uniforms.uMouseWorld.value = smoothMouse.current;

    outlineShader.uniforms.uTime.value += dt;
  });

  return (
    <group ref={group} scale={1.8}>
      <primitive object={scene} />
    </group>
  );
}
