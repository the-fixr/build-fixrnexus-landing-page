'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import * as THREE from 'three';

type Section = 'projects' | 'activity' | 'stats' | 'about';

interface CrystalProps {
  onFacetClick: (section: Section) => void;
  onHoverChange: (section: Section | null) => void;
}

const ACCENT_RED = new THREE.Color('#FF006E');
const BASE_COLOR = new THREE.Color('#1a1a1a');
const HOVER_EMISSIVE = new THREE.Color('#FF006E');

// Map face index ranges to sections
function faceToSection(faceIndex: number): Section {
  if (faceIndex < 5) return 'projects';
  if (faceIndex < 10) return 'stats';
  if (faceIndex < 15) return 'activity';
  return 'about';
}

function Crystal({ onFacetClick, onHoverChange }: CrystalProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  const [hoverIntensity, setHoverIntensity] = useState(0);

  // Create geometry with per-face colors
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.8, 0);
    // Convert to non-indexed for per-face coloring
    const nonIndexed = geo.toNonIndexed();
    const count = nonIndexed.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = BASE_COLOR.r;
      colors[i * 3 + 1] = BASE_COLOR.g;
      colors[i * 3 + 2] = BASE_COLOR.b;
    }
    nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nonIndexed.computeVertexNormals();
    return nonIndexed;
  }, []);

  // Update face colors based on hover
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Slow rotation
    meshRef.current.rotation.y += delta * 0.15;
    meshRef.current.rotation.x += delta * 0.05;

    // Smooth hover intensity
    const target = hoveredFace !== null ? 1 : 0;
    setHoverIntensity((prev) => THREE.MathUtils.lerp(prev, target, delta * 8));

    // Update per-face colors
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const faceCount = colorAttr.count / 3;
    for (let face = 0; face < faceCount; face++) {
      const isHovered = hoveredFace !== null && face === hoveredFace;
      const isSameSection =
        hoveredFace !== null && faceToSection(face) === faceToSection(hoveredFace);

      for (let v = 0; v < 3; v++) {
        const idx = face * 3 + v;
        if (isHovered) {
          colorAttr.setXYZ(idx, ACCENT_RED.r, ACCENT_RED.g, ACCENT_RED.b);
        } else if (isSameSection) {
          const t = hoverIntensity * 0.3;
          colorAttr.setXYZ(
            idx,
            THREE.MathUtils.lerp(BASE_COLOR.r, ACCENT_RED.r, t),
            THREE.MathUtils.lerp(BASE_COLOR.g, ACCENT_RED.g, t),
            THREE.MathUtils.lerp(BASE_COLOR.b, ACCENT_RED.b, t)
          );
        } else {
          colorAttr.setXYZ(idx, BASE_COLOR.r, BASE_COLOR.g, BASE_COLOR.b);
        }
      }
    }
    colorAttr.needsUpdate = true;

    // Update emissive
    const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
    mat.emissiveIntensity = hoveredFace !== null ? hoverIntensity * 0.6 : hoverIntensity * 0.1;
  });

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.faceIndex !== undefined) {
      setHoveredFace(e.faceIndex);
      onHoverChange(faceToSection(e.faceIndex!));
    }
  }, [onHoverChange]);

  const handlePointerLeave = useCallback(() => {
    setHoveredFace(null);
    onHoverChange(null);
  }, [onHoverChange]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.faceIndex !== undefined) {
        onFacetClick(faceToSection(e.faceIndex!));
      }
    },
    [onFacetClick]
  );

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <meshPhysicalMaterial
        vertexColors
        roughness={0.15}
        metalness={0.4}
        clearcoat={1}
        clearcoatRoughness={0.1}
        emissive={HOVER_EMISSIVE}
        emissiveIntensity={0}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

interface CrystalSceneProps {
  onFacetClick: (section: Section) => void;
  onHoverChange: (section: Section | null) => void;
}

export default function CrystalScene({ onFacetClick, onHoverChange }: CrystalSceneProps) {
  return (
    <div className="w-full h-[45vh] md:h-[55vh] cursor-pointer crystal-glow">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, -3, 2]} intensity={0.3} color="#FF006E" />
        <pointLight position={[0, 0, 4]} intensity={0.5} color="#FF006E" />

        <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
          <Crystal onFacetClick={onFacetClick} onHoverChange={onHoverChange} />
        </Float>

        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
