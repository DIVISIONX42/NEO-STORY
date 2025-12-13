export default function GameHUD({ currentAnim }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "monospace",
        color: "#0ff",
        zIndex: 10,
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "8px 16px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.7)",
          border: "1px solid cyan",
        }}
      >
        ACTION: {currentAnim}
      </div>

      {/* BOTTOM PANEL */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          padding: 14,
          borderRadius: 14,
          background: "rgba(0,0,0,0.85)",
          border: "1px solid cyan",
          display: "flex",
          gap: 12,
          pointerEvents: "auto",
        }}
      >
        <button>Bark</button>
        <button>Sit</button>
        <button>Fetch</button>
        <button>Sneak</button>
      </div>
    </div>
  );
}
