import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export const CyberShieldScene = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // ── Scene, Camera & Renderer ─────────────────────────────────────────────
    const scene = new THREE.Scene();
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    currentMount.appendChild(renderer.domElement);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // ── Materials ────────────────────────────────────────────────────────────
    const neonCrimson = new THREE.MeshBasicMaterial({
      color: 0xff1e38,
      transparent: true,
      opacity: 0.98,
    });

    const stealthArmor = new THREE.MeshStandardMaterial({
      color: 0x07090d,
      metalness: 0.95,
      roughness: 0.2,
      envMapIntensity: 2.0,
    });

    const hexInnerWireMat = new THREE.MeshBasicMaterial({
      color: 0xff1e38,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    // ── 1. Cyber Shield Geometry ─────────────────────────────────────────────
    const shieldGroup = new THREE.Group();
    rootGroup.add(shieldGroup);

    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 1.42); // Top center peak
    shieldShape.quadraticCurveTo(0.65, 1.25, 1.18, 1.15); // Top right shoulder
    shieldShape.quadraticCurveTo(1.22, 0.40, 1.05, -0.15); // Upper waist
    shieldShape.quadraticCurveTo(0.85, -0.75, 0, -1.55); // Bottom sharp point
    shieldShape.quadraticCurveTo(-0.85, -0.75, -1.05, -0.15); // Left waist
    shieldShape.quadraticCurveTo(-1.22, 0.40, -1.18, 1.15); // Left shoulder
    shieldShape.quadraticCurveTo(-0.65, 1.25, 0, 1.42); // Back to top peak

    // Extruded Stealth Obsidian Shield Body
    const extrudeSettings = {
      steps: 1,
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 5,
    };
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
    shieldGeo.center();
    const shieldMesh = new THREE.Mesh(shieldGeo, stealthArmor);
    shieldGroup.add(shieldMesh);

    // Glowing Neon Crimson Outer Shield Rim
    const shieldPoints = shieldShape.getPoints(100);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(shieldPoints);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff1e38, linewidth: 3 });
    const shieldOutline = new THREE.LineLoop(lineGeo, lineMat);
    shieldOutline.position.z = 0.11;
    shieldGroup.add(shieldOutline);

    // Inner Secondary Glowing Contour
    const innerPoints = shieldShape.getPoints(100).map((p) => new THREE.Vector2(p.x * 0.85, p.y * 0.85));
    const innerLineGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);
    const innerLineMat = new THREE.LineBasicMaterial({ color: 0xff3b56, transparent: true, opacity: 0.4 });
    const innerShieldOutline = new THREE.LineLoop(innerLineGeo, innerLineMat);
    innerShieldOutline.position.z = 0.115;
    shieldGroup.add(innerShieldOutline);

    // ── 2. Solid Glowing Red Padlock in Center ──────────────────────────────
    const padlockGroup = new THREE.Group();
    padlockGroup.position.set(0, -0.06, 0.14);
    shieldGroup.add(padlockGroup);

    // Padlock Base (Rounded Rectangle)
    const lockBodyGeo = new THREE.BoxGeometry(0.58, 0.46, 0.08);
    const lockBody = new THREE.Mesh(lockBodyGeo, neonCrimson);
    lockBody.position.y = -0.16;
    padlockGroup.add(lockBody);

    // Padlock Upper Arch Shackle
    const shackleGeo = new THREE.TorusGeometry(0.21, 0.046, 16, 36, Math.PI);
    const shackle = new THREE.Mesh(shackleGeo, neonCrimson);
    shackle.position.set(0, 0.07, 0);
    padlockGroup.add(shackle);

    // Dark Keyhole Cutout
    const keyholeTopGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.1, 16);
    const keyholeTop = new THREE.Mesh(keyholeTopGeo, stealthArmor);
    keyholeTop.rotation.x = Math.PI / 2;
    keyholeTop.position.set(0, -0.12, 0.02);
    padlockGroup.add(keyholeTop);

    const keyholeStemGeo = new THREE.BoxGeometry(0.038, 0.12, 0.1);
    const keyholeStem = new THREE.Mesh(keyholeStemGeo, stealthArmor);
    keyholeStem.position.set(0, -0.22, 0.02);
    padlockGroup.add(keyholeStem);

    // ── 3. Revolving 3D Hexagonal Energy Shield (Inner Layer Only) ───────────
    const hexContainerGroup = new THREE.Group();
    rootGroup.add(hexContainerGroup);

    // Inner Hexagonal Wireframe Matrix
    const hexInnerGeo = new THREE.IcosahedronGeometry(2.2, 2);
    const hexInner = new THREE.Mesh(hexInnerGeo, hexInnerWireMat);
    hexContainerGroup.add(hexInner);

    // Glowing Node Vertices on Hexagonal Junctions
    const nodeGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const hexVertices = hexInnerGeo.attributes.position;
    for (let i = 0; i < hexVertices.count; i += 3) {
      const vx = hexVertices.getX(i);
      const vy = hexVertices.getY(i);
      const vz = hexVertices.getZ(i);
      const nodeMesh = new THREE.Mesh(nodeGeo, neonCrimson);
      nodeMesh.position.set(vx, vy, vz);
      hexInner.add(nodeMesh);
    }

    // ── 4. Ambient Data Defense Particles ────────────────────────────────────
    const particleCount = 45;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleMeta = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 1.6 + Math.random() * 1.2;
      particlePositions[i * 3] = Math.cos(angle) * rad;
      particlePositions[i * 3 + 1] = Math.sin(angle) * rad;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      particleMeta.push({
        angle,
        rad,
        speed: 0.15 + Math.random() * 0.3,
        z: particlePositions[i * 3 + 2],
      });
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xff3b56,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);

    // ── 5. Lighting Setup ────────────────────────────────────────────────────
    const keyPointLight = new THREE.PointLight(0xff1e38, 5.5, 30);
    keyPointLight.position.set(0, 0, 4.0);
    scene.add(keyPointLight);

    const rimLight = new THREE.DirectionalLight(0xff3352, 2.0);
    rimLight.position.set(4, 5, 3);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x101216, 1.2);
    scene.add(ambientLight);

    // ── 6. Mouse Interaction & Animation Loop ────────────────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e) => {
      const rect = currentMount.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 0.45;
      targetY = y * 0.45;
    };

    window.addEventListener("mousemove", handleMouseMove);

    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      rootGroup.rotation.y = mouseX * 0.5;
      rootGroup.rotation.x = -mouseY * 0.5;

      // Revolving Inner Hexagonal Energy Shield
      hexInner.rotation.y = -t * 0.25;
      hexInner.rotation.x = Math.sin(t * 0.2) * 0.15;
      hexInner.rotation.z = t * 0.12;

      // Particle orbit animation
      const posAttr = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const p = particleMeta[i];
        p.angle += p.speed * 0.01;
        posAttr.setXYZ(i, Math.cos(p.angle) * p.rad, Math.sin(p.angle) * p.rad, p.z + Math.sin(t + i) * 0.08);
      }
      posAttr.needsUpdate = true;

      // Breathing pulse on padlock core & glow
      const pulse = 1.0 + Math.sin(t * 2.4) * 0.02;
      padlockGroup.scale.set(pulse, pulse, 1);
      keyPointLight.intensity = 5.0 + Math.sin(t * 3.0) * 1.2;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!currentMount) return;
      const w = currentMount.clientWidth;
      const h = currentMount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      shieldGeo.dispose();
      lineGeo.dispose();
      innerLineGeo.dispose();
      lockBodyGeo.dispose();
      shackleGeo.dispose();
      keyholeTopGeo.dispose();
      keyholeStemGeo.dispose();
      hexInnerGeo.dispose();
      nodeGeo.dispose();
      particleGeo.dispose();
    };
  }, []);

  return <div ref={mountRef} className="cyber-3d-canvas-container" />;
};

export default CyberShieldScene;
