import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";

const NeonModel = ({ modelPath, curveConfigs }) => {
  // State to track model to ensure only one model is loaded at a time
  const [model, setModel] = useState(null);

  // Create static shader configurations based on curve configs
  const shaderConfigs = useMemo(() => {
    const configs = {};
    Object.entries(curveConfigs).forEach(([key, config]) => {
      configs[key] = {
        colorA: config.defaultColorA || "#308bff",
        colorB: config.defaultColorB || "#4d35c4",
        intensity: config.defaultIntensity || 2,
      };
    });
    return configs;
  }, [curveConfigs]);

  // Vertex Shader
  const vertexShader = `
  uniform vec3 uMouseWorld;
  uniform float uTime;

  varying vec3 vPosition;
  varying float vDistanceToMouse;
  varying vec2 vUv;

  void main() {
      vUv = uv;

      vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      float distanceToMouse = distance(worldPosition, uMouseWorld);

      float falloff = 1.0 - smoothstep(0.0, 0.7, distanceToMouse);
      falloff = pow(falloff, 2.0);

      vec3 deformDirection = normalize(worldPosition - uMouseWorld);
      vec3 newPosition = position + deformDirection *
          sin(distanceToMouse * 10.0 - uTime * 3.0) * 0.1 * falloff * 0.5;

      vPosition = newPosition;
      vDistanceToMouse = distanceToMouse;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

  // Fragment Shader
const fragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform float uIntensity;
  uniform sampler2D uTexture;
  uniform float uBlendFactor; // 0 = only neon, 1 = only texture

  varying vec3 vPosition;
  varying float vDistanceToMouse;
  varying vec2 vUv;

  vec3 hardLight(vec3 base, vec3 blend) {
    return mix(
      (base * blend * 2.0),
      (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)),
      step(0.5, blend)
    );
  }

  void main() {
      float wave = sin(vPosition.y * 3.0 + uTime * 2.5) * 0.5 + 0.5;
      float pulse = pow(abs(sin(uTime * 1.5)), 2.0) * 0.3 + 0.7;

      float distanceFactor = 1.0 - smoothstep(0.0, 0.5, vDistanceToMouse);

      vec3 neon = mix(uColor1, uColor2, wave) * pulse * uIntensity * (1.0 + distanceFactor * 0.3);
      vec3 texColor = texture2D(uTexture, vUv).rgb;

      // Hard-light blend
      vec3 blended = hardLight(neon, texColor);

      // Mix between neon and blended texture
      gl_FragColor = vec4(mix(neon, blended, uBlendFactor), 1.0);
  }
`;


  // Create shader material dynamically
  const createShaderMaterial = (color1, color2, intensity) => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(color1) },
        uColor2: { value: new THREE.Color(color2) },
        uIntensity: { value: intensity },
        uMouseWorld: { value: new THREE.Vector3(0, 0, 0) },
  // NEW
  uTexture: { value: null },
  uBlendFactor: { value: 0.6 }, // 60% original texture
},
    });
  };

  // Create shaders using static configurations
  const shaders = useMemo(() => {
    const generatedShaders = {};
    Object.entries(shaderConfigs).forEach(([key, config]) => {
      generatedShaders[key] = createShaderMaterial(
        config.colorA,
        config.colorB,
        config.intensity
      );
    });
    return generatedShaders;
  }, [shaderConfigs]);

  // Load the model
  const { scene } = useGLTF(modelPath, true);
  const { camera, gl } = useThree();
  const mouse = useRef(new THREE.Vector3(0, 0, 0));
  const smoothMouse = useRef(new THREE.Vector3(0, 0, 0));
  const rayCaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Dispose old model when model changes
  useEffect(() => {
    if (model) {
      // Dispose old model resources before loading a new one
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.isMaterial) {
            child.material.dispose();
          } else {
            // If it's a multi-material mesh
            child.material.forEach((material) => material.dispose());
          }
        }
      });
    }

    setModel(scene); // Update model to new scene

    return () => {
      // Ensure the old model is cleaned up when the component unmounts
      if (model) {
        model.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (child.material.isMaterial) {
              child.material.dispose();
            } else {
              child.material.forEach((material) => material.dispose());
            }
          }
        });
      }
    };
  }, [modelPath]);

  // Mouse move effect
  useEffect(() => {
    const handleMouseMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -1 * (event.clientY / window.innerHeight) * 2 + 1;

rayCaster.setFromCamera(pointer, camera);

let intersect = rayCaster
  .intersectObjects(scene.children, true)
  .filter(i => !i.object.userData?.isOutline);

if (intersect.length > 0) {
  mouse.current.copy(intersect[0].point);
}

    };

    gl.domElement.addEventListener("mousemove", handleMouseMove);
    return () => {
      gl.domElement.removeEventListener("mousemove", handleMouseMove);
    };
  }, [scene, camera, gl]);

