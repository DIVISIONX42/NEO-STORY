// NeonModel.jsx — STABLE FIXED EDITION
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const cleanHex = (hex) => {
  if (!hex) return "#ffffff";
  if (hex.length === 9) return hex.slice(0, 7); // remove alpha
  return hex;
};

const NeonModel = ({ modelPath, curveConfigs = {} }) => {
  const { scene, animations } = useGLTF(modelPath, true);
  const anim = useAnimations(animations, scene);

  const [animNames, setAnimNames] = useState([]);
  const [current, setCurrent] = useState(null);

  const { camera, gl } = useThree();
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const mouse = useRef(new THREE.Vector3());
  const smoothMouse = useRef(new THREE.Vector3());

  // ---------------- SHADERS ------------------
  const shaderConfigs = useMemo(() => {
    const out = {};
    Object.entries(curveConfigs).forEach(([key, cfg]) => {
      out[key] = {
        colorA: cleanHex(cfg.defaultColorA),
        colorB: cleanHex(cfg.defaultColorB),
        intensity: cfg.defaultIntensity || 2,
      };
    });
    return out;
  }, [curveConfigs]);

  const vertexShader = `
    uniform vec3 uMouseWorld;
    uniform float uTime;
    varying vec3 vPosition;
    varying float vDistanceToMouse;

    void main() {
      vec3 worldPosition = (modelMatrix * vec4(position,1.0)).xyz;
      float d = distance(worldPosition, uMouseWorld);
      float fall = 1.0 - smoothstep(0.0, 0.7, d);
      fall = pow(fall, 2.0);

      vec3 dir = normalize(worldPosition - uMouseWorld);
      vec3 newPos = position + dir * sin(d * 10.0 - uTime * 3.0) * 0.05 * fall * 0.5;

      vPosition = newPos;
      vDistanceToMouse = d;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos,1.0);
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
      float pulse = pow(abs(sin(uTime * 1.5)),2.0) * 0.3 + 0.7;
      float dist = 1.0 - smoothstep(0.0, 0.5, vDistanceToMouse);

      vec3 col = mix(uColor1, uColor2, wave) * pulse * uIntensity * (1.0 + dist * 0.3);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const createShaderMaterial = (a, b, intensity) =>
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouseWorld: { value: new THREE.Vector3() },
        uColor1: { value: new THREE.Color(a) },
        uColor2: { value: new THREE.Color(b) },
        uIntensity: { value: intensity },
      },
      transparent: true,
    });

  const shaders = useMemo(() => {
    const out = {};

    Object.entries(shaderConfigs).forEach(([key, cfg]) => {
      out[key] = createShaderMaterial(cfg.colorA, cfg.colorB, cfg.intensity);
    });

    if (!out.__default) {
      out.__default = createShaderMaterial("#308bff", "#4d35c4", 1.5);
    }
    return out;
  }, [shaderConfigs]);

  // ---------------- ANIMATIONS ------------------
  useEffect(() => {
    const names = animations.map((a) => a.name);
    console.log("Animations in model:", names);
    setAnimNames(names);

    // auto play first
    if (names.length > 0) {
      const a = anim.actions[names[0]];
      if (a) {
        a.reset().fadeIn(0.3).play();
        setCurrent(names[0]);
      }
    }
  }, [animations, anim.actions]);

  const playAnim = (name) => {
    if (!anim.actions[name]) return;
    Object.values(anim.actions).forEach((a) => a.stop());
    anim.actions[name].reset().fadeIn(0.2).play();
    setCurrent(name);
  };

  // ---------------- MOUSE INTERACTION ------------------
  useEffect(() => {
    const move = (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

      ray.setFromCamera(pointer, camera);

      const hits = ray
        .intersectObjects(scene.children, true)
        .filter((h) => !h.object.userData?.isOutline);

      if (hits.length) mouse.current.copy(hits[0].point);
    };

    gl.domElement.addEventListener("mousemove", move);
    return () => gl.domElement.removeEventListener("mousemove", move);
  }, [camera, gl, scene]);

  // ---------------- MATERIAL ASSIGNMENT FIXED ------------------
  useEffect(() => {
    scene.traverse((child) => {
      // Only real meshes with geometry
      if (!child.isMesh) return;
      if (!child.geometry) return;

      // Find shader by name
      let shader =
        Object.entries(shaders).find(([key]) =>
          child.name.toLowerCase().includes(key.toLowerCase())
        )?.[1] || shaders.__default;

      child.material = shader; // safe
      child.material.transparent = true;
      child.material.opacity = 0.12;
    });
  }, [scene, shaders]);

  // ---------------- FRAME UPDATE ------------------
  useFrame((_, dt) => {
    smoothMouse.current.lerp(mouse.current, 0.1);

    Object.values(shaders).forEach((shader) => {
      shader.uniforms.uTime.value += dt;
      shader.uniforms.uMouseWorld.value.copy(smoothMouse.current);
    });
  });

  // ---------------- RENDER ------------------
  return (
    <>
      <primitive object={scene} scale={4} rotation={[0, 0.7, 0]} position={[-0.5, -0.42, -0.69]} />

      <Html fullscreen style={{ pointerEvents: "none" }}>
        <div style={{ position: "fixed", left: 20, top: 20, pointerEvents: "auto" }}>
          <div style={{ background: "rgba(0,0,0,0.5)", padding: 12, borderRadius: 8, color: "#fff" }}>
            <strong>Animations</strong>
            {animNames.map((name) => (
              <div key={name} style={{ marginTop: 6 }}>
                <button
                  onClick={() => playAnim(name)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: current === name ? "#5a3aff" : "#333",
                    color: "#fff",
                  }}
                >
                  {name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Html>
    </>
  );
};

export default NeonModel;
