import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";


const NeonModel = forwardRef(({ modelPath, onAnimChange, moveVector }, ref) => {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

  const outlinesRef = useRef([]);
  const triggerAnim = useRef(null); // HUD triggers animation

  const hudActive = useRef(false);

  const digit7Hold = useRef(false);



useImperativeHandle(ref, () => ({
  playAnim: (name, hold = false) => {
    hudActive.current = true;
    if (hold) playHold(name);
    else play(name, 0.25, "once");
  },
  stopHold: () => {
    hudActive.current = false;
    stopHold();
  },
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


/*sneak*/
const playDigit7 = () => {
  const sneakLoop = actions?.["Sneak"];
  if (!sneakLoop) return;

  // immediately stop other actions
  forceToLocomotion();

  sneakLoop
    .reset()
    .setLoop(THREE.LoopRepeat)
    .fadeIn(0.1)
    .play();

  holdState.current.active = "Sneak";
  holdState.current.phase = "loop";
  actionLock.current = true;
  digit7Hold.current = true;
  currentAction.current = sneakLoop;
  setCurrentAnim("Sneak");
};

const playOverlay = (name, speed = 1, pingPong = false) => {
  const action = actions?.[name];
  if (!action) return;

  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.timeScale = pingPong ? -1 : speed; // pingpong via negative timeScale toggle
  action.fadeIn(0.15).play();

  currentAction.current = action;
  setCurrentAnim(name);

  // no actionLock — allows movement
};


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
      end: "Sit",
    },
    Sneak: {
      start: "Sneak_Start",
      loop: "Sneak",
    },
        Fetch: {
      start: "Fetch_Start",
      loop: "Fetch",
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
  if (currentAnim === name) return; // ✅ prevents spam restart
    const next = actions?.[name];
if (!next) return;

    currentAction.current?.fadeOut(0.1);

    next
      .reset()
      .setLoop(
        mode === "once" ? THREE.LoopOnce : THREE.LoopRepeat,
        Infinity
      )
      .fadeIn(.25)
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
  const state = holdState.current;
  if (state.active === name && state.phase === "loop") return; // <--- skip restart

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

  if (e.code === "Digit2") {
  const isMoving = direction.current.length() > 0 || (moveVector && (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05));

  if (isMoving) {
    // Play Sit overlay while moving
    playOverlay("Sit", 1, true); 
  } else {
    // Optional: fallback to normal hold Sit
    playHold("Sit");
  }
  return;
}

if (e.code === "Digit4") {
  const isMoving = direction.current.length() > 0 || (moveVector && (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05));

  if (isMoving) {
    playOverlay("Fetch", 1, true);
  } else {
    playHold("Fetch");
  }
  return;
}



  // ✅ Digit7 special logic
  if (e.code === "Digit7") {
    const isMoving = direction.current.length() > 0 ||
                     (moveVector && (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05));
    if (!isMoving) return; // only allow while moving

    digit7Hold.current = true;   // mark Digit7 active
    forceToLocomotion();         // stop any other actions
    playHold(anim.name);          // play Sneak
    return;
  }

  // --- normal hold/once logic for other keys ---
  if (anim.mode === "once") {
    if (!actionLock.current) play(anim.name, 0.25, "once");
  } else {
    playHold(anim.name);
  }
};




const up = (e) => {
  keys.current[e.code] = false;

if (e.code === "Digit7") {
  digit7Hold.current = false;
  holdState.current.active = null;
  holdState.current.phase = null;
  actionLock.current = false;
  play("Idle");
  return;
}

if (e.code === "Digit7") {
  digit7Hold.current = false;
  holdState.current.active = null;
  holdState.current.phase = null;
  actionLock.current = false;
  play("Idle");
  return;
}



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
  /*---mobile---*/
  const hasJoystickInput = moveVector &&
  (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05);


  /* ---------------- LOOP ---------------- */
  useFrame(({ camera }, dt) => {

    /*---movement ani stop---*/
    const hasMovementInput =
  direction.current.length() > 0 ||
  (moveVector && (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05));


    const wantsToMove = direction.current.length() > 0;


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

// keyboard
if (keys.current.KeyW || keys.current.ArrowUp) direction.current.z -= 1;
if (keys.current.KeyS || keys.current.ArrowDown) direction.current.z += 1;
if (keys.current.KeyA || keys.current.ArrowLeft) direction.current.x -= 1;
if (keys.current.KeyD || keys.current.ArrowRight) direction.current.x += 1;

// joystick (mobile)
if (moveVector) {
  direction.current.x += moveVector.x * 1.2;
  direction.current.z += moveVector.y * 1.2;
}


/*const hasMovementInput = direction.current.length() > 0;*/
const isRunning = keys.current.ShiftLeft || (moveVector && moveVector.run);

const speed = isRunning ? 4 : 2.4;

if (hasMovementInput) {
const len = direction.current.length();
if (len > 0.01) {
  direction.current.normalize();
  velocity.current.copy(direction.current).multiplyScalar(speed * dt * Math.min(len, 1));
  group.current.position.add(velocity.current);
}

  const angle = Math.atan2(direction.current.x, direction.current.z);
  group.current.rotation.y = THREE.MathUtils.lerp(
    group.current.rotation.y,
    angle,
    0.15
  );
}

if (direction.current.length() > 0) {
const len = direction.current.length();
if (len > 0.01) {
  direction.current.normalize();
  velocity.current.copy(direction.current).multiplyScalar(speed * dt * Math.min(len, 1));
  group.current.position.add(velocity.current);
}

  // rotate model toward actual movement direction
  const angle = Math.atan2(direction.current.x, direction.current.z);
  group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, angle, 0.15);
}


    const target = group.current.position;
    camera.position.lerp(
      new THREE.Vector3(target.x + 1, target.y + 2, target.z + 5),
      0.08
    );
    camera.lookAt(target);

// Jump must always be allowed
if (keys.current.Space) {
  play("Jump", 0.2, "once");
  return;
}

/*ani stop*/
if (hasMovementInput) {
  // interrupt holds & once animations immediately
  if (holdState.current.active || actionLock.current) {
    forceToLocomotion();
  }
}

// --- LOCOMOTION ---
// Locomotion only if no action or Digit7 not active
// skip locomotion only if Digit7 is active
if (!actionLock.current && !holdState.current.active && !digit7Hold.current) {
  if (!hasMovementInput) play("Idle");
  else if (isRunning) play("Run", .25);
  else play("Walk");
}





/*// block locomotion only
if (actionLock.current || holdState.current.active) return;

if (direction.current.length() === 0) {
  play("Idle");
} else if (keys.current.ShiftLeft) {
  play("Run");
} else {
  play("Walk");
}
  });*/
  /*
// block locomotion only
if (actionLock.current || holdState.current.active) return;

if (!hudActive.current) {
  if (direction.current.length() === 0) play("Idle");
  else if (keys.current.ShiftLeft) play("Run");
  else play("Walk");
}*/
  });

  /*stopani*/
const forceToLocomotion = () => {
  // HARD reset hold state
  holdState.current.active = null;
  holdState.current.phase = null;

  actionLock.current = false;

  // STOP ALL ACTIONS immediately
  Object.values(actions || {}).forEach((a) => {
    a.stop();
  });

  currentAction.current = null;
};



  return (
    <group ref={group} scale={1.8}>
      <primitive object={scene} />
    </group>
  );
});

export default NeonModel;

