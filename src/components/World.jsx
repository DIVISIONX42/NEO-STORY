import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Collectable from "./Collectable";
import { Html } from "@react-three/drei";


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

      {/*TEST 3D OUTSIDE*/}
      <Html
  fullscreen
  style={{
    pointerEvents: "auto",
    zIndex: 10,
  }}
>
  <div className="sketchfab-embed-wrapper">
<iframe
  title="Shark Tamagotchi Fantasy Environment"
  src="https://sketchfab.com/models/9e6ab48d001045ee9b94c3e3b33f17cc/embed?autostart=1&transparent=1&ui_background=0&ui_controls=0&ui_infos=0&ui_watermark=0&ui_annotations=0"
  style={{
    width: "10vw",
    height: "10vh",
    border: "none",
  }}
  allow="autoplay; fullscreen; xr-spatial-tracking"
 />

  </div>

    <div
    className="lkg-blocks-player"
    style={{
      padding: "138.106% 0 0 0",
      position: "relative",
      width: "50vw",
      height: "50vh",
      opacity: ".8",
    }}
  >
    <iframe
      src="https://blocks.glass/embed/4955427f-adf7-4ae6-bc20-25be49fa125c"
      frameBorder="0"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
      allow="autoplay; encrypted-media; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
      allowFullScreen
    />
  </div>
</Html>
<Html
  fullscreen
  style={{ pointerEvents: "auto", zIndex: 10 }}
>
  <div
    className="lkg-blocks-player"
    style={{
      position: "absolute",
      top: "10%",
      left: "10%",
      padding: "1% 0 0 0",
      position: "relative",
      width: "50vw",
      height: "50vh",
      opacity: ".8",
      zIndex: 10,
    }}
  >
    <iframe
      src="https://blocks.glass/embed/22aa01b4-918a-4f67-8fc3-230acc5f76c4"
      frameBorder="0"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
      allow="autoplay; encrypted-media; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
      allowFullScreen
    />
  </div>
</Html>

    </>
  );
}
