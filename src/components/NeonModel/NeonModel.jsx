import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as THREE from "three";

/* =========================================================
   CONSTANTS
========================================================= */
const MAX_WALK = 1.2;
const MAX_RUN = 3.5;
const ACCEL = 18;
const DAMPING = 10;
const DEADZONE = 0.15;

/* =========================================================
   COMPONENT
========================================================= */
const NeonModel = forwardRef(
  ({ modelPath, onAnimChange, moveVector }, ref) => {
    const group = useRef();
    const { scene, animations } = useGLTF(modelPath);
    const { actions } = useAnimations(animations, group);

    /* ---------------- REFS ---------------- */
    const outlinesRef = useRef([]);
    const velocity = useRef(new THREE.Vector3());
    const inputDir = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());
    const keys = useRef({});
    const grounded = useRef(true);

    const activeAction = useRef(null);
    const currentAction = useRef(null);
    const actionLock = useRef(false);
    const digit7Hold = useRef(false);

    const stepTimer = useRef(0);

    /* ---------------- STATE ---------------- */
    const [ready, setReady] = useState(false);
    const [currentAnim, setCurrentAnim] = useState("Idle");

    /* =========================================================
       IMPERATIVE API
    ========================================================= */
    useImperativeHandle(ref, () => ({
      playAnim: (name) => {
        if (name === "Sneak") {
          digit7Hold.current = !digit7Hold.current;
        } else {
          play(name, 0.2, "once");
        }
      },
    }));

    /* =========================================================
       MATERIAL
    ========================================================= */
    function applyNeonMaterial(mesh) {
      const mat = mesh.material.clone();
      mat.emissive = new THREE.Color("#00ffff");
      mat.emissiveIntensity = 1.4;
      mat.roughness = 0.2;
      mat.metalness = 0.8;
      mat.transparent = true;
      mat.opacity = 0.85;
      mat.skinning = true;

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };

        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          `#include <common>
           varying vec3 vWorldPos;`
        );

        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
           vWorldPos = worldPos.xyz;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           varying vec3 vWorldPos;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `
          float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + vWorldPos.y * 4.0);
          float hue = mod(uTime * 0.15 + vWorldPos.y * 0.1, 1.0);
          vec3 neonColor = vec3(
            abs(sin(hue * 6.2831)),
            abs(sin(hue * 6.2831 + 2.094)),
            abs(sin(hue * 6.2831 + 4.188))
          );
          totalEmissiveRadiance *= neonColor * pulse;
        `
        );

        mat.userData.shader = shader;
      };

      return mat;
    }

    /* =========================================================
       OUTLINES
    ========================================================= */
    function addNeonOutlines(scene) {
      const result = [];

      const offsetGeo = (geo, offset) => {
        const g = geo.clone();
        const pos = g.attributes.position;
        const nor = g.attributes.normal;
        if (!pos || !nor) return g;
        for (let i = 0; i < pos.count; i++) {
          pos.setXYZ(
            i,
            pos.getX(i) + nor.getX(i) * offset,
            pos.getY(i) + nor.getY(i) * offset,
            pos.getZ(i) + nor.getZ(i) * offset
          );
        }
        pos.needsUpdate = true;
        return g;
      };

      scene.traverse((child) => {
        if (!child.isMesh) return;
        const parent = child.parent || scene;

        const rim = new THREE.Mesh(
          offsetGeo(child.geometry, 0.012),
          new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.12,
          })
        );

        const neon = new THREE.Mesh(
          offsetGeo(child.geometry, 0.018),
          new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0,
          })
        );

        rim.userData.isOutline = neon.userData.isOutline = true;
        parent.add(rim);
        parent.add(neon);

        result.push({ mesh: rim, type: "rim" });
        result.push({ mesh: neon, type: "neon" });
      });

      return result;
    }

    /* =========================================================
       ANIMATION HELPERS
    ========================================================= */
    const play = (name, fade = 0.2, mode = "loop") => {
      const next = actions?.[name];
      if (!next) return;
      if (currentAnim === name && mode !== "once") return;

      Object.values(actions).forEach((a) => a.fadeOut(fade));

      next
        .reset()
        .setLoop(mode === "once" ? THREE.LoopOnce : THREE.LoopRepeat)
        .fadeIn(fade)
        .play();

      if (mode === "once") {
        actionLock.current = true;
        next.clampWhenFinished = true;
        const onFinish = (e) => {
          if (e.action === next) {
            next.getMixer().removeEventListener("finished", onFinish);
            actionLock.current = false;
          }
        };
        next.getMixer().addEventListener("finished", onFinish);
      }

      activeAction.current = next;
      setCurrentAnim(name);
      onAnimChange?.(name);
    };

    const forceToLocomotion = () => {
      actionLock.current = false;
      Object.values(actions || {}).forEach((a) => a.stop());
      activeAction.current = null;
    };

    /* =========================================================
       INPUT
    ========================================================= */
    useEffect(() => {
      const down = (e) => {
        if (e.repeat) return;
        keys.current[e.code] = true;
      };
      const up = (e) => {
        keys.current[e.code] = false;
        if (e.code === "Digit7") digit7Hold.current = false;
      };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
      };
    }, []);

    /* =========================================================
       INIT
    ========================================================= */
    useEffect(() => {
      if (!scene) return;

      scene.traverse((m) => {
        if (m.isMesh && m.material) {
          m.material = applyNeonMaterial(m);
        }
      });

      outlinesRef.current = addNeonOutlines(scene);

      if (actions) {
        Object.values(actions).forEach((a) => a.stop());
        play("Idle", 0);
      }

      setReady(true);
    }, [scene, actions]);

    /* =========================================================
       FRAME LOOP
    ========================================================= */
    useFrame(({ camera }, dt) => {
      if (!ready || !group.current) return;

      /* --- shader time --- */
      scene.traverse((m) => {
        const s = m.material?.userData?.shader;
        if (s) s.uniforms.uTime.value += dt;
      });

      /* --- outlines --- */
      const t = performance.now() / 1000;
      outlinesRef.current.forEach(({ mesh, type }) => {
        if (type === "neon") mesh.material.opacity = 0.3 + 0.6 * Math.abs(Math.sin(t * 3));
      });

      /* --- input vector --- */
      direction.current.set(0, 0, 0);

      if (keys.current.KeyW || keys.current.ArrowUp) direction.current.z -= 1;
      if (keys.current.KeyS || keys.current.ArrowDown) direction.current.z += 1;
      if (keys.current.KeyA || keys.current.ArrowLeft) direction.current.x -= 1;
      if (keys.current.KeyD || keys.current.ArrowRight) direction.current.x += 1;

      if (moveVector) {
        direction.current.x += moveVector.x;
        direction.current.z += moveVector.y;
      }

      const len = direction.current.length();
      if (len > DEADZONE) direction.current.normalize();
      else direction.current.set(0, 0, 0);

      /* --- speed --- */
      const run =
        keys.current.ShiftLeft ||
        (moveVector && Math.abs(moveVector.x) + Math.abs(moveVector.y) > 0.75);

      const maxSpeed = digit7Hold.current
        ? MAX_WALK * 0.6
        : run
        ? MAX_RUN
        : MAX_WALK;

      const desired = direction.current.clone().multiplyScalar(maxSpeed);

      velocity.current.lerp(desired, 1 - Math.exp(-ACCEL * dt));
      velocity.current.multiplyScalar(1 - Math.exp(-DAMPING * dt));

      group.current.position.addScaledVector(velocity.current, dt);

      if (velocity.current.lengthSq() > 0.0001) {
        const angle = Math.atan2(velocity.current.x, velocity.current.z);
        group.current.rotation.y = THREE.MathUtils.lerp(
          group.current.rotation.y,
          angle,
          0.15
        );
      }

      /* --- locomotion animation --- */
      if (!actionLock.current) {
        const speed = velocity.current.length();
        let target = "Idle";
        if (speed > 0.1) target = speed > 1.6 ? "Run" : "Walk";
        if (currentAnim !== target) play(target, 0.2, "loop");
      }

      /* --- camera --- */
      const camTarget = group.current.position.clone();
      camTarget.y += 1.6;
      camera.position.lerp(
        camTarget.clone().add(new THREE.Vector3(0, 2, 4)),
        1 - Math.exp(-4 * dt)
      );
      camera.lookAt(camTarget);
    });

    return (
      <group ref={group} scale={1.8}>
        <primitive object={scene} />
      </group>
    );
  }
);

export default NeonModel;
