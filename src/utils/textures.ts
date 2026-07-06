import * as THREE from 'three';

/**
 * Generates a dynamic, tileable grass/soil hybrid texture using HTML Canvas.
 */
export function createGroundTexture(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  // 1. Color Map
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Fill with rich dark soil base color
  ctx.fillStyle = '#201813';
  ctx.fillRect(0, 0, 512, 512);

  // Add soil speckle noise for depth
  for (let i = 0; i < 30000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 1 + Math.random() * 1.5;
    const rand = Math.random();
    
    if (rand > 0.85) {
      ctx.fillStyle = '#3a2d24'; // lighter sand/pebbles
    } else if (rand > 0.5) {
      ctx.fillStyle = '#140f0c'; // darker shadows
    } else if (rand > 0.35) {
      ctx.fillStyle = '#2b3618'; // mossy patches
    } else {
      continue;
    }
    ctx.fillRect(x, y, size, size);
  }

  // Draw tileable grass clusters
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 3 + Math.random() * 7;
    const angle = (Math.random() - 0.5) * 0.5;

    ctx.beginPath();
    ctx.moveTo(x, y);
    // Draw blade with slight curve
    ctx.quadraticCurveTo(
      x + Math.sin(angle) * (len * 0.5),
      y - (len * 0.5),
      x + Math.sin(angle) * len,
      y - len
    );
    
    // Vary grass green hues
    const greenHues = ['#284218', '#345222', '#213314', '#3d5e29'];
    ctx.strokeStyle = greenHues[Math.floor(Math.random() * greenHues.length)];
    ctx.lineWidth = 1.0 + Math.random() * 1.0;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);

  // 2. Normal Map (for organic lighting bumpiness)
  const nCanvas = document.createElement('canvas');
  nCanvas.width = 512;
  nCanvas.height = 512;
  const nCtx = nCanvas.getContext('2d')!;

  // Neutral tangent-space normal map color: rgb(128, 128, 255)
  nCtx.fillStyle = '#8080ff';
  nCtx.fillRect(0, 0, 512, 512);

  // Add random organic normals for dirt roughness
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 2 + Math.random() * 2;
    
    const nx = Math.floor(128 + (Math.random() - 0.5) * 35);
    const ny = Math.floor(128 + (Math.random() - 0.5) * 35);
    nCtx.fillStyle = `rgb(${nx}, ${ny}, 255)`;
    nCtx.fillRect(x, y, size, size);
  }

  const normalMap = new THREE.CanvasTexture(nCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(16, 16);

  // 3. Roughness Map (mostly rough dirt with less-rough moss/grass)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 512;
  rCanvas.height = 512;
  const rCtx = rCanvas.getContext('2d')!;

  // Default rough soil
  rCtx.fillStyle = '#b0b0b0';
  rCtx.fillRect(0, 0, 512, 512);

  // Less rough patches (moss, grass)
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 1 + Math.random() * 3;
    const val = Math.floor(75 + Math.random() * 60); // lower value = smoother/shinier
    rCtx.fillStyle = `rgb(${val}, ${val}, ${val})`;
    rCtx.fillRect(x, y, size, size);
  }

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(16, 16);

  return { map, normalMap, roughnessMap };
}
