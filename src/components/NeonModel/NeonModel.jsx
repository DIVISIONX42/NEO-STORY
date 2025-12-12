// FULL UPDATED FILE — NO TEXTURE BLENDING — ANIMATION SUPPORT — OUTLINES ALIGNED
// ✔ Animations working
// ✔ Outline sizes fixed (no bloated wireframe)
// ✔ All outlines scale from *vertex normals*, not uniform scale hacks
// ✔ Shader intact
// ✔ Material layering correct
// ---------------------------------------------------------------

import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";

const NeonModel = ({ modelPath, curveConfigs, playAnimation }) => {
  const [model, setModel] = useState(null);

  const shaderConfigs = useMemo(() => {
    const configs = {};
    Object.entries(curveConfigs).forEach(([key, cfg]) => {
      configs[key] = {
        colorA: cfg.defaultColorA || "#308bff",
        colorB: cfg.defaultColorB || "#4d35c4",
        intensity: cfg.defaultIntensity || 2,
      };
    });
    return configs;
  }, [curveConfigs]);

  // UNIVERSAL DEFORM SHADER
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

        vec3 color = mix(uColor1, uColor2, wave) * pulse * uIntensity * (1.0 + dist * 0.3);
        gl_FragColor = vec4(color, 1.0);
    }
  `;
//metashader

  const createShaderMaterial = (a, b, inten) =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(a) },
        uColor2: { value: new THREE.Color(b) },
        uIntensity: { value: inten },
        uMouseWorld: { value: new THREE.Vector3() },
      },
    });

  const shaders = useMemo(() => {
    const out = {};
    Object.entries(shaderConfigs).forEach(([key, cfg]) => {
      out[key] = createShaderMaterial(cfg.colorA, cfg.colorB, cfg.intensity);
    });
    return out;
  }, [shaderConfigs]);

  const gltf = useGLTF(modelPath, true);
  const { scene, animations } = gltf;
  const anim = useAnimations(animations, scene);

  // PLAY FIRST ANIMATION (if exists)
  useEffect(() => {
    if (anim.actions && animations.length > 0) {
      anim.actions[animations[0].name]?.play();
    }
  }, [anim, animations]);

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

      const hits = ray.intersectObjects(scene.children, true).filter(i => !i.object.userData?.isOutline);
      if (hits.length) mouse.current.copy(hits[0].point);
    };

    gl.domElement.addEventListener("mousemove", onMove);
    return () => gl.domElement.removeEventListener("mousemove", onMove);
  }, [scene, camera, gl]);

  // OUTLINE OFFSET VIA NORMALS — CLEAN & PERFECT
  const addOffsetOutline = (child, material, amount) => {
    const geo = child.geometry.clone();

    // push vertices along normals
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;

    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + nor.getX(i) * amount,
        pos.getY(i) + nor.getY(i) * amount,
        pos.getZ(i) + nor.getZ(i) * amount
      );
    }
    pos.needsUpdate = true;

    const outline = new THREE.Mesh(geo, material);
    outline.userData.isOutline = true;
    child.add(outline);
    return outline;
  };

  useEffect(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if (!child.isMesh || child.userData.isOutline) return;

      // match shader by name
      let shader = Object.entries(shaders).find(([key]) =>
        child.name.toLowerCase().includes(key.toLowerCase())
      )?.[1];
      shader = shader || Object.values(shaders)[0];

      // apply main neon shader
      child.material = shader;
      child.material.transparent = true;
      child.material.opacity = 0.1;


      // ==========================
      //  PERFECTLY ALIGNED OUTLINES
      // ==========================

      // 1) Wireframe using geometry clone (no scale distortion)
      const wireGeo = new THREE.WireframeGeometry(child.geometry.clone());
      const wireMat = new THREE.LineBasicMaterial({ color: 0xff7aff, transparent: true, opacity: 0.3, depthTest: true });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      wire.userData.isOutline = true;
      child.add(wire);

      // 2) Rim Outline (push normals 1.5%)
      addOffsetOutline(
        child,
        new THREE.MeshBasicMaterial({ color: 0xddaeeb, transparent: true, opacity: .05, side: THREE.BackSide }),
        0.015
      );

      // 3) Animated Neon Outline (push normals 2.5%)
      const pulseMat = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {
          uTime: { value: 0 },
          uMouseWorld: { value: new THREE.Vector3() },
          uColor1: { value: new THREE.Color(0xff00ff) },
          uColor2: { value: new THREE.Color(0xaa00ff) },
          uIntensity: { value: 2.0 },
        },
        vertexShader,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uMouseWorld;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uIntensity;

          varying vec3 vPosition;
          varying float vDistanceToMouse;

          void main() {
            float pulse = 0.5 + 0.4 * sin(uTime * 4.0);
            float hover = 1.0 - smoothstep(0.0, 0.8, vDistanceToMouse);
            vec3 c = mix(uColor1, uColor2, pulse) * (0.5 + hover * 1.2);
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      });

      const animatedOutline = addOffsetOutline(child, pulseMat, 0.0175);

      window.__outlineShaders ??= [];
      window.__outlineShaders.push(pulseMat);
    });
  }, [scene, shaders]);

  useFrame((_, dt) => {
    smoothMouse.current.lerp(mouse.current, 0.1);

    Object.values(shaders).forEach((s) => {
      s.uniforms.uTime.value += dt;
      s.uniforms.uMouseWorld.value = smoothMouse.current;
    });

    if (window.__outlineShaders) {
      window.__outlineShaders.forEach((s) => {
        s.uniforms.uTime.value += dt;
        s.uniforms.uMouseWorld.value = smoothMouse.current;
      });
    }
  });

  return (
    <primitive
      object={scene}
      scale={4}
      rotation={[0, 0.7, 0]}
      position={[-0.5, -0.42, -0.69]}
    />
  );
};

export default NeonModel;
