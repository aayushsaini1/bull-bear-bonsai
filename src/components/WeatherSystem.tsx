import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface WeatherSystemProps {
  weeklyChangePercent: number; // Weather indicator
}

type WeatherState = 'sunny' | 'cloudy' | 'rainy' | 'storm';

function getWeatherState(weeklyChange: number): WeatherState {
  if (weeklyChange > 1.0) return 'sunny';
  if (weeklyChange >= -0.5) return 'cloudy';
  if (weeklyChange >= -2.0) return 'rainy';
  return 'storm';
}

// Particle parameters
const PARTICLE_COUNT = 150;

// Helper to draw soft circular and streak textures dynamically for particles
function createParticleTexture(type: 'mote' | 'rain'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  if (type === 'mote') {
    // Soft radial glowing circle
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
  } else {
    // Thin vertical streak for rain
    const grad = ctx.createLinearGradient(16, 2, 16, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(14, 0, 4, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export const WeatherSystem: React.FC<WeatherSystemProps> = ({ weeklyChangePercent }) => {
  const { scene } = useThree();
  const weather = useMemo(() => getWeatherState(weeklyChangePercent), [weeklyChangePercent]);

  // References for lights and particles
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // State for tracking lightning flashes
  const flashTimer = useRef<number>(0);
  const flashIntensity = useRef<number>(0);

  // Target fog values derived from weather state
  const targetFogColor = useMemo(() => {
    if (weather === 'sunny') return new THREE.Color('#a8d8f0');
    if (weather === 'cloudy') return new THREE.Color('#8fa0b5'); // light blue-grey
    if (weather === 'rainy') return new THREE.Color('#5c708a');  // slate blue-grey
    return new THREE.Color('#1a263d'); // deep indigo stormy blue-grey
  }, [weather]);

  const targetFogDensity = useMemo(() => {
    if (weather === 'sunny') return 0.07; // Light balanced atmospheric fog
    if (weather === 'cloudy') return 0.085;
    if (weather === 'rainy') return 0.105;
    return 0.13; // Stormy fog
  }, [weather]);

  // Initialize fog on mount and match background color to the target weather fog color
  React.useEffect(() => {
    if (!scene.fog) {
      scene.fog = new THREE.FogExp2(targetFogColor.getHex(), 0.07);
    }
    scene.background = targetFogColor.clone();
  }, [scene, targetFogColor]);

  const moteTexture = useMemo(() => createParticleTexture('mote'), []);
  const rainTexture = useMemo(() => createParticleTexture('rain'), []);

  const activeTexture = useMemo(() => {
    if (weather === 'rainy' || weather === 'storm') return rainTexture;
    return moteTexture;
  }, [weather, rainTexture, moteTexture]);

  // Generate initial particle positions
  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Scatter in a box around the tree: X (-3 to 3), Y (-2 to 4), Z (-3 to 3)
      pos[i * 3] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = Math.random() * 6 - 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return pos;
  }, []);

  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  // Frame loop for particles, lightning and light updates
  useFrame((state, delta) => {
    // 1. Particle Simulation
    if (particlesRef.current) {
      const geo = particlesRef.current.geometry;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        let z = posAttr.getZ(i);

        if (weather === 'sunny') {
          // Soft floating pollen motes (slow drift upwards & sway)
          const time = state.clock.getElapsedTime();
          y += delta * 0.18; // Float up
          x += Math.sin(time + i) * 0.004; // Sway
          z += Math.cos(time - i) * 0.004;

          // Reset if it goes too high
          if (y > 3.5) {
            y = -1.8;
            x = (Math.random() - 0.5) * 4;
            z = (Math.random() - 0.5) * 4;
          }
        } else if (weather === 'rainy' || weather === 'storm') {
          // Hard falling rain (fast down, wind push in storm)
          const fallSpeed = weather === 'storm' ? 7.0 : 4.0;
          const windPush = weather === 'storm' ? -0.8 : -0.15; // Windy angle

          y -= fallSpeed * delta;
          x += windPush * delta;

          // Reset if it hits ground or bounds
          if (y < -1.8 || x < -3.5) {
            y = 3.5 + Math.random() * 0.5;
            x = (Math.random() - 0.5) * 6 + 1.0; // Offset right so it falls in
            z = (Math.random() - 0.5) * 6;
          }
        } else {
          // Cloudy: near still, particles hide or float extremely slow
          y -= delta * 0.03;
          if (y < -1.8) y = 3.5;
        }

        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    // 2. Lightning Engine (Storm Mode only)
    if (weather === 'storm') {
      flashTimer.current -= delta;

      // Trigger new lightning flash randomly (approx every 4-7 seconds)
      if (flashTimer.current <= 0) {
        flashTimer.current = 3.0 + Math.random() * 5.0;
        flashIntensity.current = 1.0; // Flash full bright
      }

      // Decay flash intensity
      if (flashIntensity.current > 0) {
        flashIntensity.current -= delta * 4.5; // Rapid decay
        if (flashIntensity.current < 0) flashIntensity.current = 0;
      }

      // Flash the fog color to create a dramatic lightning flash throughout the scene
      const stormColor = new THREE.Color('#090d16');
      const flashColor = new THREE.Color('#ffffff');
      const currentColor = stormColor.clone().lerp(flashColor, flashIntensity.current * 0.95);
      if (scene.fog) {
        scene.fog.color.copy(currentColor);
      }
      if (scene.background) {
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(currentColor);
        } else {
          scene.background = currentColor.clone();
        }
      }
    } else {
      flashIntensity.current = 0;
    }

    // Update light intensities smoothly
    if (ambientLightRef.current && dirLightRef.current) {
      let targetEnv = 0.5; // Default environment map intensity

      if (weather === 'sunny') {
        // Bright golden hour warm sun
        ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, 0.35, 0.05);
        dirLightRef.current.intensity = THREE.MathUtils.lerp(dirLightRef.current.intensity, 1.3, 0.05);
        dirLightRef.current.color.set('#ffd066');
        targetEnv = 0.65;
      } else if (weather === 'cloudy') {
        // Diffused overcast lighting
        ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, 0.25, 0.05);
        dirLightRef.current.intensity = THREE.MathUtils.lerp(dirLightRef.current.intensity, 0.25, 0.05);
        dirLightRef.current.color.set('#d8dee9');
        targetEnv = 0.35;
      } else if (weather === 'rainy') {
        // Soft misty bluish rain light
        ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, 0.18, 0.05);
        dirLightRef.current.intensity = THREE.MathUtils.lerp(dirLightRef.current.intensity, 0.15, 0.05);
        dirLightRef.current.color.set('#95a8be');
        targetEnv = 0.2;
      } else if (weather === 'storm') {
        // Dark midnight base but with cool silver moonlight shadows when not flashing
        const baseAmbient = 0.09;
        const baseDir = 0.22;

        // Add lightning flash contribution
        const lightningFlash = flashIntensity.current; // 0 to 1

        ambientLightRef.current.intensity = THREE.MathUtils.lerp(
          ambientLightRef.current.intensity,
          baseAmbient + lightningFlash * 0.85,
          0.15
        );
        dirLightRef.current.intensity = THREE.MathUtils.lerp(
          dirLightRef.current.intensity,
          baseDir + lightningFlash * 2.0,
          0.15
        );

        // If lightning is flashing, use bright white/blue light, otherwise silver-blue moonlight
        if (lightningFlash > 0.05) {
          dirLightRef.current.color.set('#eef5ff');
        } else {
          dirLightRef.current.color.set('#68809e');
        }

        // Environment map dims down, flashing up during lightning strike
        targetEnv = 0.08 + lightningFlash * 0.75;
      }

      // Smoothly update environment map intensity if supported
      const currentEnv = (scene as any).environmentIntensity ?? 1.0;
      (scene as any).environmentIntensity = THREE.MathUtils.lerp(currentEnv, targetEnv, 0.05);
    }

    // Smoothly interpolate fog color and density in real-time
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      if (weather !== 'storm' || flashIntensity.current === 0) {
        scene.fog.color.lerp(targetFogColor, 0.04);
      }
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, targetFogDensity, 0.04);

      // Keep background color perfectly synchronized with fog color
      if (scene.background) {
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(scene.fog.color);
        } else {
          scene.background = scene.fog.color.clone();
        }
      }
    }
  });

  // Render weather particles
  const particleColor = useMemo(() => {
    if (weather === 'sunny') return '#e2c56a'; // Golden glow
    if (weather === 'cloudy') return '#ffffff'; // White mist
    return '#8cb8ff'; // Bluish rain droplets
  }, [weather]);

  const particleSize = useMemo(() => {
    if (weather === 'sunny') return 0.08; // slightly larger for soft glow texture
    if (weather === 'cloudy') return 0.01;
    return 0.18; // rain streaks
  }, [weather]);

  return (
    <>
      {/* Sky-Ground Hemisphere ambient bounce light */}
      <hemisphereLight
        color="#ffffff"
        groundColor="#ccd4e0"
        intensity={0.3}
      />

      {/* Lights matching current weather */}
      <ambientLight ref={ambientLightRef} intensity={0.3} />
      <directionalLight
        ref={dirLightRef}
        position={[4.6, 6, 3]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.1}
        shadow-camera-far={25}
      />

      {/* Fill Light to soften shadows */}
      <directionalLight position={[-4, 2, -2]} intensity={0.2} color="#a5c4f7" />

      {/* Sun Mesh (Sunny Weather Only) */}
      {weather === 'sunny' && (
        <mesh position={[12, 10, 5]}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial color="#ffe48f" toneMapped={false} />
        </mesh>
      )}

      {/* Moon Mesh (Stormy Weather Only) */}
      {weather === 'storm' && (
        <mesh position={[-10, 9, -8]}>
          <sphereGeometry args={[0.9, 32, 32]} />
          <meshBasicMaterial color="#cde0ff" toneMapped={false} />
        </mesh>
      )}

      {/* Particle System for Rain/Pollen */}
      {weather !== 'cloudy' && (
        <points ref={particlesRef} geometry={particleGeometry}>
          <pointsMaterial
            color={particleColor}
            size={particleSize}
            transparent
            opacity={weather === 'sunny' ? 0.65 : 0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            map={activeTexture}
          />
        </points>
      )}
    </>
  );
};
export default WeatherSystem;
