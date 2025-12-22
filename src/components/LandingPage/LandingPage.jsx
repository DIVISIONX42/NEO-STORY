import React, { useState } from "react";
import "./LandingPage.scss";
import { Canvas } from "@react-three/fiber";
import { Backdrop } from "@react-three/drei";
import LightingAndEffects from "../LightingAndEffects/LightingAndEffects";
import Parallax from "../Parallax/Parallax";
import NeonModel from "../NeonModel/NeonModel.jsx";
import { MemoizedGround as Ground } from "../Ground/Ground";
import primitivesData from "../../utils/primitivesData";
import { useSpring, animated } from "@react-spring/web";
import { Perf } from "r3f-perf";
import { OrbitControls } from "@react-three/drei";
import GameHUD from "../../components/GameHUD/GameHUD2.jsx";
import { Html } from "@react-three/drei";


const LandingPage = ({ enterStory, setEnterStory }) => {
  const [currentModel, setCurrentModel] = useState("FOXModel");
  const [IsFullScreen, setIsFullScreen] = useState(false);

  // ✅ ADD THIS
  const [currentAnim, setCurrentAnim] = useState("Idle");


  const sceneConfig = {
    fogColor: primitivesData[currentModel].fogColor,
    fogNear: 7.1,
    fogFar: 20.3,
    ambientLightIntensity: 1,
    luminanceThreshold1: 0.2,
    luminanceThreshold2: 0,
    intensity2: 0.2,
    backDropPosition: [0, -0.5, -4.75],
    backDropScale: [50, 20, 5],
    backdropColor: "#121316",
  };

  const landingSpring = useSpring({
    opacity: enterStory ? 0 : 1,
    config: { tension: 100, friction: 100, duration: 800 },
  });

  const enterFullScreen = () => {
    if (!IsFullScreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  const enterToStory = () => {
    enterFullScreen();
    setEnterStory(true);
  };

  return (
    <animated.div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        zIndex: 4,
        ...landingSpring,
      }}
    >
      <div id="landing-page">
        <div className="nav-row">
          <div className="dev">
            <p className="developer">
              OUR story experiment built with three.js & R3F by{" "}
              <a target="_blank" href="https://github.com/SahilK-027">
                SahilK-027
              </a>
            </p>
            <div className="credits">
              Music by{" "}
              <a
                target="_blank"
                href="https://pixabay.com/users/clavier-music-16027823/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=271857"
              >
                Clavier-Music
              </a>
            </div>
            <p className="headphone-info">
              Use <i className="fa-solid fa-headphones"></i> for immersive
              experience
            </p>
          </div>
        </div>
        <div className="footer-row">
          <div className="experience-name">
            <h1 className="neon">NEO</h1>
            <h1 className="neon">STORIES</h1>
          </div>
          <div className="enter-button">
            <button onClick={enterToStory}>SEE</button>
            <h2>0</h2>
          </div>
        </div>

        <Canvas
          dpr={[1, Math.min(window.devicePixelRatio, 2)]}
          performance={{ min: 0.8 }}
            camera={{ position: [0, 1.5, 4], fov: 55 }}
          gl={{
            powerPreference: "high-performance",
            antialias: window.devicePixelRatio <= 1.5,
            alpha: true,
          }}
        >
<OrbitControls
  enableDamping
  dampingFactor={0.08}
  rotateSpeed={0.45}
  maxPolarAngle={Math.PI}      // allow full vertical rotation
  minPolarAngle={0}            // allow flipping under the model
  enablePan={true}
  enableZoom={true}
  minDistance={0.5}            // optional, how close the camera can get
  maxDistance={15}             // optional, how far camera can go
  //enableRotate={false}
/>

          {/* <Perf position="top-left" /> */}
          <color attach="background" args={["#161612"]} />
          <LightingAndEffects
            ambientLightIntensity={sceneConfig.ambientLightIntensity}
            fogColor={sceneConfig.fogColor}
            fogNear={sceneConfig.fogNear}
            fogFar={sceneConfig.fogFar}
            luminanceThreshold1={sceneConfig.luminanceThreshold1}
            intensity1={sceneConfig.intensity1}
            luminanceThreshold2={sceneConfig.luminanceThreshold2}
            intensity2={sceneConfig.intensity2}
          />
          <group position={[0, -0.7, 0]}>
            <Parallax startParallax={false}> {/*true 4 better starterpoint*/}
             
             <NeonModel
                modelPath={primitivesData[currentModel].path}
                curveConfigs={primitivesData[currentModel].shaders}
                  onAnimChange={setCurrentAnim}
              />
              
              <Backdrop
                floor={2}
                position={sceneConfig.backDropPosition}
                scale={sceneConfig.backDropScale}
              >
                <meshStandardMaterial
                  color={sceneConfig.backdropColor}
                  envMapIntensity={0.1}
                />
              </Backdrop>
            </Parallax>

<Html
  fullscreen
  style={{
    pointerEvents: "auto",
    zIndex: 10,
  }}
>
  <div className="sketchfab-embed-wrapper">
<iframe
  title="Shark Tamagotchi Fantasy Environment"
  src="https://sketchfab.com/models/9e6ab48d001045ee9b94c3e3b33f17cc/embed?autostart=1&transparent=1&ui_background=0&ui_controls=0&ui_infos=0&ui_watermark=0&ui_annotations=0"
  style={{
    width: "10vw",
    height: "10vh",
    border: "none",
  }}
  allow="autoplay; fullscreen; xr-spatial-tracking"
 />

  </div>

    <div
    className="lkg-blocks-player"
    style={{
      padding: "138.106% 0 0 0",
      position: "relative",
      width: "50vw",
      height: "50vh",
      opacity: ".8",
    }}
  >
    <iframe
      src="https://blocks.glass/embed/4955427f-adf7-4ae6-bc20-25be49fa125c"
      frameBorder="0"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
      allow="autoplay; encrypted-media; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
      allowFullScreen
    />
  </div>
</Html>
<Html
  fullscreen
  style={{ pointerEvents: "auto", zIndex: 10 }}
>
  <div
    className="lkg-blocks-player"
    style={{
      position: "absolute",
      top: "10%",
      left: "10%",
      padding: "1% 0 0 0",
      position: "relative",
      width: "50vw",
      height: "50vh",
      opacity: ".8",
      zIndex: 10,
    }}
  >
    <iframe
      src="https://blocks.glass/embed/22aa01b4-918a-4f67-8fc3-230acc5f76c4"
      frameBorder="0"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
      allow="autoplay; encrypted-media; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
      allowFullScreen
    />
  </div>
</Html>



            <Ground
              mirror={1}
              blur={[400, 100]}
              mixBlur={12}
              mixStrength={1.5}
              rotation={[-Math.PI / 2, 0, Math.PI / 2]}
              position={[0, -0.4, 0]}
            />
          </group>
        </Canvas>
              <GameHUD currentAnim={currentAnim} />

      </div>
    </animated.div>
  );
};

export default LandingPage;
