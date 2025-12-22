import { useState, useEffect } from "react";

export default function GameHUD({ modelRef, currentAnim, specialAnimsDuration }) {
  const [activeButtons, setActiveButtons] = useState({});

const triggerAnim = (name, hold = false) => {
  if (!modelRef?.current) return;

  // call the NeonModel animation
  modelRef.current.playAnim(name, hold);

  // start circular progress
  const duration = specialAnimsDuration[name] || 1;
  setActiveButtons(prev => ({
    ...prev,
    [name]: { start: performance.now(), duration, progress: 0 }
  }));
};



  const releaseHold = (name) => {
    if (!modelRef?.current) return;
    modelRef.current.stopHold();
  };

  // Animate circular progress
  useEffect(() => {
    let raf;
    const tick = () => {
      setActiveButtons(prev => {
        const next = {};
        Object.entries(prev).forEach(([anim, info]) => {
          const elapsed = (performance.now() - info.start) / (info.duration * 1000);
          if (elapsed < 1) next[anim] = { ...info, progress: elapsed };
        });
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
<div className="hud" style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", fontSize: 24, color: "#0ff" }}>
        Current: {currentAnim}
      </div>

      <div style={{ position: "absolute", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 12, pointerEvents: "auto" }}>
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
  onMouseDown={() => modelRef.current?.playAnim(anim, hold)}
  onMouseUp={() => hold && modelRef.current?.stopHold()}
  onTouchStart={() => modelRef.current?.playAnim(anim, hold)}
  onTouchEnd={() => hold && modelRef.current?.stopHold()}
  >
  {icon}
</button>


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
