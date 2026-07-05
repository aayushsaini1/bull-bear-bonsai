import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface BonsaiTreeProps {
  dailyChangePercent: number;    // Leaves color: -1.5% (red/brown) -> 0% (yellow) -> +1.5% (green)
  weeklyChangePercent: number;   // Weather/Wind sway: sunny (soft) -> cloudy (still) -> rainy (moderate) -> storm (heavy)
  leafDensity: number;           // Leaf count/scale: 0 (bare) -> 1 (lush)
}

// Color constants
const BEAR_COLOR = new THREE.Color('#b33925'); // Deep crimson/brownish red
const FLAT_COLOR = new THREE.Color('#dbab25'); // Warm golden amber/yellow
const BULL_COLOR = new THREE.Color('#1b7a2d'); // Forest green

/**
 * Returns interpolated color based on daily change percentage
 */
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

/**
 * Maps weekly change percent to wind intensity factor
 */
function getWindForce(weeklyChange: number): number {
  if (weeklyChange > 1.0) return 0.4;
  if (weeklyChange >= -0.5) return 0.08;
  if (weeklyChange >= -2.0) return 0.8;
  return 1.8;
}

export const BonsaiTree: React.FC<BonsaiTreeProps> = ({
  dailyChangePercent,
  weeklyChangePercent,
  leafDensity,
}) => {
  // Load the GLB model from public folder
  const { scene } = useGLTF('/sakura.glb');

  // Clone the scene and clone materials to prevent global texture leaks
  const { clonedScene, leafMeshes, branchMeshes } = useMemo(() => {
    const clone = scene.clone();
    const leaves: { mesh: THREE.Mesh; hash: number }[] = [];
    const branches: { mesh: THREE.Mesh; hash: number }[] = [];

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;

        // Generate a stable hash from name to distribute random characteristics
        const hash = child.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Map to leaves or branches
        // Based on sakura.glb data:
        // Leaf/Blossom meshes use materials named like "branch1.001", "branch2.002", etc.
        // Trunk/Branch meshes use the material named "Material"
        const matName = child.material && !Array.isArray(child.material) ? child.material.name : '';

        if (matName.includes('branch')) {
          // Clone leaf material and keep map for alpha shape, but override colors in shader
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map(m => {
                const mc = m.clone();
                mc.transparent = true;
                mc.onBeforeCompile = (shader: any) => {
                  shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    `
                    #ifdef USE_MAP
                      vec4 texelColor = texture2D( map, vMapUv );
                      diffuseColor.rgb = diffuse; // Use solid material color
                      diffuseColor.a *= texelColor.a; // Keep original alpha transparent mask
                    #endif
                    `
                  );
                };
                mc.needsUpdate = true;
                return mc;
              });
            } else {
              const mc = child.material.clone();
              mc.transparent = true;
              mc.onBeforeCompile = (shader: any) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                  '#include <map_fragment>',
                  `
                  #ifdef USE_MAP
                    vec4 texelColor = texture2D( map, vMapUv );
                    diffuseColor.rgb = diffuse; // Use solid material color
                    diffuseColor.a *= texelColor.a; // Keep original alpha transparent mask
                  #endif
                  `
                );
              };
              mc.needsUpdate = true;
              child.material = mc;
            }
          }
          leaves.push({ mesh: child, hash });
        } else {
          // Clone branch/wood material (keep original texture)
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map(m => m.clone());
            } else {
              child.material = child.material.clone();
            }
          }
          branches.push({ mesh: child, hash });
        }
      }
    });

    return { clonedScene: clone, leafMeshes: leaves, branchMeshes: branches };
  }, [scene]);

  // Automatically calculate bounding box scale factor to fit the pot size
  const scaleFactor = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    // Target height is ~2.0 units in world space
    const factor = 2.0 / maxDim;
    return [factor, factor, factor] as [number, number, number];
  }, [clonedScene]);

  // Compute leaf color and wind force dynamically
  const leafColor = useMemo(() => getLeafColor(dailyChangePercent), [dailyChangePercent]);
  const windForce = useMemo(() => getWindForce(weeklyChangePercent), [weeklyChangePercent]);

  // Animate wind, colors, and density in the render loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const swayFreq = 1.2 + windForce * 0.5;
    const swayAmp = windForce * 0.05;

    // Map leafDensity to ensure a minimum visual density of 45% is always maintained
    const mappedDensity = 0.45 + leafDensity * 0.55;

    // 1. Animate leaves (color, density scale, high frequency flutter)
    leafMeshes.forEach(({ mesh, hash }) => {
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        // Set color dynamically matching bull/bear
        mat.color.copy(leafColor);
        mat.roughness = 0.55;
        mat.metalness = 0.1;
      }

      // Smooth density scaling:
      // Distribute thresholds deterministically using the hash value [0, 0.85]
      const threshold = (hash % 85) / 100;
      if (mappedDensity < threshold) {
        mesh.scale.set(0, 0, 0); // Hide completely
      } else {
        // Smoothly grow leaf mesh to full size
        const growthFactor = Math.max(0, Math.min(1, (mappedDensity - threshold) / 0.15));
        // Scale leaf meshes slightly larger at high density for a much more lush appearance
        const scaleMultiplier = 1.0 + mappedDensity * 0.45;
        const finalScale = growthFactor * scaleMultiplier;
        mesh.scale.set(finalScale, finalScale, finalScale);
      }

      // Leaf flutter sway
      mesh.rotation.x = Math.sin(time * 6.0 + hash) * windForce * 0.06;
      mesh.rotation.z = Math.cos(time * 5.0 + hash) * windForce * 0.06;
    });

    // 2. Animate branches & trunk (gentle organic wind bending sway)
    branchMeshes.forEach(({ mesh, hash }) => {
      // Rotate branch nodes based on hierarchy depth and wind force
      const swayOffset = Math.sin(time * swayFreq + hash) * swayAmp * 0.05;
      mesh.rotation.z = swayOffset;
      mesh.rotation.x = Math.cos(time * swayFreq * 0.7 + hash) * swayAmp * 0.03;
    });
  });

  return (
    <group position={[0, -1.65, 0]}>
      {/* Decorative Ceramic Bonsai Pot */}
      <mesh receiveShadow castShadow position={[0, 0.175, 0]}>
        <cylinderGeometry args={[0.7, 0.55, 0.35, 16]} />
        <meshStandardMaterial
          color="#ffffff" // White glossy ceramic
          roughness={0.1}
          metalness={0.7}
        />
      </mesh>

      {/* Soil */}
      <mesh receiveShadow position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.67, 0.65, 0.05, 16]} />
        <meshStandardMaterial color="#3a2e2b" roughness={0.8} />
      </mesh>

      {/* The custom loaded model primitive, scaled and slightly lowered into the soil */}
      <primitive
        object={clonedScene}
        position={[0, 0.3, 0]}
        scale={scaleFactor}
      />
    </group>
  );
};

export default BonsaiTree;
