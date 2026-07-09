import React, { Suspense, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Sky, Cloud, useTexture, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import BonsaiTree from './BonsaiTree';
import WeatherSystem from './WeatherSystem';
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

useGLTF.preload('/grass_medium_01_1k.gltf');


interface BonsaiCanvasProps {
  dailyChangePercent: number;
  weeklyChangePercent: number;
  leafDensity: number;
}

type WeatherState = 'sunny' | 'cloudy' | 'rainy' | 'storm';

function getWeatherState(weeklyChange: number): WeatherState {
  if (weeklyChange > 1.0) return 'sunny';
  if (weeklyChange >= -0.5) return 'cloudy';
  if (weeklyChange >= -2.0) return 'rainy';
  return 'storm';
}

function getWindForce(weeklyChange: number): number {
  if (weeklyChange > 1.0) return 0.4;
  if (weeklyChange >= -0.5) return 0.08;
  if (weeklyChange >= -2.0) return 0.8;
  return 1.8;
}

const getSkyParams = (weather: WeatherState) => {
  if (weather === 'sunny') {
    return {
      turbidity: 0.5,
      rayleigh: 4.0,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      sunPosition: [15, 12, 10] as [number, number, number],
    };
  } else if (weather === 'cloudy') {
    return {
      turbidity: 2.0,
      rayleigh: 3.2,
      mieCoefficient: 0.01,
      mieDirectionalG: 0.75,
      sunPosition: [5, 15, -5] as [number, number, number],
    };
  } else if (weather === 'rainy') {
    return {
      turbidity: 3.5,
      rayleigh: 2.4,
      mieCoefficient: 0.025,
      mieDirectionalG: 0.6,
      sunPosition: [0, 8, -10] as [number, number, number],
    };
  } else {
    // storm
    return {
      turbidity: 5.0,
      rayleigh: 1.8,
      mieCoefficient: 0.05,
      mieDirectionalG: 0.4,
      sunPosition: [0, 5, -15] as [number, number, number],
    };
  }
};

const CloudsSystem: React.FC<{ weather: WeatherState }> = ({ weather }) => {
  const params = useMemo(() => {
    // Keep clouds white (#ffffff) across all weather states so they remain visible against the sky
    if (weather === 'sunny') {
      return { opacity: 0.3, color: '#ffffff', speed: 0.15 };
    } else if (weather === 'cloudy') {
      return { opacity: 0.8, color: '#ffffff', speed: 0.35 };
    } else if (weather === 'rainy') {
      return { opacity: 0.88, color: '#ffffff', speed: 0.6 };
    } else {
      // storm
      return { opacity: 0.95, color: '#ffffff', speed: 1.1 };
    }
  }, [weather]);

  return (
    <group>
      {/* Cloud 1 - Far Left Background */}
      <Cloud
        position={[-8, 6, -15]}
        opacity={params.opacity}
        color={params.color}
        speed={params.speed}
        bounds={[4, 1.5, 4]}
        segments={15}
      />
      {/* Cloud 2 - Center High Background */}
      <Cloud
        position={[2, 9, -20]}
        opacity={params.opacity * 0.9}
        color={params.color}
        speed={params.speed * 1.1}
        bounds={[6, 2, 6]}
        segments={20}
      />
      {/* Cloud 3 - Far Right Background */}
      <Cloud
        position={[9, 7, -18]}
        opacity={params.opacity}
        color={params.color}
        speed={params.speed * 0.9}
        bounds={[5, 1.5, 5]}
        segments={15}
      />
      {/* Foreground clouds for thick overcast */}
      {(weather === 'rainy' || weather === 'storm' || weather === 'cloudy') && (
        <>
          <Cloud
            position={[-3, 8, -12]}
            opacity={params.opacity * 0.6}
            color={params.color}
            speed={params.speed}
            bounds={[5, 2, 5]}
            segments={10}
          />
          <Cloud
            position={[5, 7, -10]}
            opacity={params.opacity * 0.6}
            color={params.color}
            speed={params.speed * 1.2}
            bounds={[4, 1.5, 4]}
            segments={10}
          />
        </>
      )}
    </group>
  );
};

const Grass: React.FC<{ weeklyChangePercent: number }> = ({ weeklyChangePercent }) => {
  const { nodes } = useGLTF('/grass_medium_01_1k.gltf') as any;
  const diffMap = useTexture('/grass_medium_01_diff_1k.jpg');
  const normalMap = useTexture('/grass_medium_01_nor_gl_1k.jpg');
  const armMap = useTexture('/grass_medium_01_arm_1k.jpg');

  const meshRefSmall = useRef<THREE.InstancedMesh>(null);
  const meshRefMid = useRef<THREE.InstancedMesh>(null);
  const meshRefLarge = useRef<THREE.InstancedMesh>(null);

  const windForce = useMemo(() => getWindForce(weeklyChangePercent), [weeklyChangePercent]);

  // Extract geometries from the loaded GLTF model
  const geomSmall = useMemo(() => nodes.grass_medium_01_small_a_LOD0.geometry, [nodes]);
  const geomMid = useMemo(() => nodes.grass_medium_01_mid_a_LOD0.geometry, [nodes]);
  const geomLarge = useMemo(() => nodes.grass_medium_01_large_a_LOD0.geometry, [nodes]);

  // Pre-generate instance matrices distributed to Small, Medium, and Large
  const [grassInstancesSmall, grassInstancesMid, grassInstancesLarge] = useMemo(() => {
    const smallArr: number[] = [];
    const midArr: number[] = [];
    const largeArr: number[] = [];

    const dummy = new THREE.Object3D();

    for (let i = 0; i < 1400; i++) {
      let radius = 0.0;
      if (i < 1000) {
        // Dense inner grass lawn surrounding the pot
        radius = 0.85 + Math.random() * 4.15;
      } else {
        // Sparser outer grass stretching to the horizon
        radius = 5.0 + Math.random() * 10.0;
      }
      const angle = Math.random() * Math.PI * 2;

      const x = 0.6 + Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -1.65; // Ground height

      dummy.position.set(x, y, z);

      // Random rotation and tilt for organic clusters
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.15,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.15
      );

      // Scale smaller in the distance
      const distFactor = Math.max(0.2, 1.0 - (radius / 15.0));
      const scale = (0.35 + Math.random() * 0.3) * 2.5 * distFactor; // scaled up to 2.5x
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      const matElements = dummy.matrix.toArray();
      const rand = Math.random();
      if (rand < 0.3) {
        smallArr.push(...matElements);
      } else if (rand < 0.7) {
        midArr.push(...matElements);
      } else {
        largeArr.push(...matElements);
      }
    }

    return [
      new Float32Array(smallArr),
      new Float32Array(midArr),
      new Float32Array(largeArr),
    ];
  }, []);

  // Update instance matrices and colors
  useEffect(() => {
    const color = new THREE.Color();
    const greenTones = [
      '#445138', // Muted olive-moss
      '#546347', // Sage green
      '#343f29', // Deep forest-shadow green
      '#617252', // Pistachio-sage
      '#3b4731', // Dull pine green
      '#738363', // Pale lichen/straw green
      '#4c5b3f', // Earthy green
      '#2c3523', // Very dark forest soil green
      '#829172', // Dusty light green
    ];

    const applyInstances = (meshRef: React.RefObject<THREE.InstancedMesh | null>, instancesArray: Float32Array) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const count = instancesArray.length / 16;
      for (let i = 0; i < count; i++) {
        const mat = new THREE.Matrix4().fromArray(instancesArray, i * 16);
        mesh.setMatrixAt(i, mat);

        const hex = greenTones[Math.floor(Math.random() * greenTones.length)];
        color.set(hex);

        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        hsl.l += (Math.random() - 0.5) * 0.08;
        hsl.s += (Math.random() - 0.5) * 0.08;
        color.setHSL(hsl.h, hsl.s, hsl.l);

        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    };

    applyInstances(meshRefSmall, grassInstancesSmall);
    applyInstances(meshRefMid, grassInstancesMid);
    applyInstances(meshRefLarge, grassInstancesLarge);

    customMaterial.needsUpdate = true;
  }, [grassInstancesSmall, grassInstancesMid, grassInstancesLarge]);

  const customMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: diffMap,
      normalMap: normalMap,
      aoMap: armMap,
      roughnessMap: armMap,
      metalnessMap: armMap,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });

    mat.onBeforeCompile = (shader: any) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uSwayFreq = { value: 1.0 };
      shader.uniforms.uSwayAmp = { value: 0.0 };
      mat.userData.shader = shader;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uSwayFreq;
        uniform float uSwayAmp;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        #ifdef USE_INSTANCING
          float instX = instanceMatrix[3].x;
          float instZ = instanceMatrix[3].z;
        #else
          float instX = 0.0;
          float instZ = 0.0;
        #endif

        float swayFactor = max(0.0, position.y);
        float swayX = sin(uTime * uSwayFreq + instX * 4.0 + instZ * 3.0) * uSwayAmp * swayFactor;
        float swayZ = cos(uTime * uSwayFreq * 0.9 + instX * 3.0 + instZ * 4.0) * uSwayAmp * 0.7 * swayFactor;

        transformed.x += swayX;
        transformed.z += swayZ;
        `
      );
    };

    return mat;
  }, [diffMap, normalMap, armMap]);

  useFrame((state) => {
    if (customMaterial.userData.shader) {
      const shader = customMaterial.userData.shader;
      shader.uniforms.uTime.value = state.clock.getElapsedTime();
      shader.uniforms.uSwayFreq.value = 1.2 + windForce * 0.5;
      shader.uniforms.uSwayAmp.value = windForce * 0.12;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={meshRefSmall}
        args={[geomSmall, customMaterial, grassInstancesSmall.length / 16]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={meshRefMid}
        args={[geomMid, customMaterial, grassInstancesMid.length / 16]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={meshRefLarge}
        args={[geomLarge, customMaterial, grassInstancesLarge.length / 16]}
        castShadow
        receiveShadow
      />
    </group>
  );
};


/*
const BonsaiLensFlare: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { camera, scene, raycaster } = useThree();
  const sunPosition = useMemo(() => new THREE.Vector3(15, 12, 10), []);

  const effect = useMemo(() => {
    return new LensFlareEffect({
      blendFunction: 23, // Normal blend function
      enabled: enabled,
      glareSize: 0.35,
      lensPosition: sunPosition,
      screenRes: new THREE.Vector2(0, 0),
      starPoints: 6,
      flareSize: 0.015,
      flareSpeed: 0.01,
      flareShape: 0.01,
      animated: true,
      anamorphic: false,
      colorGain: new THREE.Color(20, 20, 20),
      lensDirtTexture: null,
      haloScale: 0.5,
      secondaryGhosts: true,
      aditionalStreaks: true,
      ghostScale: 0.0,
      opacity: 0.8,
      starBurst: false,
    });
  }, [enabled, sunPosition]);

  const raycasterPos = useMemo(() => new THREE.Vector2(), []);
  const projectedPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!effect) return;
    const uLensPosition = effect.uniforms.get('lensPosition');
    const uOpacity = effect.uniforms.get('opacity');
    if (!uLensPosition || !uOpacity) return;

    if (!enabled) {
      uOpacity.value = 0;
      return;
    }

    let target = 0.8; // default maximum opacity of lens flare

    // Project sun position to 2D screen space
    projectedPosition.copy(sunPosition).project(camera);
    
    // If the sun is behind the camera plane, hide the flare
    if (projectedPosition.z > 1.0) {
      uOpacity.value = 0;
      return;
    }

    uLensPosition.value.x = projectedPosition.x;
    uLensPosition.value.y = projectedPosition.y;

    raycasterPos.x = projectedPosition.x;
    raycasterPos.y = projectedPosition.y;
    raycaster.setFromCamera(raycasterPos, camera);

    const intersections = raycaster.intersectObjects(scene.children, true);
    
    // Find the first intersected object that is NOT a helper, line, particles, sky, or background
    let firstBlocker = null;
    for (const hit of intersections) {
      if (
        hit.object.type === 'Points' || 
        hit.object.type === 'LineSegments' ||
        hit.object.name === 'sky' ||
        hit.distance > 80 // sky sphere is far away
      ) {
        continue;
      }
      firstBlocker = hit.object;
      break;
    }

    if (firstBlocker) {
      if (firstBlocker.userData?.lensflare === 'no-occlusion') {
        target = 0;
      } else if (firstBlocker instanceof THREE.Mesh) {
        const mat = firstBlocker.material as any;
        if (mat && (mat.transparent || mat.opacity < 0.9)) {
          target = mat.opacity * 0.2;
        } else {
          target = 0; // Solid object blocks completely
        }
      }
    }

    // Frame-rate independent damp
    uOpacity.value = THREE.MathUtils.lerp(uOpacity.value, target, 1.0 - Math.exp(-15.0 * delta));
  });

  return <primitive object={effect} />;
};
*/

const Ground: React.FC = () => {
  const soilTexture = useTexture('/soil.jpg');

  useEffect(() => {
    if (soilTexture) {
      soilTexture.wrapS = THREE.RepeatWrapping;
      soilTexture.wrapT = THREE.RepeatWrapping;
      soilTexture.repeat.set(32, 32); // Detailed fine tiling across the large plane
      soilTexture.needsUpdate = true;
    }
  }, [soilTexture]);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0.6, -1.65, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial
        map={soilTexture}
        color="#2e2520" // Dark, rich soil color multiplier to tone down the brightness
        roughness={0.95}
        metalness={0.0}
      />
    </mesh>
  );
};

const FPSCounter: React.FC = () => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const tick = () => {
      frameCount++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        if (containerRef.current) {
          containerRef.current.textContent = `${fps} FPS`;
          
          let color = '#10b981'; // green
          if (fps < 30) color = '#ef4444'; // red
          else if (fps < 50) color = '#f59e0b'; // amber
          
          containerRef.current.style.color = color;
          if (dotRef.current) {
            dotRef.current.style.backgroundColor = color;
            dotRef.current.style.boxShadow = `0 0 6px ${color}`;
          }
        }
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="fps-counter-badge">
      <span ref={dotRef} className="fps-dot" />
      <span ref={containerRef}>-- FPS</span>
    </div>
  );
};

export const BonsaiCanvas: React.FC<BonsaiCanvasProps> = ({
  dailyChangePercent,
  weeklyChangePercent,
  leafDensity,
}) => {
  const weather = useMemo(() => getWeatherState(weeklyChangePercent), [weeklyChangePercent]);
  const skyParams = useMemo(() => getSkyParams(weather), [weather]);

  return (
    <div className="canvas-container" style={{ position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [0, 0.7, 4.5], fov: 45, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000'); // Controlled fully by sky and weather fog
          gl.toneMappingExposure = 0.75;
        }}
      >
        <Suspense fallback={null}>
          {/* Dynamic Sky Component (within camera clipping plane) */}
          <Sky
            distance={1000}
            turbidity={skyParams.turbidity}
            rayleigh={skyParams.rayleigh}
            mieCoefficient={skyParams.mieCoefficient}
            mieDirectionalG={skyParams.mieDirectionalG}
            sunPosition={skyParams.sunPosition}
          />

          {/* Dynamic Clouds System */}
          <CloudsSystem weather={weather} />

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

          {/* Grass Ground Plane */}
          <Ground />

          {/* Instanced Grass Blades */}
          <Grass weeklyChangePercent={weeklyChangePercent} />

          {/* Viewport Orbiting Control Constraints */}
          <OrbitControls
            enableDamping
            dampingFactor={0.06}
            minDistance={2.5}
            maxDistance={7.5}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera going below ground
            target={[0.6, -1, 0]}
          />

          {/* Cinematic Post-Processing Stack */}
          <EffectComposer>
            <Bloom
              intensity={0.3}
              luminanceThreshold={0.45}
              luminanceSmoothing={0.75}
              mipmapBlur
            />
            <Vignette
              eskil={false}
              offset={0.18}
              darkness={0.4}
            />
            <Noise
              opacity={0.012} // extremely subtle film grain/noise
            />
            <ToneMapping
              mode={ToneMappingMode.ACES_FILMIC}
            />
            {/* <BonsaiLensFlare enabled={weather === 'sunny'} /> */}
          </EffectComposer>
        </Suspense>
      </Canvas>
      <FPSCounter />
    </div>
  );
};

export default BonsaiCanvas;
