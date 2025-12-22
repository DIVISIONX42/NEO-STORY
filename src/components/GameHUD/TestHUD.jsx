import React from "react";

export default function MiniHUD({ modelRef }) {
  const buttons = [
    { name: "Bark", label: "🐕", hold: false },
    { name: "Sit", label: "🪑", hold: true },
    { name: "Howl", label: "🌙", hold: false },
  ];

  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      left: 20,
      display: "flex",
      gap: 10,
      pointerEvents: "auto"
    }}>
      {buttons.map(btn => (
        <button
          key={btn.name}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            background: "rgba(0,0,0,0.7)",
            color: "#0ff",
            fontSize: 24,
          }}
          onMouseDown={() => modelRef.current?.playAnim(btn.name, btn.hold)}
          onMouseUp={() => btn.hold && modelRef.current?.stopHold()}
          onTouchStart={() => modelRef.current?.playAnim(btn.name, btn.hold)}
          onTouchEnd={() => btn.hold && modelRef.current?.stopHold()}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
