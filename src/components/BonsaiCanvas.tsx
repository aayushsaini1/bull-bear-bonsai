import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import BonsaiTree from './BonsaiTree';
import WeatherSystem from './WeatherSystem';

interface BonsaiCanvasProps {
  dailyChangePercent: number;
  weeklyChangePercent: number;
  leafDensity: number;
}

export const BonsaiCanvas: React.FC<BonsaiCanvasProps> = ({
  dailyChangePercent,
  weeklyChangePercent,
  leafDensity,
}) => {
  return (
    <div className="canvas-container">
      <Canvas
        shadows
        camera={{ position: [0, 0.7, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#f8fafc89'); // Light premium base background
          gl.toneMappingExposure = 0.75; // Prevent HDRI reflections from overexposing
        }}
      >
        <Suspense fallback={null}>
          {/* HDRI lighting environment */}
          <Environment files="/outdoor-hdri.hdr" background={false} />

          {/* Weather visual & lighting system */}
          <WeatherSystem weeklyChangePercent={weeklyChangePercent} />

          {/* Bonsai Tree and ceramic pot */}
          <group position={[0.6, 0, 0]}>
            <BonsaiTree
              dailyChangePercent={dailyChangePercent}
              weeklyChangePercent={weeklyChangePercent}
              leafDensity={leafDensity}
            />
          </group>

          {/* Table Pedestal to support the pot */}
          {/* <mesh receiveShadow position={[0.6, -1.7, 0]}>
            <cylinderGeometry args={[1.0, 1.15, 0.1, 32]} />
            <meshStandardMaterial
              color="#e2e8f0" // Light marble/concrete stone
              roughness={0.5}
              metalness={0.2}
            />
          </mesh> */}

          {/* Contact Shadows on the table pedestal for realistic occlusion */}
          <ContactShadows
            position={[0.6, -1.64, 0]}
            opacity={0.7}
            scale={2.5}
            blur={2.0}
            far={1.0}
          />

          {/* Viewport Orbiting Control Constraints */}
          <OrbitControls
            enableDamping
            dampingFactor={0.06}
            minDistance={2.5}
            maxDistance={7.5}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera going below table
            target={[0.6, -1, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
export default BonsaiCanvas;
