import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";

const NeonModel = forwardRef(({ modelPath, onAnimChange }, ref) => {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

  const outlinesRef = useRef([]);
  const triggerAnim = useRef(null); // HUD triggers animation

useImperativeHandle(ref, () => ({
  playAnim: (name, hold = false) => {
    const cfg = specialAnims[name] || { name, mode: "once" };
    if (cfg.mode === "once") play(cfg.name, 0.25, "once");
    else playHold(cfg.name);
  },
  stopHold: () => stopHold(),
}));




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

    /* ---------- VERTEX ---------- */
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
      #include <common>
      varying vec3 vWorldPos;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPos.xyz;
      `
    );

    /* ---------- FRAGMENT ---------- */
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
      #include <common>
      uniform float uTime;
      varying vec3 vWorldPos;
      `
    );

shader.fragmentShader = shader.fragmentShader.replace(
  "#include <emissivemap_fragment>",
  `
  float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + vWorldPos.y * 4.0);

  // neon hue cycle
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

/*----wireframe----*/
function addNeonOutlines(scene) {
  const outlinesRef = [];

  const makeOffsetGeometry = (geo, offset = 0.01) => {
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

    const smallOffset = 0.012; // rim
    const neonOffset = 0.018;  // pulsing neon
    const wireOpacity = 0.22;

    // SkinnedMesh version
    if (child.isSkinnedMesh) {
      // Rim
      const rim = new THREE.SkinnedMesh(
        makeOffsetGeometry(child.geometry, smallOffset),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.06,
        })
      );
      rim.userData.isOutline = true;
      rim.bind(child.skeleton, child.bindMatrix);
      parent.add(rim);
      outlinesRef.push({ mesh: rim, type: "rim", base: child });

      // Neon pulsing
      const neon = new THREE.SkinnedMesh(
        makeOffsetGeometry(child.geometry, neonOffset),
        new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0,
        })
      );
      neon.userData.isOutline = true;
      neon.bind(child.skeleton, child.bindMatrix);
      parent.add(neon);
      outlinesRef.push({ mesh: neon, type: "neon", base: child });

      // Wireframe
      const wire = new THREE.SkinnedMesh(
        child.geometry.clone(),
        new THREE.MeshBasicMaterial({
          color: 0xff7aff,
          wireframe: true,
          transparent: true,
          opacity: wireOpacity,
        })
      );
      wire.userData.isOutline = true;
      wire.bind(child.skeleton, child.bindMatrix);
      parent.add(wire);
      outlinesRef.push({ mesh: wire, type: "wire", base: child });
    } else {
      // Non-skinned mesh
      const rim = new THREE.Mesh(
        makeOffsetGeometry(child.geometry, smallOffset),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.06 })
      );
      rim.userData.isOutline = true;
      parent.add(rim);
      outlinesRef.push({ mesh: rim, type: "rim", base: child });

      const neon = new THREE.Mesh(
        makeOffsetGeometry(child.geometry, neonOffset),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.BackSide, transparent: true, opacity: 0 })
      );
      neon.userData.isOutline = true;
      parent.add(neon);
      outlinesRef.push({ mesh: neon, type: "neon", base: child });

      const wire = new THREE.Mesh(
        child.geometry.clone(),
        new THREE.MeshBasicMaterial({ color: 0xff7aff, wireframe: true, transparent: true, opacity: wireOpacity })
      );
      wire.userData.isOutline = true;
      parent.add(wire);
      outlinesRef.push({ mesh: wire, type: "wire", base: child });
    }
  });

  return outlinesRef;
}




  /* ---------------- MOVEMENT ---------------- */
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef({});

  /* ---------------- ANIMATION STATE ---------------- */
  const currentAction = useRef(null);
  const actionLock = useRef(false);
  const holdState = useRef({ active: null, phase: null });
  const [ready, setReady] = useState(false);
  const [currentAnim, setCurrentAnim] = useState("Idle");

  /* ---------------- HOLD CONFIG ---------------- */
  const holdAnimations = {
    Sit: {
      start: "Sit_Down",
      loop: "Sit",
      end: "Sit_Up",
    },
    Sneak: {
      start: "Sneak_Start",
      loop: "Sneak",
      end: "Sneak_End",
    },
  };

  /* ---------------- SPECIAL KEYS ---------------- */
  const specialAnims = {
    Digit1: { name: "Bark", mode: "once" },
    Digit2: { name: "Sit", mode: "hold" },
    Digit3: { name: "Howl", mode: "once" },
    Digit4: { name: "Fetch", mode: "once" },
    Digit5: { name: "Bite", mode: "once" },
    Digit6: { name: "Death", mode: "once" },
    Digit7: { name: "Sneak", mode: "hold" },
  };

  /* ---------------- PLAY HELPER ---------------- */
  const play = (name, fade = 0.25, mode = "loop") => {
    const next = actions?.[name];
    if (!next || currentAction.current === next) return;

    currentAction.current?.fadeOut(fade);

    next
      .reset()
      .setLoop(
        mode === "once" ? THREE.LoopOnce : THREE.LoopRepeat,
        Infinity
      )
      .fadeIn(fade)
      .play();

    next.clampWhenFinished = mode === "once";

    if (mode === "once") {
      actionLock.current = true;
      const d = next.getClip().duration * 1000;
      setTimeout(() => (actionLock.current = false), d - 80);
    }

    currentAction.current = next;
    setCurrentAnim(name);
    onAnimChange?.(name);
  };

  /* ---------------- HOLD PLAY ---------------- */
  const playHold = (name) => {
    if (actionLock.current) return;
    const cfg = holdAnimations[name];
    if (!cfg) return;

    const start = actions?.[cfg.start];
    const loop = actions?.[cfg.loop];

    if (!start || !loop) {
      loop?.reset().setLoop(THREE.LoopRepeat).fadeIn(0.25).play();
      holdState.current = { active: name, phase: "loop" };
      currentAction.current = loop;
      setCurrentAnim(cfg.loop);
      return;
    }

    actionLock.current = true;
    holdState.current = { active: name, phase: "start" };

    start
      .reset()
      .setLoop(THREE.LoopOnce, 1)
      .fadeIn(0.25)
      .play();

    start.clampWhenFinished = true;
    start.onFinish = () => {
      actionLock.current = false;
      holdState.current.phase = "loop";
      loop
        .reset()
        .setLoop(THREE.LoopRepeat)
        .fadeIn(0.25)
        .play();
      currentAction.current = loop;
      setCurrentAnim(cfg.loop);
    };

    currentAction.current = start;
    setCurrentAnim(cfg.start);
  };

  const stopHold = () => {
    const state = holdState.current;
    if (!state.active) return;

    const cfg = holdAnimations[state.active];
    const end = actions?.[cfg.end];

    if (!end) {
      holdState.current = { active: null, phase: null };
      play("Idle");
      return;
    }

    actionLock.current = true;
    state.phase = "end";

    end
      .reset()
      .setLoop(THREE.LoopOnce, 1)
      .fadeIn(0.25)
      .play();

    end.clampWhenFinished = true;
    end.onFinish = () => {
      actionLock.current = false;
      holdState.current = { active: null, phase: null };
      play("Idle");
    };

    currentAction.current = end;
    setCurrentAnim(cfg.end);
  };

  /* ---------------- INPUT ---------------- */
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      keys.current[e.code] = true;

      const anim = specialAnims[e.code];
      if (!anim) return;

      if (holdState.current.active && anim.mode === "once") return;

      if (anim.mode === "once") {
        if (!actionLock.current) play(anim.name, 0.25, "once");
      } else {
        playHold(anim.name);
      }
    };

    const up = (e) => {
      keys.current[e.code] = false;
      const anim = specialAnims[e.code];
      if (anim?.mode === "hold") stopHold();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [actions]);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    if (!scene) return;
scene.traverse((m) => {
  if (m.isMesh && m.material) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.material = applyNeonMaterial(m);
  }
});
/*wireframe/outlines add*/
outlinesRef.current = addNeonOutlines(scene);


    play("Idle");
    setReady(true);
  }, [scene]);

  /* ---------------- LOOP ---------------- */
  useFrame(({ camera }, dt) => {

    /* ---LOOKS---*/
    scene?.traverse((m) => {
  const shader = m.material?.userData?.shader;
  if (shader) shader.uniforms.uTime.value += dt;
});

const t = performance.now() / 1000;

outlinesRef.current.forEach(({ mesh, type, base }) => {
  if (!mesh || !base) return;

  if (type === "neon") {
    // pulsing neon
    const alpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 3));
    mesh.material.opacity = alpha;
    mesh.material.needsUpdate = true;
  } else if (type === "wire") {
    // subtle breathing
    mesh.material.opacity = 0.18 + 0.04 * Math.sin(t * 2);
  } else if (type === "rim") {
    // thick rim, different color + opacity
    mesh.material.color.set(0xffff00); // example: yellow rim
    mesh.material.opacity = 0.12;      // slightly thicker / more visible
  }
});

/*---*/
    if (!ready || !group.current) return;

    direction.current.set(0, 0, 0);
    const speed = keys.current.ShiftLeft ? 4 : 2;

    if (keys.current.KeyW || keys.current.ArrowUp) direction.current.z -= 1;
    if (keys.current.KeyS || keys.current.ArrowDown) direction.current.z += 1;
    if (keys.current.KeyA || keys.current.ArrowLeft) direction.current.x -= 1;
    if (keys.current.KeyD || keys.current.ArrowRight) direction.current.x += 1;

    direction.current.normalize();
    velocity.current.copy(direction.current).multiplyScalar(speed * dt);
    group.current.position.add(velocity.current);

    if (direction.current.length() > 0) {
      const angle = Math.atan2(direction.current.x, direction.current.z);
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        angle,
        0.15
      );
    }

    const target = group.current.position;
    camera.position.lerp(
      new THREE.Vector3(target.x + 1, target.y + 2, target.z + 5),
      0.08
    );
    camera.lookAt(target);

    if (actionLock.current || holdState.current.active) return;

    if (keys.current.Space) play("Jump", 0.2, "once");
    else if (direction.current.length() === 0) play("Idle");
    else if (keys.current.ShiftLeft) play("Run");
    else play("Walk");
  });

  return (
    <group ref={group} scale={1.8}>
      <primitive object={scene} />
    </group>
  );
});

export default NeonModel;
