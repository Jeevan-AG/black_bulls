import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export const CyberCubeScene = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene setup
    const scene = new THREE.Scene();
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    currentMount.appendChild(renderer.domElement);

    // Root Group
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Cube Cluster Group
    const clusterGroup = new THREE.Group();
    mainGroup.add(clusterGroup);

    // Helper: Rounded Box Geometry function
    function createRoundedBox(width, height, depth, radius, smoothness) {
      const shape = new THREE.Shape();
      const eps = 0.00001;
      const radius0 = radius - eps;
      shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
      shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true);
      shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true);
      shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: depth - radius * 2,
        bevelEnabled: true,
        bevelSegments: smoothness * 2,
        steps: 1,
        bevelSize: radius0,
        bevelThickness: radius0,
        curveSegments: smoothness,
      });
      geometry.center();
      return geometry;
    }

    const boxGeo = createRoundedBox(0.74, 0.74, 0.74, 0.045, 4);

    // Exact Materials from Reference Image:
    // 1. Dark Obsidian Graphite with studio environment reflection
    const darkObsidianMat = new THREE.MeshStandardMaterial({
      color: 0x181c22,
      metalness: 0.75,
      roughness: 0.22,
      envMapIntensity: 1.8,
    });

    // 2. Light Platinum Silver Accent Cubes
    const silverChromeMat = new THREE.MeshStandardMaterial({
      color: 0x8fa2b8,
      metalness: 0.9,
      roughness: 0.2,
      envMapIntensity: 2.5,
    });

    // Cube positions configuration
    const spacing = 0.78;
    const silverCubes = [
      { x: -1, y: 0, z: 1, pushX: -0.32, pushY: 0.12, pushZ: 0.32 },
      { x: 1, y: -1, z: 0, pushX: 0.32, pushY: -0.22, pushZ: 0.2 },
      { x: 1, y: 1, z: 1, pushX: 0.3, pushY: 0.28, pushZ: 0.3 },
      { x: -1, y: -1, z: -1, pushX: -0.24, pushY: -0.24, pushZ: -0.24 },
    ];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // Hollow core

          const silverMatch = silverCubes.find(
            (c) => c.x === x && c.y === y && c.z === z
          );

          const mat = silverMatch ? silverChromeMat : darkObsidianMat;
          const cube = new THREE.Mesh(boxGeo, mat);

          let px = x * spacing;
          let py = y * spacing;
          let pz = z * spacing;

          if (silverMatch) {
            px += silverMatch.pushX;
            py += silverMatch.pushY;
            pz += silverMatch.pushZ;
          }

          cube.position.set(px, py, pz);
          cube.castShadow = true;
          cube.receiveShadow = true;
          clusterGroup.add(cube);
        }
      }
    }

    // Set cluster orientation exactly matching reference image
    clusterGroup.rotation.x = 0.32;
    clusterGroup.rotation.y = -0.62;
    clusterGroup.rotation.z = 0.14;

    // Floating Geometric Elements
    // 1. Torus Ring above cluster
    const torusGeo = new THREE.TorusGeometry(0.34, 0.055, 24, 64);
    const torus = new THREE.Mesh(torusGeo, darkObsidianMat);
    torus.position.set(0.6, 2.05, 0.4);
    torus.rotation.set(Math.PI / 2.6, Math.PI / 6, 0.2);
    mainGroup.add(torus);

    // 2. Cone pointing downwards on left
    const cone1Geo = new THREE.ConeGeometry(0.24, 0.55, 32);
    const cone1 = new THREE.Mesh(cone1Geo, darkObsidianMat);
    cone1.position.set(-1.05, -1.35, 0.7);
    cone1.rotation.set(2.4, -0.3, 0.7);
    mainGroup.add(cone1);

    // 3. Cone on the right
    const cone2Geo = new THREE.ConeGeometry(0.19, 0.48, 32);
    const cone2 = new THREE.Mesh(cone2Geo, darkObsidianMat);
    cone2.position.set(2.5, 0.3, -0.4);
    cone2.rotation.set(-1.2, 0.9, -0.5);
    mainGroup.add(cone2);

    // 4. Faceted Octahedrons
    const octaGeo = new THREE.OctahedronGeometry(0.16, 0);
    const octa1 = new THREE.Mesh(octaGeo, darkObsidianMat);
    octa1.position.set(2.0, 1.8, 0.3);
    mainGroup.add(octa1);

    const octa2 = new THREE.Mesh(octaGeo, darkObsidianMat);
    octa2.position.set(0.7, -2.05, 0.5);
    mainGroup.add(octa2);

    // 5. Connecting Curved Cables/Wires to code panels
    const curve1 = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.7, 0.45, 0.3),
      new THREE.Vector3(-1.1, 0.75, 0.25),
      new THREE.Vector3(-1.5, 0.95, 0.15),
      new THREE.Vector3(-1.9, 1.05, 0.05)
    );
    const wireGeo1 = new THREE.TubeGeometry(curve1, 32, 0.012, 8, false);
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x3d4756, roughness: 0.4, metalness: 0.5 });
    const wire1 = new THREE.Mesh(wireGeo1, wireMat);
    mainGroup.add(wire1);

    const curve2 = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.8, -0.55, 0.25),
      new THREE.Vector3(1.2, -0.85, 0.18),
      new THREE.Vector3(1.6, -1.05, 0.1),
      new THREE.Vector3(1.95, -1.15, 0.02)
    );
    const wireGeo2 = new THREE.TubeGeometry(curve2, 32, 0.012, 8, false);
    const wire2 = new THREE.Mesh(wireGeo2, wireMat);
    mainGroup.add(wire2);

    // Lighting (Calibrated to match the soft studio gradient lighting of reference)
    const ambientLight = new THREE.AmbientLight(0x738299, 2.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xe8f0fc, 4.5);
    keyLight.position.set(-5, 7, 9);
    scene.add(keyLight);

    const rimLight1 = new THREE.DirectionalLight(0xb8cce8, 4.8);
    rimLight1.position.set(7, 4, 3);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xa5b8d0, 3.2);
    rimLight2.position.set(-6, -4, 4);
    scene.add(rimLight2);

    const softFill = new THREE.PointLight(0xdde7f5, 2.0, 30);
    softFill.position.set(0, 4, 6);
    scene.add(softFill);

    // Mouse Interaction
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

      // Subtle floating
      clusterGroup.rotation.y = -0.62 + Math.sin(t * 0.4) * 0.03 + mouseX * 0.35;
      clusterGroup.rotation.x = 0.32 + Math.cos(t * 0.35) * 0.02 - mouseY * 0.35;

      torus.rotation.x += 0.005;
      torus.position.y = 2.05 + Math.sin(t * 1.0) * 0.04;

      cone1.rotation.y += 0.007;
      cone1.position.y = -1.35 + Math.cos(t * 0.9) * 0.04;

      cone2.rotation.y -= 0.006;
      cone2.position.y = 0.3 + Math.sin(t * 0.95) * 0.03;

      octa1.rotation.y += 0.01;
      octa1.position.y = 1.8 + Math.sin(t * 0.8) * 0.03;

      octa2.rotation.x += 0.008;
      octa2.position.y = -2.05 + Math.cos(t * 0.9) * 0.04;

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
      boxGeo.dispose();
      torusGeo.dispose();
      cone1Geo.dispose();
      cone2Geo.dispose();
      octaGeo.dispose();
      wireGeo1.dispose();
      wireGeo2.dispose();
    };
  }, []);

  return <div ref={mountRef} className="cyber-3d-canvas-container" />;
};

export default CyberCubeScene;
