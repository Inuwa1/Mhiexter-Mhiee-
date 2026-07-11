import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface ThreeSceneProps {
  prompt?: string;
  mode?: 'sketch' | 'real';
  onStatusUpdate?: (status: string) => void;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ 
  prompt = "Concept", 
  mode = "real", 
  onStatusUpdate 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    onStatusUpdate?.(`Mhiee is summoning the ${prompt} from the imaginary world...`);

    // SCENE SETUP (Narrative: Dark void background for both)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); 

    // ... (rest of the logic) ...

    onStatusUpdate?.(`The ${prompt} has materialized in ${mode} mode.`);
    
    // ... animation loop ...

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(3, 3, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    
    // ENGINEERING PARTS (Part-based coloring demo)
    const materialProp = mode === 'sketch' 
        ? { color: 0x000000, wireframe: true } 
        : { color: 0x555555, metalness: 0.8, roughness: 0.2 };

    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 1, 1);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial(materialProp));
    scene.add(body);

    // Part (e.g., engine block)
    const partGeo = new THREE.SphereGeometry(0.5);
    const part = new THREE.Mesh(partGeo, new THREE.MeshStandardMaterial({ ...materialProp, color: 0xff0000 }));
    part.position.set(0, 1, 0);
    scene.add(part);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      currentMount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [prompt, mode]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