useFrame((_, delta) => {
  smoothMouse.current.lerp(mouse.current, 0.1);

  // update main shaders
  Object.values(shaders).forEach((shader) => {
    shader.uniforms.uTime.value += delta;
    shader.uniforms.uMouseWorld.value = smoothMouse.current;
  });

  // update outline shaders
 if (window.__outlineShaders) {
  window.__outlineShaders.forEach((shader) => {
    shader.uniforms.uTime.value += delta;
    shader.uniforms.uMouseWorld.value = smoothMouse.current;
  });
}
});


 useEffect(() => {
  if (!scene) return;

  scene.traverse((child) => {

    // ONLY apply to original meshes
    if (child.isMesh && !child.userData.isOutline) {

      // pick shader
      let matchingShader = Object.entries(shaders).find(([key]) =>
        child.name.toLowerCase().includes(key.toLowerCase())
      );

      const neonMaterial =
        matchingShader?.[1] || Object.values(shaders)[0];

      // ---- fix invalid hex (strip alpha if exists) ----
      if (neonMaterial.color && neonMaterial.color.getStyle) {
        const c = neonMaterial.color.getStyle();
        if (c.length === 9) {
          neonMaterial.color.set(c.slice(0, 7)); // remove AA
        }
      }

      // apply neon material
      child.material = neonMaterial;
      child.material.transparent = true;
      child.material.opacity = 0.1;
      child.material.needsUpdate = true;

// ---------------- OUTLINES ----------------

// ---------------- OUTLINES ----------------

// 1️⃣ WIREFRAME GRID OUTLINE
const wireGeo = new THREE.WireframeGeometry(child.geometry);
const wireMaterial = new THREE.LineBasicMaterial({
  color: 0xff00ff,
  transparent: true,
  opacity: 0.35,
  depthTest: false,        // stays visible
});
const wireframe = new THREE.LineSegments(wireGeo, wireMaterial);
wireframe.scale.multiplyScalar(1.06);
wireframe.userData.isOutline = true;
child.add(wireframe);


// 2️⃣ STATIC RIM OUTLINE
const outlineMat1 = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
  side: THREE.BackSide,
  depthTest: true,   // always on top
});

const outline1 = new THREE.Mesh(child.geometry, outlineMat1);
outline1.scale.multiplyScalar(1.04);
outline1.userData.isOutline = true;
child.add(outline1);


// 3️⃣ ANIMATED NEON OUTLINE (reacts to mouse)
const outlineMat2 = new THREE.ShaderMaterial({
  transparent: true,
  depthTest: true,
  side: THREE.BackSide,
  uniforms: {
    uTime: { value: 0 },
    uMouseWorld: { value: new THREE.Vector3() },
    uColor1: { value: new THREE.Color(0xff00ff) }, // neon color
    uColor2: { value: new THREE.Color(0xaa00ff) },
    uIntensity: { value: 2.0 }
  },
  vertexShader: vertexShader, // <-- USE SAME DEFORM VERTEX SHADER
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uMouseWorld;
    uniform float uIntensity;
    uniform vec3 uColor1;
    uniform vec3 uColor2;

    varying vec3 vPosition;
    varying float vDistanceToMouse;

    void main() {
      float pulse = 0.5 + 0.4 * sin(uTime * 4.0);

      float hover = 1.0 - smoothstep(0.0, 0.8, vDistanceToMouse);

      vec3 neon = mix(uColor1, uColor2, pulse) * (0.5 + hover * 1.2);

      gl_FragColor = vec4(neon, 1.0);
    }
  `,
});


const outline2 = new THREE.Mesh(child.geometry, outlineMat2);
outline2.scale.multiplyScalar(1.08);
outline2.position.set(-0.01, 0.0, 0);
outline2.userData.isOutline = true;
child.add(outline2);

// Update in useFrame
window.__outlineShaders ??= [];
window.__outlineShaders.push(outlineMat2);


// ------------------------------------------------

    }
  });
}, [scene, shaders]);



  return <primitive object={scene} scale={4} rotation={[Math.PI * 0.0, .7, 0]} // rotate 45° on X axis
 position={[-.5, -.42, -.69]} />;
};

export default NeonModel;
