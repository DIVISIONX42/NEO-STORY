// src/components/Collectable.jsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei"; // easiest for R3F


export default function Collectable({ position }) {
  const ref = useRef();
  const color = new THREE.Color("#ff6600"); // neon orange

  // Load your Fischmarkt model
  const { scene } = useGLTF("/models/Fischmarkt.glb"); // path to your GLB

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position.y + Math.sin(clock.getElapsedTime() * 2) * 0.3;
      ref.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Glass Sphere */}
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.25} // semi-transparent glass
          roughness={0}
          metalness={0.1}
          reflectivity={1}
          clearcoat={1}
          clearcoatRoughness={0}
        />
      </mesh>

      {/* Internal Particles */}
      <points>
        <bufferGeometry
          attach="geometry"
          {...(() => {
            const particleCount = 200;
            const positions = new Float32Array(particleCount * 3);
            for (let i = 0; i < particleCount; i++) {
              const r = Math.random() * 0.25; // inside sphere radius
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.random() * Math.PI;
              positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
              positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
              positions[i * 3 + 2] = r * Math.cos(phi);
            }
            return { attributes: { position: { array: positions, count: particleCount, itemSize: 3 } } };
          })()}
        />
        <pointsMaterial color={color} size={0.02} />
      </points>

      {/* Embedded Model */}
      <primitive object={scene} scale={0.05} position={[0, 0, 0]} />
    </group>
  );
}
