import { useRef, useEffect, useState } from "react";

export default function GameHUD({ modelRef, onMove, currentAnim, specialAnimsDuration }) {
  const joystickRef = useRef({ x: 0, y: 0 });
  const [activeButtons, setActiveButtons] = useState({});

  // ---------------- Joystick ----------------
  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const width = window.innerWidth / 2;
    const x = (touch.clientX / width) * 2 - 1;
    const y = ((touch.clientY / window.innerHeight) * 2 - 1) * -1;
    joystickRef.current = { x, y };
    onMove?.(x, y);
  };

  const handleTouchEnd = () => {
    joystickRef.current = { x: 0, y: 0 };
    onMove?.(0, 0);
  };

  // ---------------- Circular progress ----------------
  useEffect(() => {
    let raf;
    const tick = () => {
      setActiveButtons((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, info]) => {
          const elapsed = (performance.now() - info.start) / (info.duration * 1000);
          if (elapsed < 1) next[key] = { ...info, progress: elapsed };
        });
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------------- Trigger animation ----------------
  const triggerAnim = (anim, hold = false) => {
    if (!modelRef?.current) return;
    if (hold) modelRef.current.play(anim); // hold
    else modelRef.current.play(anim);     // once

    const duration = specialAnimsDuration?.[anim] || 1;
    setActiveButtons((prev) => ({
      ...prev,
      [anim]: { start: performance.now(), duration, progress: 0 },
    }));
  };

  const releaseHold = (anim) => {
    if (!modelRef?.current) return;
    modelRef.current.stopHold();
  };

  // ---------------- Buttons ----------------
  const animButtons = [
    { anim: "Bark", icon: "🐕", hold: false },
    { anim: "Sit", icon: "🪑", hold: true },
    { anim: "Howl", icon: "🌙", hold: false },
    { anim: "Fetch", icon: "🎾", hold: false },
    { anim: "Bite", icon: "🦷", hold: false },
    { anim: "Death", icon: "☠️", hold: false },
    { anim: "Sneak", icon: "🕶", hold: true },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10, fontFamily: "monospace" }}>
      {/* Current animation */}
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", fontSize: 24, color: "#0ff" }}>
        {currentAnim}
      </div>

      {/* Left: joystick */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          width: 120,
          height: 120,
          borderRadius: 9999,
          background: "rgba(0,0,0,0.25)",
          border: "2px solid cyan",
          touchAction: "none",
          pointerEvents: "auto",
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            position: "absolute",
            left: 50 + joystickRef.current.x * 40,
            top: 50 - joystickRef.current.y * 40,
            width: 40,
            height: 40,
            borderRadius: 9999,
            background: "cyan",
          }}
        />
      </div>

      {/* Right: action buttons */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          pointerEvents: "auto",
        }}
      >
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
                  pointerEvents: "auto",
                }}
                onMouseDown={() => (hold ? triggerAnim(anim, true) : triggerAnim(anim))}
                onMouseUp={() => hold && releaseHold(anim)}
                onTouchStart={() => (hold ? triggerAnim(anim, true) : triggerAnim(anim))}
                onTouchEnd={() => hold && releaseHold(anim)}
              >
                {icon}
              </button>

              {/* Circular progress */}
              {active && (
                <svg style={{ position: "absolute", top: 0, left: 0 }} width={60} height={60} viewBox="0 0 36 36">
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
    </div>
  );
}
