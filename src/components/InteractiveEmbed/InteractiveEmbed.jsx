import React, { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

const InteractiveEmbed = ({ embedState, position = [0, 0.5, -1] }) => {
  const groupRef = useRef();
  useFrame(() => {
    if (!embedState.collected && groupRef.current) {
      groupRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={[embedState.size, embedState.size, embedState.size]}>
     <Html
        transform
        style={{
          pointerEvents: "auto",
          opacity: embedState.opacity,
          border: embedState.open ? "2px solid #0ff" : "none",
          borderRadius: "12px",
          transition: "all 0.3s",
        }}
      >
        <div
          className="lkg-blocks-player"
          style={{ padding: "100% 0 0 0", position: "relative" }}
        >
          <iframe
            src="https://blocks.glass/embed/22aa01b4-918a-4f67-8fc3-230acc5f76c4"
            frameBorder="0"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            allow="autoplay; encrypted-media; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
            allowFullScreen
          />
        </div>
      </Html>
    </group>
  );
};

export default InteractiveEmbed;
