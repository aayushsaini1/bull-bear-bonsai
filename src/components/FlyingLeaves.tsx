import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FlyingLeavesProps {
  dailyChangePercent: number;
  weeklyChangePercent: number;
}

const LEAF_COUNT = 24; // Reduced count for a cleaner, more subtle look

// Color constants matching the tree leaves color logic
const BEAR_COLOR = new THREE.Color('#b33925');
const FLAT_COLOR = new THREE.Color('#dbab25');
const BULL_COLOR = new THREE.Color('#1b7a2d');

function getLeafColor(changePercent: number): THREE.Color {
  const clamped = Math.max(-1.5, Math.min(1.5, changePercent));
  const color = new THREE.Color();
  if (clamped >= 0) {
    const factor = clamped / 1.5;
    color.lerpColors(FLAT_COLOR, BULL_COLOR, factor);
  } else {
    const factor = Math.abs(clamped) / 1.5;
    color.lerpColors(FLAT_COLOR, BEAR_COLOR, factor);
  }
  return color;
}

function getWindForce(weeklyChange: number): number {
  if (weeklyChange > 1.0) return 0.4;
  if (weeklyChange >= -0.5) return 0.08;
  if (weeklyChange >= -2.0) return 0.8;
  return 1.8;
}

export const FlyingLeaves: React.FC<FlyingLeavesProps> = ({
  dailyChangePercent,
  weeklyChangePercent,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const windForce = useMemo(() => getWindForce(weeklyChangePercent), [weeklyChangePercent]);
  const leafColor = useMemo(() => getLeafColor(dailyChangePercent), [dailyChangePercent]);

  // Create a organic flat leaf shape: almond/pointed shape centered at (0,0)
  const leafShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.045, 0);
    shape.quadraticCurveTo(0, 0.03, 0.045, 0);   // Top curved edge to tip
    shape.quadraticCurveTo(0, -0.03, -0.045, 0); // Bottom curved edge back
    return shape;
  }, []);

  // Keep a local array of leaf data for updating matrices:
  // position, velocity, rotation, rotation speed, scale
  const leafData = useMemo(() => {
    const data = [];
    for (let i = 0; i < LEAF_COUNT; i++) {
      data.push({
        x: -4.0 + Math.random() * 8.5,        // Fully distributed across x
        y: -1.65 + Math.random() * 5.0,       // Fully distributed across y
        z: -3.0 + Math.random() * 6.0,        // Fully distributed across z
        vx: -0.1 - Math.random() * 0.3,       // Soft drift leftwards
        vy: -0.3 - Math.random() * 0.3,       // Soft fall speed
        vz: (Math.random() - 0.5) * 0.15,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        vrx: (Math.random() - 0.5) * 1.5,     // Tumble rotation speed
        vry: (Math.random() - 0.5) * 1.5,
        vrz: (Math.random() - 0.5) * 1.5,
        scale: 0.6 + Math.random() * 0.6,     // Scale variations
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 1 + Math.random() * 2,
      });
    }
    return data;
  }, []);

  // Update instance colors whenever the target color changes
  useEffect(() => {
    if (!meshRef.current) return;
    const tempColor = new THREE.Color();
    for (let i = 0; i < LEAF_COUNT; i++) {
      const lightnessFactor = 0.85 + (i % 5) * 0.06; 
      tempColor.copy(leafColor).multiplyScalar(lightnessFactor);
      meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [leafColor]);

  // Physics update loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();
    const elapsedTime = state.clock.getElapsedTime();

    // Scale wind effect on physical movement
    const windPushX = -windForce * 1.6;
    const windTurbulence = windForce * 0.5;

    for (let i = 0; i < LEAF_COUNT; i++) {
      const data = leafData[i];

      // 1. Position update
      // Gravity pulls down, wind pushes left
      data.x += (data.vx + windPushX) * delta;
      data.y += data.vy * delta;
      data.z += (data.vz + Math.sin(elapsedTime * data.swaySpeed + data.swayOffset) * 0.1) * delta;

      // 2. Rotation update (tumbling in the wind)
      const tumbleMultiplier = 1.0 + windTurbulence * 2.5;
      data.rx += data.vrx * tumbleMultiplier * delta;
      data.ry += data.vry * tumbleMultiplier * delta;
      data.rz += data.vrz * tumbleMultiplier * delta;

      // 3. Ground boundary check or offscreen check
      // Ground is at y = -1.65. Screen left boundary is roughly x = -4.0.
      if (data.y < -1.65 || data.x < -4.0) {
        // Recycle leaf back to the right edge, distributed randomly across height & depth
        data.x = 3.5 + Math.random() * 1.5;
        data.y = -1.0 + Math.random() * 4.5;
        data.z = -3.0 + Math.random() * 6.0;
        data.vx = -0.1 - Math.random() * 0.3;
        data.vy = -0.3 - Math.random() * 0.3;
        data.vz = (Math.random() - 0.5) * 0.15;
      }

      // 4. Update the instance matrix
      tempObject.position.set(data.x, data.y, data.z);
      tempObject.rotation.set(data.rx, data.ry, data.rz);
      tempObject.scale.setScalar(data.scale);
      tempObject.updateMatrix();

      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null as any, null as any, LEAF_COUNT]}
      castShadow
      receiveShadow
    >
      <shapeGeometry args={[leafShape]} />
      <meshStandardMaterial
        roughness={0.8}
        metalness={0.1}
        side={THREE.DoubleSide}
        shadowSide={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};

export default FlyingLeaves;
