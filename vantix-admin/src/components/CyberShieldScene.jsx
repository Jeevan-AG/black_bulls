import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export const CyberShieldScene = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // ── Scene & Camera ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    currentMount.appendChild(renderer.domElement);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // ── Materials ────────────────────────────────────────────────────────────
    const neonCrimsonMat = new THREE.MeshBasicMaterial({
      color: 0xff1e38,
      transparent: true,
      opacity: 0.98,
    });

    const faintCrimsonMat = new THREE.MeshBasicMaterial({
      color: 0xd9162e,
      transparent: true,
      opacity: 0.75,
    });

    const stealthArmorMat = new THREE.MeshStandardMaterial({
      color: 0x080a0e,
      metalness: 0.92,
      roughness: 0.25,
      envMapIntensity: 1.5,
    });

    // ── 1. Exact Shield Shape (Matching ID Badge Photo) ─────────────────────
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 1.38); // Top center peak
    shieldShape.quadraticCurveTo(0.65, 1.25, 1.18, 1.15); // Top right slope to shoulder
    shieldShape.quadraticCurveTo(1.22, 0.40, 1.05, -0.15); // Upper right waist
    shieldShape.quadraticCurveTo(0.85, -0.75, 0, -1.55); // Lower curve to sharp bottom point
    shieldShape.quadraticCurveTo(-0.85, -0.75, -1.05, -0.15); // Bottom point up to left waist
    shieldShape.quadraticCurveTo(-1.22, 0.40, -1.18, 1.15); // Left waist to top left shoulder
    shieldShape.quadraticCurveTo(-0.65, 1.25, 0, 1.38); // Top left slope back to center peak

    // Extruded Stealth Obsidian Shield Body
    const extrudeSettings = {
      steps: 1,
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 5,
    };
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
    shieldGeo.center();
    const shieldMesh = new THREE.Mesh(shieldGeo, stealthArmorMat);
    rootGroup.add(shieldMesh);

    // Glowing Neon Crimson Shield Border Line
    const shieldPoints = shieldShape.getPoints(90);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(shieldPoints);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff1e38, linewidth: 3 });
    const shieldOutline = new THREE.LineLoop(lineGeo, lineMat);
    shieldOutline.position.z = 0.08;
    rootGroup.add(shieldOutline);

    // ── 2. Solid Glowing Red Padlock in Center ──────────────────────────────
    const padlockGroup = new THREE.Group();
    padlockGroup.position.set(0, -0.06, 0.11);
    rootGroup.add(padlockGroup);

    // Padlock Base (Solid Red Rounded Rectangle)
    const lockBodyGeo = new THREE.BoxGeometry(0.58, 0.46, 0.08);
    const lockBody = new THREE.Mesh(lockBodyGeo, neonCrimsonMat);
    lockBody.position.y = -0.16;
    padlockGroup.add(lockBody);

    // Padlock Upper Arch Shackle (Clean Loop)
    const shackleGeo = new THREE.TorusGeometry(0.21, 0.046, 16, 36, Math.PI);
    const shackle = new THREE.Mesh(shackleGeo, neonCrimsonMat);
    shackle.position.set(0, 0.07, 0);
    padlockGroup.add(shackle);

    // Dark Keyhole Cutout (Circle + Vertical Keyway Slot)
    const keyholeTopGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.1, 16);
    const keyholeTop = new THREE.Mesh(keyholeTopGeo, stealthArmorMat);
    keyholeTop.rotation.x = Math.PI / 2;
    keyholeTop.position.set(0, -0.12, 0.02);
    padlockGroup.add(keyholeTop);

    const keyholeStemGeo = new THREE.BoxGeometry(0.038, 0.12, 0.1);
    const keyholeStem = new THREE.Mesh(keyholeStemGeo, stealthArmorMat);
    keyholeStem.position.set(0, -0.22, 0.02);
    padlockGroup.add(keyholeStem);

    // ── 3. Concentric Orbital HUD Circles ────────────────────────────────────
    const hudGroup = new THREE.Group();
    hudGroup.position.z = -0.04;
    rootGroup.add(hudGroup);

    // Outer Segmented Arc Ring (R = 2.45, Rotating)
    const segmentedRingGroup = new THREE.Group();
    const numSegments = 42;
    for (let i = 0; i < numSegments; i++) {
      if (i % 7 === 0 || i % 7 === 1) continue;
      const angle = (i / numSegments) * Math.PI * 2;
      const r = 2.45;
      const tickGeo = new THREE.PlaneGeometry(0.045, 0.18);
      const tick = new THREE.Mesh(tickGeo, neonCrimsonMat);
      tick.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      tick.rotation.z = angle + Math.PI / 2;
      segmentedRingGroup.add(tick);
    }
    hudGroup.add(segmentedRingGroup);

    // Continuous Precision Outer Ring (R = 2.70)
    const outerRingGeo = new THREE.RingGeometry(2.69, 2.71, 100);
    const outerRing = new THREE.Mesh(outerRingGeo, neonCrimsonMat);
    hudGroup.add(outerRing);

    // Inner Faint Continuous Ring (R = 2.15)
    const innerRingGeo = new THREE.RingGeometry(2.145, 2.155, 100);
    const innerRing = new THREE.Mesh(innerRingGeo, faintCrimsonMat);
    hudGroup.add(innerRing);

    // Inner Fine Tech Ticks (R = 1.95, Counter-rotating)
    const innerTickGroup = new THREE.Group();
    for (let i = 0; i < 36; i += 2) {
      const angle = (i / 36) * Math.PI * 2;
      const r = 1.95;
      const tGeo = new THREE.PlaneGeometry(0.025, 0.07);
      const tMesh = new THREE.Mesh(tGeo, faintCrimsonMat);
      tMesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      tMesh.rotation.z = angle + Math.PI / 2;
      innerTickGroup.add(tMesh);
    }
    hudGroup.add(innerTickGroup);

    // ── 4. Lighting Setup ────────────────────────────────────────────────────
    const pointLight = new THREE.PointLight(0xff1e38, 5.0, 30);
    pointLight.position.set(0, 0, 4.0);
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0x1a1a1e, 1.5);
    scene.add(ambientLight);

    // ── 5. Mouse Interaction & Animation Loop ────────────────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e) => {
      const rect = currentMount.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 0.35;
      targetY = y * 0.35;
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

      rootGroup.rotation.y = mouseX * 0.45;
      rootGroup.rotation.x = -mouseY * 0.45;

      // Revolving concentric circles
      segmentedRingGroup.rotation.z = -t * 0.22;
      innerTickGroup.rotation.z = t * 0.16;

      // Smooth breathing glow
      const pulse = 1.0 + Math.sin(t * 2.4) * 0.015;
      padlockGroup.scale.set(pulse, pulse, 1);

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
      lockBodyGeo.dispose();
      shackleGeo.dispose();
      keyholeTopGeo.dispose();
      keyholeStemGeo.dispose();
      outerRingGeo.dispose();
      innerRingGeo.dispose();
    };
  }, []);

  return <div ref={mountRef} className="cyber-3d-canvas-container" />;
};

export default CyberShieldScene;
