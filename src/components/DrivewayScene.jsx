import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

const MOVEMENT_SPEED = 0.15;
const CELL_SIZE = 1;
const GAME_BOUNDS = {
  minX: -12,
  maxX: 12,
  minZ: -12,
  maxZ: 12
};

// Pool bounds for collision detection
const POOL_BOUNDS = {
  minX: -6,
  maxX: 6,
  minZ: -4,
  maxZ: 4
};

// Add planter positions to constants
const PLANTER_POSITIONS = [[-10, -10], [10, -10], [-10, 10], [10, 10]];

// Add planter size to constants (half-width of the planter)
const PLANTER_SIZE = 1.5; // Since planter box is 3x3

// Shared geometries
const SHARED_GEOMETRIES = {
  ground: new THREE.PlaneGeometry(50, 50),
  cleanedPatch: new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE),
  poolEdge: new THREE.RingGeometry(6.1, 6.5, 32),
  poolWater: new THREE.PlaneGeometry(12, 8),
  loungeChair: new THREE.BoxGeometry(2, 0.1, 4),
  chairBase: new THREE.BoxGeometry(2, 0.2, 1),
  planter: new THREE.BoxGeometry(3, 1, 3),
  plant: new THREE.SphereGeometry(0.4, 8, 8),
  palmTrunk: new THREE.CylinderGeometry(0.3, 0.4, 4),
  palmLeaf: new THREE.ConeGeometry(0.5, 2, 4)
};

// Shared materials
const SHARED_MATERIALS = {
  ground: new THREE.MeshStandardMaterial({ color: '#4a4a4a' }),
  poolDeck: new THREE.MeshStandardMaterial({ 
    color: '#e0e0e0',
    roughness: 0.8,
    metalness: 0.2
  }),
  poolWater: new THREE.MeshStandardMaterial({ 
    color: '#4fc3f7',
    transparent: true,
    opacity: 0.8
  }),
  poolEdge: new THREE.MeshStandardMaterial({ color: '#e0e0e0' }),
  furniture: new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  planter: new THREE.MeshStandardMaterial({ color: '#8d6e63' }),
  plant: new THREE.MeshStandardMaterial({ color: '#2e7d32' }),
  cleaned: new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
    metalness: 0.2,
    emissive: '#ffffff',
    emissiveIntensity: 0.2
  }),
  dirt: new THREE.MeshStandardMaterial({
    color: '#3a3a3a',
    transparent: true,
    opacity: 0.3,
    roughness: 0.9,
    metalness: 0.1
  })
};

// Surface heights
const SURFACE_HEIGHTS = {
  ground: -0.01,
  poolDeck: 0.02,
  poolWater: 0.1,
  poolEdge: 0.15
};

// Mobile control styles
const mobileControlsStyle = {
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  zIndex: 2000,
  pointerEvents: 'auto',
  touchAction: 'none',
};

const dpadStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 40px)',
  gridTemplateRows: 'repeat(3, 40px)',
  gap: '5px',
  background: 'rgba(0, 0, 0, 0.5)',
  padding: '10px',
  borderRadius: '15px',
};

const buttonStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: '2px solid #ffffff80',
  backgroundColor: '#00000080',
  color: 'white',
  fontSize: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  touchAction: 'none',
  WebkitTapHighlightColor: 'transparent',
  pointerEvents: 'auto',
};

const cameraButtonStyle = {
  ...buttonStyle,
  position: 'fixed',
  top: '20px',
  right: '20px',
  zIndex: 2000,
};

