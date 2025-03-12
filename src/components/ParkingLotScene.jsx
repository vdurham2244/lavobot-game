import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import * as THREE from 'three';

const MOVEMENT_SPEED = 0.15;
const CELL_SIZE = 1;
const GAME_BOUNDS = {
  minX: -17,
  maxX: 17,
  minZ: -26,
  maxZ: -4
};

// Shared geometries
const SHARED_GEOMETRIES = {
  ground: new THREE.PlaneGeometry(100, 100),
  parkingSpace: new THREE.PlaneGeometry(5, 7),
  parkingLine: new THREE.PlaneGeometry(0.1, 7),
  driveway: new THREE.PlaneGeometry(8, 15),
  cleanedPatch: new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE),
  roadMarking: new THREE.PlaneGeometry(3, 0.3)
};

// Shared materials
const SHARED_MATERIALS = {
  ground: new THREE.MeshStandardMaterial({ color: '#2c2c2c' }),
  parking: new THREE.MeshStandardMaterial({ color: '#404040' }),
  parkingLine: new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  driveway: new THREE.MeshStandardMaterial({ 
    color: '#505050',
    roughness: 0.8,
    metalness: 0.2
  }),
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

// Surface heights for different areas
const SURFACE_HEIGHTS = {
  ground: -0.01,
  road: 0.02,
  parking: 0.0,
  driveway: 0.02,
  sidewalk: 0.04
};

// Cleaning patch offset (slightly above surface)
const CLEANING_OFFSET = 0.005;

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

export default function ParkingLotScene({ onStatsUpdate, movement }) {
  const lavobotRef = useRef();
  const [dirtyCells, setDirtyCells] = useState(new Set());
  const [cleanedCells, setCleanedCells] = useState(new Set());
  const [totalCells, setTotalCells] = useState(0);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [lastPosition, setLastPosition] = useState(null);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const { camera, controls, gl } = useThree();
  const [isMobile, setIsMobile] = useState(false);

  // Load the LavoBot model with caching
  const { scene: lavobotScene } = useGLTF('/lavobot.glb', true);
  
  // Memoize static elements
  const staticElements = useMemo(() => ({
    ground: (
      <mesh rotation-x={-Math.PI / 2} position={[0, SURFACE_HEIGHTS.ground, 0]} receiveShadow>
        <primitive object={SHARED_GEOMETRIES.ground} />
        <primitive object={SHARED_MATERIALS.ground} />
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
        <pointLight position={[0, 10, 0]} intensity={0.5} distance={30} decay={2} />
      </>
    )
  }), []);

  // Optimize cleaning patches rendering
  const CleanedPatches = React.memo(({ cells }) => {
    return Array.from(cells).map(cell => {
      const [x, z, type] = cell.split(',');
      const height = SURFACE_HEIGHTS[type] + 0.005;
      return (
        <mesh
          key={`clean-${cell}`}
          position={[Number(x), height, Number(z)]}
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
      const [x, z, type] = cell.split(',');
      const height = SURFACE_HEIGHTS[type] + 0.0025;
      return (
        <mesh
          key={`dirt-${cell}`}
          position={[Number(x), height, Number(z)]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          <primitive object={SHARED_GEOMETRIES.cleanedPatch} />
          <primitive object={SHARED_MATERIALS.dirt} />
        </mesh>
      );
    });
  });

  // Optimize parking lot rendering with instancing
  const ParkingLot = React.memo(() => {
    const parkingSpaces = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const x = (col - 2.5) * 6;
        const z = (row - 1) * 8 - 15;
        parkingSpaces.push(
          <group key={`parking-${row}-${col}`}>
            <mesh position={[x, 0, z]} rotation-x={-Math.PI / 2} receiveShadow>
              <primitive object={SHARED_GEOMETRIES.parkingSpace} />
              <primitive object={SHARED_MATERIALS.parking} />
            </mesh>
            <mesh position={[x - 2.4, 0.01, z]} rotation-x={-Math.PI / 2} receiveShadow>
              <primitive object={SHARED_GEOMETRIES.parkingLine} />
              <primitive object={SHARED_MATERIALS.parkingLine} />
            </mesh>
            <mesh position={[x + 2.4, 0.01, z]} rotation-x={-Math.PI / 2} receiveShadow>
              <primitive object={SHARED_GEOMETRIES.parkingLine} />
              <primitive object={SHARED_MATERIALS.parkingLine} />
            </mesh>
          </group>
        );
      }
    }
    return <>{parkingSpaces}</>;
  });

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

  // Function to determine if a position is in a cleanable area and get its type
  const getCleanableArea = (x, z) => {
    // Check if in parking spaces area
    const inParkingArea = z >= -26 && z <= -10; // Adjusted for new bounds
    if (Math.abs(x) <= 17 && inParkingArea) {
      return { cleanable: true, type: 'parking', height: SURFACE_HEIGHTS.parking };
    }
    
    // Check if in driveway area
    if (z >= -10 && z <= -2 && Math.abs(x) <= 17) {
      return { cleanable: true, type: 'driveway', height: SURFACE_HEIGHTS.driveway };
    }
    
    // Check if in main road area
    if (z >= -2 && z <= 0 && Math.abs(x) <= 17) {
      return { cleanable: true, type: 'road', height: SURFACE_HEIGHTS.road };
    }

    return { cleanable: false, type: null, height: SURFACE_HEIGHTS.ground };
  };

  // Initialize dirty areas
  useEffect(() => {
    const initialDirtyCells = new Set();
    let cellCount = 0;
    
    for (let x = GAME_BOUNDS.minX; x <= GAME_BOUNDS.maxX; x++) {
      for (let z = GAME_BOUNDS.minZ; z <= GAME_BOUNDS.maxZ; z++) {
        const area = getCleanableArea(x, z);
        if (area.cleanable) {
          initialDirtyCells.add(`${Math.round(x)},${Math.round(z)},${area.type}`);
          cellCount++;
        }
      }
    }
    
    setDirtyCells(initialDirtyCells);
    setTotalCells(cellCount);
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
    newPosition.x += movement.x * MOVEMENT_SPEED;
    newPosition.z += movement.z * MOVEMENT_SPEED;
    
    newPosition.x = Math.max(GAME_BOUNDS.minX, Math.min(GAME_BOUNDS.maxX, newPosition.x));
    newPosition.z = Math.max(GAME_BOUNDS.minZ, Math.min(GAME_BOUNDS.maxZ, newPosition.z));
    
    const area = getCleanableArea(Math.round(newPosition.x), Math.round(newPosition.z));
    if (area.cleanable) {
      newPosition.y = area.height + 0.069;
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

    const currentCell = `${Math.round(newPosition.x)},${Math.round(newPosition.z)},${area.type}`;
    if (area.cleanable && dirtyCells.has(currentCell)) {
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
        
        <DirtOverlay cells={dirtyCells} />
        <CleanedPatches cells={cleanedCells} />
        <ParkingLot />

        <primitive
          ref={lavobotRef}
          object={lavobotScene.clone()}
          position={lastPosition || [0, 0.069, 0]}
          scale={[0.5, 0.5, 0.5]}
          rotation={[-Math.PI/2, 0, Math.PI/2]}
          castShadow
        />
      </group>
    </>
  );
}