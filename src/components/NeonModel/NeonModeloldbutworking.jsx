import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function NeonModel({ modelPath, onAnimChange }) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

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
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    play("Idle");
    setReady(true);
  }, [scene]);

  /* ---------------- LOOP ---------------- */
  useFrame(({ camera }, dt) => {
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
}
