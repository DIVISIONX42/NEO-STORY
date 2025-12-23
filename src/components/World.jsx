import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Collectable from "./Collectable";

const collectablesData = [
  { id: "obj1", position: new THREE.Vector3(5, 0.5, 2) },
  { id: "obj2", position: new THREE.Vector3(-3, 0.5, 4) },
  { id: "obj3", position: new THREE.Vector3(0, 0.5, -5) },
];

export default function World({ foxRef }) {
  const [collected, setCollected] = useState([]);

  useFrame(() => {
    if (!foxRef?.current?.group) return;

    const foxPos = foxRef.current.group.position;

    collectablesData.forEach((item) => {
      if (
        !collected.includes(item.id) &&
        foxPos.distanceTo(item.position) < 1.5
      ) {
        setCollected((prev) => [...prev, item.id]);
      }
    });
  });

  return (
    <>
      {/* Fog */}
      <fog attach="fog" args={["#0b0b0f", 5, 50]} />

      {/* Neon floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.8, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0b0b0f" />
      </mesh>

      {/* Neon grid */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={`x-${i}`} position={[(i - 10) * 2.5, -1.2, 0]}>
          <boxGeometry args={[0.07, 0.2, 500]} />
          <meshStandardMaterial emissive="#00ffff" />
        </mesh>
      ))}

      {/* Collectibles */}
      {collectablesData.map(
        (item) =>
          !collected.includes(item.id) && (
            <Collectable key={item.id} position={item.position.toArray()} />
          )
      )}
    </>
  );
}
