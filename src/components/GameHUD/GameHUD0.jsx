import { useRef } from "react";

export default function GameHUD({ onMove, onAction }) {
  const joystickRef = useRef({ x: 0, y: 0 });

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    // simple relative movement: left half = joystick
    const width = window.innerWidth / 2;
    const x = (touch.clientX / width) * 2 - 1; // -1 .. 1
    const y = ((touch.clientY / window.innerHeight) * 2 - 1) * -1;
    joystickRef.current = { x, y };
    onMove?.(x, y);
  };

  const handleTouchEnd = () => {
    joystickRef.current = { x: 0, y: 0 };
    onMove?.(0, 0);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        fontFamily: "monospace",
        color: "#0ff",
      }}
    >
      {/* LEFT: Joystick */}
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

      {/* RIGHT: Action buttons */}
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
        <button
          style={buttonStyle}
          onTouchStart={() => onAction("Bark")}
        >
          🐶
        </button>
        <button
          style={buttonStyle}
          onTouchStart={() => onAction("Sit")}
        >
          💺
        </button>
        <button
          style={buttonStyle}
          onTouchStart={() => onAction("Fetch")}
        >
          🎾
        </button>
        <button
          style={buttonStyle}
          onTouchStart={() => onAction("Sneak")}
        >
          🥷
        </button>
      </div>
    </div>
  );
}

const buttonStyle = {
  width: 60,
  height: 60,
  borderRadius: 30,
  background: "rgba(0,0,0,0.7)",
  border: "2px solid cyan",
  fontSize: 24,
  color: "#0ff",
};