export default function DrivewayScene({ onStatsUpdate, movement }) {
  const lavobotRef = useRef();
  const [dirtyCells, setDirtyCells] = useState(new Set());
  const [cleanedCells, setCleanedCells] = useState(new Set());
  const [totalCells, setTotalCells] = useState(0);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [lastPosition, setLastPosition] = useState(null);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const { camera, controls } = useThree();
  const [isMobile, setIsMobile] = useState(false);

  // Load the LavoBot model with caching
  const { scene: lavobotScene } = useGLTF('./lavobot.glb', true);

  // Update isInPool to include planter collision
  const isInPool = (x, z) => {
    // Check pool collision
    if (x >= POOL_BOUNDS.minX && x <= POOL_BOUNDS.maxX && 
        z >= POOL_BOUNDS.minZ && z <= POOL_BOUNDS.maxZ) {
      return true;
    }
    
    // Check planter collisions
    return PLANTER_POSITIONS.some(([planterX, planterZ]) => {
      return Math.abs(x - planterX) < PLANTER_SIZE && 
             Math.abs(z - planterZ) < PLANTER_SIZE;
    });
  };

  // Memoize static elements
  const staticElements = useMemo(() => ({
    ground: (
      <mesh rotation-x={-Math.PI / 2} position={[0, SURFACE_HEIGHTS.ground, 0]} receiveShadow>
        <primitive object={SHARED_GEOMETRIES.ground} />
        <primitive object={SHARED_MATERIALS.ground} />
      </mesh>
    ),
    pool: (
      <group position={[0, 0, 0]}>
        <mesh position={[0, SURFACE_HEIGHTS.poolWater, 0]} rotation-x={-Math.PI / 2}>
          <primitive object={SHARED_GEOMETRIES.poolWater} />
          <primitive object={SHARED_MATERIALS.poolWater} />
        </mesh>
        <mesh position={[0, SURFACE_HEIGHTS.poolEdge, 0]} rotation-x={-Math.PI / 2}>
          <primitive object={SHARED_GEOMETRIES.poolEdge} />
          <primitive object={SHARED_MATERIALS.poolEdge} />
        </mesh>
      </group>
    ),
    poolDeck: (
      <mesh position={[0, SURFACE_HEIGHTS.poolDeck, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <primitive object={SHARED_MATERIALS.poolDeck} />
      </mesh>
    ),
    lighting: (
      <>
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={50}
          shadow-camera-near={1}
        />
        <pointLight position={[0, 0.5, 0]} intensity={0.3} color="#4fc3f7" />
        {[[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([x, z], i) => (
          <pointLight
            key={i}
            position={[x, 0.5, z]}
            intensity={0.2}
            distance={5}
            decay={2}
            color="#ffd700"
          />
        ))}
      </>
    )
  }), []);

  // Optimize cleaning patches rendering
  const CleanedPatches = React.memo(({ cells }) => {
    return Array.from(cells).map(cell => {
      const [x, z] = cell.split(',').map(Number);
      return (
        <mesh
          key={`clean-${cell}`}
          position={[x, SURFACE_HEIGHTS.poolDeck + 0.005, z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          <primitive object={SHARED_GEOMETRIES.cleanedPatch} />
          <primitive object={SHARED_MATERIALS.cleaned} />
        </mesh>
      );
    });
  });

  // Optimize dirt overlay rendering
  const DirtOverlay = React.memo(({ cells }) => {
    return Array.from(cells).map(cell => {
      const [x, z] = cell.split(',').map(Number);
      return (
        <mesh
          key={`dirt-${cell}`}
          position={[x, SURFACE_HEIGHTS.poolDeck + 0.002, z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          <primitive object={SHARED_GEOMETRIES.cleanedPatch} />
          <primitive object={SHARED_MATERIALS.dirt} />
        </mesh>
      );
    });
  });

  // Initialize dirty areas
  useEffect(() => {
    const initialDirtyCells = new Set();
    let cellCount = 0;
    
    for (let x = GAME_BOUNDS.minX; x <= GAME_BOUNDS.maxX; x++) {
      for (let z = GAME_BOUNDS.minZ; z <= GAME_BOUNDS.maxZ; z++) {
        // Only add cells that aren't in the pool
        if (!isInPool(x, z)) {
          initialDirtyCells.add(`${Math.round(x)},${Math.round(z)}`);
          cellCount++;
        }
      }
    }
    
    setDirtyCells(initialDirtyCells);
    setTotalCells(cellCount);
  }, []);

  // Handle view switching
  useEffect(() => {
    const handleViewSwitch = (e) => {
      if (e.key === 'v') {
        setIsFirstPerson(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleViewSwitch);
    return () => window.removeEventListener('keydown', handleViewSwitch);
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Optimized frame update
  useFrame(() => {
    if (!lavobotRef.current) return;

    const newPosition = lavobotRef.current.position.clone();
    const potentialX = newPosition.x + movement.x * MOVEMENT_SPEED;
    const potentialZ = newPosition.z + movement.z * MOVEMENT_SPEED;
    
    // Only update position if not moving into pool
    if (!isInPool(potentialX, potentialZ)) {
      newPosition.x = Math.max(GAME_BOUNDS.minX, Math.min(GAME_BOUNDS.maxX, potentialX));
      newPosition.z = Math.max(GAME_BOUNDS.minZ, Math.min(GAME_BOUNDS.maxZ, potentialZ));
      newPosition.y = SURFACE_HEIGHTS.poolDeck + 0.069;
    }
    
    lavobotRef.current.position.copy(newPosition);

    if (camera) {
      if (isFirstPerson) {
        const fpvOffset = new THREE.Vector3(0, 0.5, 0.75);
        const lookAheadOffset = new THREE.Vector3(0, 0.5, -3);
        camera.position.copy(newPosition).add(fpvOffset);
        camera.lookAt(newPosition.clone().add(lookAheadOffset));
      } else {
        const tpvOffset = new THREE.Vector3(0, 2, 3);
        camera.position.copy(newPosition).add(tpvOffset);
        camera.lookAt(newPosition);
      }
      
      if (controls) {
        controls.target.copy(newPosition);
        controls.update();
      }
    }

    const currentCell = `${Math.round(newPosition.x)},${Math.round(newPosition.z)}`;
    if (dirtyCells.has(currentCell)) {
      setDirtyCells(prev => {
        const newDirty = new Set(prev);
        newDirty.delete(currentCell);
        return newDirty;
      });
      setCleanedCells(prev => new Set(prev).add(currentCell));
    }

    setLastPosition(newPosition.clone());
  });

  // Update cleaning progress
  useEffect(() => {
    if (totalCells > 0) {
      const progress = ((cleanedCells.size / totalCells) * 100).toFixed(1);
      setCleaningProgress(progress);
      onStatsUpdate({
        progress: Number(progress),
        cleanedTiles: cleanedCells.size,
        totalTiles: totalCells,
        remainingTiles: totalCells - cleanedCells.size
      });
    }
  }, [cleanedCells, totalCells, onStatsUpdate]);

  return (
    <>
      <group>
        {staticElements.ground}
        {staticElements.lighting}
        {staticElements.poolDeck}
        {staticElements.pool}
        
        <DirtOverlay cells={dirtyCells} />
        <CleanedPatches cells={cleanedCells} />

        {/* Pool Furniture */}
        {[[-5, 3], [5, 3], [-5, -3], [5, -3]].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.2, 0]} rotation-x={-Math.PI / 6}>
              <primitive object={SHARED_GEOMETRIES.loungeChair} />
              <primitive object={SHARED_MATERIALS.furniture} />
            </mesh>
            <mesh position={[0, 0.1, 0.5]}>
              <primitive object={SHARED_GEOMETRIES.chairBase} />
              <primitive object={SHARED_MATERIALS.furniture} />
            </mesh>
          </group>
        ))}

        {/* Planters and Greenery */}
        {PLANTER_POSITIONS.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <primitive object={SHARED_GEOMETRIES.planter} />
              <primitive object={SHARED_MATERIALS.planter} />
            </mesh>
            <group position={[0, 1, 0]}>
              {Array.from({ length: 5 }, (_, j) => {
                const angle = (j * Math.PI * 0.4);
                return (
                  <mesh key={j} position={[
                    Math.sin(angle) * 0.5,
                    0.3,
                    Math.cos(angle) * 0.5
                  ]} castShadow>
                    <primitive object={SHARED_GEOMETRIES.plant} />
                    <primitive object={SHARED_MATERIALS.plant} />
                  </mesh>
                );
              })}
            </group>
          </group>
        ))}

        <primitive
          ref={lavobotRef}
          object={lavobotScene.clone()}
          position={lastPosition || [-8, SURFACE_HEIGHTS.poolDeck + 0.069, -8]}
          scale={[0.5, 0.5, 0.5]}
          rotation={[-Math.PI/2, 0, Math.PI/2]}
          castShadow
        />
      </group>
    </>
  );
} 