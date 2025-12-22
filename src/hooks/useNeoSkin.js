import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export function useNeonSkin(scene) {
  const { camera, gl } = useThree();
  const mouse = useRef(new THREE.Vector3());
  const smoothMouse = useRef(new THREE.Vector3());
  const ray = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const outlines = useRef([]);

  /* ---------- SHADER MATERIAL ---------- */

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
        vertexShader: `
          uniform vec3 uMouseWorld;
          uniform float uTime;
          varying vec3 vPos;
          varying float vDist;
          void main() {
            vec3 wp = (modelMatrix * vec4(position,1.0)).xyz;
            float d = distance(wp, uMouseWorld);
            float fall = pow(1.0 - smoothstep(0.0, 0.7, d), 2.0);
            vec3 dir = normalize(wp - uMouseWorld);
            vec3 p = position + dir * sin(d * 10.0 - uTime * 3.0) * 0.025 * fall;
            vPos = p;
            vDist = d;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uTime;
          uniform float uIntensity;
          varying vec3 vPos;
          varying float vDist;
          void main() {
            float wave = sin(vPos.y * 3.0 + uTime * 2.5) * 0.5 + 0.5;
            float pulse = pow(abs(sin(uTime * 1.5)), 2.0) * 0.3 + 0.7;
            float dist = 1.0 - smoothstep(0.0, 0.5, vDist);
            vec3 col = mix(uColor1, uColor2, wave) * pulse * uIntensity * (1.0 + dist * 0.3);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );

  /* ---------- APPLY SKIN ---------- */

  useEffect(() => {
    if (!scene) return;
    outlines.current = [];

    scene.traverse((m) => {
      if (!m.isMesh || m.userData.neon) return;
      m.userData.neon = true;

      m.material = shader;
      m.material.transparent = true;
      m.material.opacity = 0.12;

      const geo = m.geometry.clone();
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;

      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) + nor.getX(i) * 0.018,
          pos.getY(i) + nor.getY(i) * 0.018,
          pos.getZ(i) + nor.getZ(i) * 0.018
        );
      }
      pos.needsUpdate = true;

      const outline = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.35,
        })
      );

      outline.userData.isOutline = true;
      outline.frustumCulled = false;
      m.add(outline);
      outlines.current.push(outline);
    });
  }, [scene, shader]);

  /* ---------- MOUSE ---------- */

  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.current.setFromCamera(pointer.current, camera);
      const hit = ray.current.intersectObjects(scene.children, true)
        .find(i => !i.object.userData?.isOutline);
      if (hit) mouse.current.copy(hit.point);
    };
    gl.domElement.addEventListener("mousemove", onMove);
    return () => gl.domElement.removeEventListener("mousemove", onMove);
  }, [scene, camera, gl]);

  /* ---------- FRAME ---------- */

  useFrame((_, dt) => {
    smoothMouse.current.lerp(mouse.current, 0.1);
    shader.uniforms.uTime.value += dt;
    shader.uniforms.uMouseWorld.value = smoothMouse.current;
  });
}
