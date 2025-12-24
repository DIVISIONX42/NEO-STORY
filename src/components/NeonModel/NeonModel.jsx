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

const velocity = useRef(new THREE.Vector3())
const inputDir = useRef(new THREE.Vector3())
const grounded = useRef(true)

const MAX_WALK = 1.2
const MAX_RUN = 3.5
const ACCEL = 18
const DAMPING = 10


useImperativeHandle(ref, () => ({
  playAnim: (name) => {
    if (name === "Sneak") {
      digit7Hold.current = !digit7Hold.current;
      // Force update immediately
      updateLocomotion(moveVector.length());
    } else {
      // Play Bark, Bite, etc.
      play(name, 0.2, "once");
    }
  }
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
          opacity: 1,
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

const playDigit2 = () => {
  if (!actions?.["Sit"]) return;
  
  // Use the helper to handle the crossfade correctly
  play("Sit", 0.2, "loop");
  
  holdState.current = { active: "Sit", phase: "loop" };
  actionLock.current = true;
};

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

const playOverlay = (name, speed = 2, pingPong = false) => {
  const action = actions?.[name];
  if (!action) return;

  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.timeScale = pingPong ? -2 : speed; // pingpong via negative timeScale toggle
  action.fadeIn(0.15).play();

  currentAction.current = action;
  setCurrentAnim(name);

  // no actionLock — allows movement
};

// Function to handle automatic locomotion changes
const updateLocomotion = (speed) => {
  if (actionLock.current) return;

  let target = "Idle";
  if (speed > 0.1) {
    // If Sneak toggle is active, walking/running is replaced by Sneak
    target = digit7Hold.current ? "Sneak" : (speed > 2 ? "Run" : "Walk");
  } else {
    // If Sneak is active but we are standing still
    target = "Idle"; 
  }

  if (currentAnim !== target) {
    play(target, 0.3, "loop");
  }
};


  /* ---------------- MOVEMENT ---------------- */
  
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
  Sit: { loop: "Sit", end: "Idle" },
  Sneak: { loop: "Sneak", end: "Idle" },
  Fetch: { loop: "Fetch", end: "Idle" },
};


  /* ---------------- SPECIAL KEYS ---------------- */
  const specialAnims = {
    Digit1: { name: "Bark", mode: "once" },
    Digit2: { name: "Sit", mode: "once" },
    Digit3: { name: "Howl", mode: "once" },
    Digit4: { name: "Fetch", mode: "once" },
    Digit5: { name: "Bite", mode: "once" },
    Digit6: { name: "Death", mode: "once" },
    Digit7: { name: "Sneak", mode: "hold" },
  };

  /*PLAY HELPER* */
const play = (name, fade = 0.2, mode = "loop") => {
  const nextAction = actions?.[name];
  if (!nextAction) return;

  // If already playing this, don't restart unless it's a 'once' action
  if (currentAnim === name && nextAction.isRunning() && mode !== "once") return;

  // 1. Fade out everything else to prevent the "Sit" leak
  Object.values(actions).forEach((action) => {
    if (action !== nextAction) action.fadeOut(fade);
  });

  // 2. Setup next action
  nextAction
    .reset()
    .setEffectiveWeight(1)
    .setEffectiveTimeScale(1)
    .setLoop(mode === "once" ? THREE.LoopOnce : THREE.LoopRepeat)
    .fadeIn(fade)
    .play();

  // 3. Handle 'Once' completion
  if (mode === "once") {
    nextAction.clampWhenFinished = true;
    actionLock.current = true;
    
    const onFinished = (e) => {
      if (e.action === nextAction) {
        nextAction.getMixer().removeEventListener("finished", onFinished);
        actionLock.current = false;
        // Locomotion logic in useFrame will handle the return to Idle/Walk
      }
    };
    nextAction.getMixer().addEventListener("finished", onFinished);
  }

  currentAction.current = nextAction;
  setCurrentAnim(name);
  // 🔹 Notify HUD of current animation
if (onAnimChange) onAnimChange(name);
};

  /* ---------------- HOLD PLAY ---------------- */
const playHold = (name) => {
  const cfg = holdAnimations[name];
  if (!cfg || !actions) return;

  const loop = actions[cfg.loop];
  if (!loop) return;

  // CRITICAL: If we are already playing this hold animation, DO NOT reset it.
  if (holdState.current.active === name && currentAnim === cfg.loop) return;

  // Fade out everything else to prevent "Sit" from leaking in
  Object.values(actions).forEach(a => a.fadeOut(0.2));

  loop.reset()
      .setEffectiveWeight(1)
      .setLoop(THREE.LoopRepeat)
      .fadeIn(0.2)
      .play();

  holdState.current = { active: name, phase: "loop" };
  currentAction.current = loop;
  setCurrentAnim(cfg.loop);
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
    state.phase = "loop";

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
    setCurrentAnim(cfg.start);
  };
  /*---preventsitting--*/

  useEffect(() => {
  if (actions) {
    // Stop all GLTF default animations
    Object.values(actions).forEach(a => a.stop());
    // Start cleanly in Idle
    play("Idle", 0, "loop");
  }
}, [actions]);

  useEffect(() => {
  if (actions) {
    // Stop everything so it doesn't default to Sit or Idle instantly
    Object.values(actions).forEach((action) => action.stop());
    // Start with a clean Idle
    if (actions["Idle"]) {
      actions["Idle"].play();
      currentAction.current = actions["Idle"];
    }
  }
}, [actions]);
  /* ---------------- INPUT ---------------- */
  useEffect(() => {
const down = (e) => {
  if (e.repeat) return;
  keys.current[e.code] = true;

  const anim = specialAnims[e.code];
  if (!anim) return;

if (e.code === "Digit2") {
  const isMoving = direction.current.length() > 0;
  if (isMoving) playOverlay("Sit", 1);
  else playHold("Sit"); // loop plays immediately, no Sit_Start
  return;
}

if (e.code === "Digit4") {
  const isMoving = direction.current.length() > 0;
  if (isMoving) playOverlay("Fetch", 1, true);
  else playHold("Fetch", true); // skip Fetch_Start
}

if (e.code === "Digit7") {
  const isMoving = direction.current.length() > 0;
  if (!isMoving) return;
  digit7Hold.current = true;
  forceToLocomotion();
  playHold("Sneak", true); // skip Sneak_Start if you want
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

useFrame((_, delta) => {
  if (!group.current) return

  const speedInput = Math.min(1, inputDir.current.length())
  const targetSpeed = THREE.MathUtils.lerp(
    MAX_WALK,
    MAX_RUN,
    speedInput
  )

  const desired = inputDir.current.clone().multiplyScalar(targetSpeed)

  velocity.current.lerp(desired, 1 - Math.exp(-ACCEL * delta))
  velocity.current.multiplyScalar(1 - Math.exp(-DAMPING * delta))

  group.current.position.addScaledVector(velocity.current, delta)

  if (velocity.current.lengthSq() > 0.001) {
    group.current.lookAt(
      group.current.position.clone().add(velocity.current)
    )
  }
})

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

function getInputVector(joystick, keys) {
  const x =
    (keys.current["ArrowRight"] ? 1 : 0) -
    (keys.current["ArrowLeft"] ? 1 : 0)

  const z =
    (keys.current["ArrowDown"] ? 1 : 0) -
    (keys.current["ArrowUp"] ? 1 : 0)

  inputDir.current.set(
    joystick?.x ?? x,
    0,
    joystick?.y ?? z
  )

  // dead-zone
  if (inputDir.current.length() < 0.15) {
    inputDir.current.set(0, 0, 0)
  }

  inputDir.current.normalize()
}


// ---- KEYBOARD INPUT ----
if (keys.current.KeyW || keys.current.ArrowUp) direction.current.z -= 1;
if (keys.current.KeyS || keys.current.ArrowDown) direction.current.z += 1;
if (keys.current.KeyA || keys.current.ArrowLeft) direction.current.x -= 1;
if (keys.current.KeyD || keys.current.ArrowRight) direction.current.x += 1;

// ---- JOYSTICK INPUT ----
if (moveVector) {
  direction.current.x += moveVector.x;
  direction.current.z += moveVector.y;
}

const hasInput = direction.current.length() > 0.05;

const isRunning =
  keys.current.ShiftLeft ||
  (moveVector && Math.abs(moveVector.x) + Math.abs(moveVector.y) > 0.75);

const targetSpeed = hasInput
  ? (isRunning ? RUN_SPEED : WALK_SPEED)
  : 0;

if (hasInput) direction.current.normalize();

// Desired velocity
const desiredVelocity = direction.current.multiplyScalar(targetSpeed);

// Smooth acceleration
velocity.current.lerp(
  desiredVelocity,
  hasInput ? ACCEL * dt : DECEL * dt
);

// Apply movement
group.current.position.addScaledVector(velocity.current, dt);
if (velocity.current.length() > 0.1) {
  const angle = Math.atan2(
    velocity.current.x,
    velocity.current.z
  );

  group.current.rotation.y = THREE.MathUtils.lerp(
    group.current.rotation.y,
    angle,
    0.12
  );
}

const len = direction.current.length();
if (len > 0.05) {
  direction.current.normalize();
  group.current.position.addScaledVector(direction.current, dt * 2.5);

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
// Only play locomotion if no other animation is active
if (!actionLock.current && !holdState.current.active) {
const speed = velocity.current.length()

if (speed < 0.05) {
  fadeTo("Idle", 0.2)
} else if (speed < 1.6) {
  fadeTo("Walk", 0.2)
} else {
  fadeTo("Run", 0.2)
}
}

function fadeTo(name, duration) {
  if (activeAction.current?.getClip().name === name) return

  const next = actions[name]
  activeAction.current?.fadeOut(duration)
  next.reset().fadeIn(duration).play()
  activeAction.current = next
}
const stepTimer = useRef(0)

stepTimer.current += delta * speed

if (stepTimer.current > 0.6 && speed > 0.4) {
  playFootstep()
  stepTimer.current = 0
}
if (!grounded.current) {
  velocity.current.y -= 9.8 * delta
} else {
  velocity.current.y = 0
}
const camTarget = group.current.position.clone()
camTarget.y += 1.6

camera.position.lerp(
  camTarget.clone().add(new THREE.Vector3(0, 2, 4)),
  1 - Math.exp(-4 * delta)
)

camera.lookAt(camTarget)


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