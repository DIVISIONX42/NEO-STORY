import { useState, useEffect, useRef } from "react";

export default function GameHUD({ modelRef, currentAnim, specialAnimsDuration, onMove }) {
  const [activeButtons, setActiveButtons] = useState({});
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickRef = useRef(null);
  const dragging = useRef(false);

  const animButtons = [
    { anim: "Bark", icon: "🐕", hold: false, key: "Digit1" },
    { anim: "Sit", icon: "🪑", hold: true, key: "Digit2" },
    { anim: "Howl", icon: "🌙", hold: false, key: "Digit3" },
    { anim: "Fetch", icon: "🎾", hold: false, key: "Digit4" },
    { anim: "Bite", icon: "🦷", hold: false, key: "Digit5" },
    { anim: "Death", icon: "☠️", hold: false, key: "Digit6" },
    { anim: "Sneak", icon: "🕶", hold: true, key: "Digit7" },
  ];

  const triggerAnim = (anim, hold = false) => {
    if (!modelRef?.current) return;
    if (hold && activeButtons[anim]?.holdActive) return;
    modelRef.current.playAnim(anim, hold);
    const duration = specialAnimsDuration?.[anim] || 1;
    setActiveButtons(prev => ({
      ...prev,
      [anim]: { start: performance.now(), duration, progress: 0, holdActive: hold },
    }));
  };

  const releaseHold = anim => {
    if (!modelRef?.current) return;
    modelRef.current.stopHold();
    setActiveButtons(prev => {
      const copy = { ...prev };
      delete copy[anim];
      return copy;
    });
  };

  useEffect(() => {
  document.body.style.touchAction = "none";
  return () => (document.body.style.touchAction = "auto");
}, []);


  useEffect(() => {
    let raf;
    const tick = () => {
      setActiveButtons(prev => {
        const next = {};
        Object.entries(prev).forEach(([anim, info]) => {
          const elapsed = (performance.now() - info.start) / (info.duration * 1000);
          if (elapsed < 1) next[anim] = { ...info, progress: elapsed, holdActive: info.holdActive };
        });
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const down = e => {
      const btn = animButtons.find(b => b.key === e.code);
      if (btn) triggerAnim(btn.anim, btn.hold);
    };
    const up = e => {
      const btn = animButtons.find(b => b.key === e.code);
      if (btn?.hold) releaseHold(btn.anim);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Joystick functions
  const startDrag = e => {
    e.preventDefault();
    dragging.current = true;
  };

  const stopDrag = e => {
    dragging.current = false;
    setJoystickPos({ x: 0, y: 0 });
    onMove?.({ x: 0, y: 0 });
  };

const moveDrag = (e) => {
  if (!dragging.current) return;

  const rect = joystickRef.current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  let dx = clientX - cx;
  let dy = clientY - cy;

  const max = rect.width / 2;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length > max) {
    dx = (dx / length) * max;
    dy = (dy / length) * max;
  }

  setJoystickPos({ x: dx, y: dy });
  onMove?.({ x: dx / max, y: -dy / max });
};


  // Desktop drag anywhere
  useEffect(() => {
    const move = e => moveDrag(e);
    const up = e => stopDrag(e);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "auto", zIndex: 9999 }}>
      {/* Current Animation */}
      <div style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 24,
        color: "#0ff"
      }}>
        Current: {currentAnim}
      </div>

      {/* Buttons */}
      <div style={{
        position: "absolute",
  /*      bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,*/

  bottom: "5%",
  right: "5%",
  display: "flex",
  flexDirection: "column",
  gap: "2vh",
      }}>
        {animButtons.map(({ anim, icon, hold }) => {
          const active = activeButtons[anim];
          const progress = active?.progress || 0;
          return (
            <div key={anim} style={{ position: "relative" }}>
              <button
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  background: "rgba(0,0,0,0.7)",
                  border: `2px solid ${active ? "#0ff" : "cyan"}`,
                  color: "#0ff",
                  fontSize: 24,
                }}
                onMouseDown={() => triggerAnim(anim, hold)}
                onMouseUp={() => hold && releaseHold(anim)}
                onTouchStart={() => triggerAnim(anim, hold)}
                onTouchEnd={() => hold && releaseHold(anim)}
              >
                {icon}
              </button>
              {active && (
                <svg
                  style={{ position: "absolute", top: 0, left: 0 }}
                  width={60}
                  height={60}
                  viewBox="0 0 36 36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    stroke="#0ff"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={`${progress * 100}, 100`}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Joystick */}
      // Joystick container

<div
  ref={joystickRef}
  onMouseDown={startDrag}
  onTouchStart={startDrag}
  onMouseLeave={() => hold && releaseHold(anim)}

  style={{
    position: "absolute",
/*    bottom: 20,
    left: 20,
    width: 100,
    height: 100, */
    borderRadius: "50%",
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
/*    touchAction: "none",*/

  bottom: "5%",
  left: "5%",
  width: "15vw",
  maxWidth: 100,
  height: "15vw",
  maxHeight: 100,
  }}
>
  {/* Outer Circle */}
  <div style={{
    width: 100,
    height: 100,
    borderRadius: "50%",
    border: "2px solid #0ff",
    position: "absolute",
    top: 0,
    left: 0,
  }} />
  {/* Inner Thumb */}
  <div style={{
    width: 50,
    height: 50,
    borderRadius: "50%",
    background: "rgba(0,255,255,0.7)",
    transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
  }} />
  {/* Movement Direction Line */}
  <div style={{
    position: "absolute",
    width: 2,
    height: Math.sqrt(joystickPos.x ** 2 + joystickPos.y ** 2),
    background: "#0ff",
    top: "50%",
    left: "50%",
    transformOrigin: "top",
    transform: `translate(-1px, -50%) rotate(${Math.atan2(joystickPos.y, joystickPos.x)}rad)`
  }} />
</div>
    </div>
  );
}
