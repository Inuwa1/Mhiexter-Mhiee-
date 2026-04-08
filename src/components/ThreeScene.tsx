import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ThreeScene: React.FC<{ prompt: string }> = ({ prompt }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    console.log("Rendering 3D object based on prompt:", prompt);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Soft background color

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(3, 3, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    currentMount.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const color = prompt.toLowerCase().includes('red') ? 0xff0000 : 
                  prompt.toLowerCase().includes('blue') ? 0x0000ff : 0x0077ff;
    const material = new THREE.MeshStandardMaterial({ 
      color: color, 
      metalness: 0.7, 
      roughness: 0.2 
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.position.y = 1;
    scene.add(cube);

    // GridHelper
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      currentMount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
