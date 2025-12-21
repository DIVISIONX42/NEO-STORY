import "./GameHUD.scss";

export default function GameHUD({ modelRef, currentAnim }) {
  if (!modelRef?.current) return null;

  const play = (name) => modelRef.current.playOnce(name);
  const holdStart = (name) => modelRef.current.playHoldStart(name);
  const holdEnd = () => modelRef.current.playHoldEnd();
  const move = (dir) => modelRef.current.move(dir);
  const stop = () => modelRef.current.stopMove();

  return (
    <div className="hud">
      <div className="anim-buttons">
        <button onClick={() => play("Bark")}>🐕 Bark</button>
        <button
          onTouchStart={() => holdStart("Sit")}
          onTouchEnd={holdEnd}
          onMouseDown={() => holdStart("Sit")}
          onMouseUp={holdEnd}
        >
          🪑 Sit
        </button>
        <button onClick={() => play("Howl")}>🌙 Howl</button>
        <button onClick={() => play("Fetch")}>🎾 Fetch</button>
        <button onClick={() => play("Bite")}>🦷 Bite</button>
        <button onClick={() => play("Death")}>☠️ Death</button>
        <button
          onTouchStart={() => holdStart("Sneak")}
          onTouchEnd={holdEnd}
          onMouseDown={() => holdStart("Sneak")}
          onMouseUp={holdEnd}
        >
          🕶 Sneak
        </button>
      </div>

      <div className="movement">
        <button onTouchStart={() => move("forward")} onTouchEnd={stop}>⬆️</button>
        <div>
          <button onTouchStart={() => move("left")} onTouchEnd={stop}>⬅️</button>
          <button onTouchStart={() => move("backward")} onTouchEnd={stop}>⬇️</button>
          <button onTouchStart={() => move("right")} onTouchEnd={stop}>➡️</button>
        </div>
        <button onTouchStart={() => move("run")} onTouchEnd={stop}>🏃 Run</button>
      </div>

      <div className="status">Current: {currentAnim}</div>
    </div>
  );
}
