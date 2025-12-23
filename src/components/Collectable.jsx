// src/components/Collectable.jsx
import { useRef, Suspense, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

useGLTF.preload("/models/Fischmarkt.glb");

export default function Collectable({ position }) {
  const ref = useRef();
  const { scene } = useGLTF("/models/Fischmarkt.glb");

  // 🔥 Force visibility on iOS
  useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          emissive: "#444444",
          emissiveIntensity: 1,
          roughness: 0.6,
          metalness: 0.1,
        });
      }
    });
  }, [scene]);

  // Floating animation
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y =
      position.y + Math.sin(clock.getElapsedTime() * 2) * 0.25;
    ref.current.rotation.y += 0.01;
  });

  // Particles (precomputed)
  const particles = useMemo(() => {
    const count = 160;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 0.22;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI;
      arr[i * 3] = r * Math.sin(b) * Math.cos(a);
      arr[i * 3 + 1] = r * Math.cos(b);
      arr[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
    }
    return arr;
  }, []);

  return (
    <group ref={ref} position={position}>
      {/* 🔆 LOCAL LIGHTS (CRITICAL FOR iOS) */}
      <pointLight
        intensity={2.5}
        distance={3}
        color="#ffffff"
        position={[0, 0.3, 0.3]}
      />
      <ambientLight intensity={0.9} />

      {/* 🟠 GLASS SPHERE (iOS SAFE) */}
      <mesh>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          transparent
          opacity={0.35}
          color="#ffffff"
          emissive="#66ffff"
          emissiveIntensity={0.4}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>

      {/* ✨ PARTICLES */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={particles}
            count={particles.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#00ffff"
          size={0.02}
          sizeAttenuation
        />
      </points>

      {/* 🏛️ FISCHMARKT MODEL */}
      <Suspense fallback={null}>
        <primitive
          object={scene}
          scale={0.045}
          position={[0, -0.05, 0]}
        />
      </Suspense>
    </group>
  );
}
