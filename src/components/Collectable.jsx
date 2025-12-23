// src/components/Collectable.jsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Collectable({ position }) {
  const ref = useRef();
  const color = new THREE.Color("#ff6600"); // neon orange

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position.y + Math.sin(clock.getElapsedTime() * 2) * 0.3;
      ref.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.2}
        roughness={0.2}
        metalness={0.7}
      />
    </mesh>
  );
}
