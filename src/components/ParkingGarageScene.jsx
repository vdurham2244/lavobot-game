import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

const MOVEMENT_SPEED = 0.15;
const CELL_SIZE = 1;
const GAME_BOUNDS = {
  minX: -15,
  maxX: 15,
  minZ: -10,
  maxZ: 10
};

// Car position and size for collision detection
const CAR_BOUNDS = {
  x: -8,
  z: -6,
  width: 1.5,
  length: 3
};

// Shared geometries
const SHARED_GEOMETRIES = {
  ground: new THREE.PlaneGeometry(40, 30),
  cleanedPatch: new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE),
  parkingSpace: new THREE.PlaneGeometry(4.5, 8),
  parkingLine: new THREE.PlaneGeometry(0.1, 8),
  column: new THREE.CylinderGeometry(0.3, 0.3, 4, 8),
  car: {
    chassis: new THREE.BoxGeometry(1.5, 0.3, 3),
    body: new THREE.BoxGeometry(1.4, 0.4, 1.8),
    hood: new THREE.BoxGeometry(1.3, 0.15, 0.7),
    trunk: new THREE.BoxGeometry(1.3, 0.15, 0.4),
    roof: new THREE.BoxGeometry(1.2, 0.35, 1),
    windshield: new THREE.BoxGeometry(1.1, 0.3, 0.05),
    backWindow: new THREE.BoxGeometry(1.1, 0.3, 0.05),
    sideWindow: new THREE.BoxGeometry(0.05, 0.2, 0.8),
    wheel: new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16),
    hubcap: new THREE.CylinderGeometry(0.1, 0.1, 0.02, 8),
    headlight: new THREE.BoxGeometry(0.2, 0.1, 0.05),
    taillight: new THREE.BoxGeometry(0.2, 0.1, 0.05),
    grille: new THREE.BoxGeometry(0.7, 0.15, 0.05),
    bumper: new THREE.BoxGeometry(1.4, 0.1, 0.15)
  }
};

// Shared materials with optimized properties
const SHARED_MATERIALS = {
  floor: new THREE.MeshStandardMaterial({ 
    color: '#505050',
    roughness: 0.7,
    metalness: 0.1
  }),
  ceiling: new THREE.MeshStandardMaterial({ 
    color: '#404040',
    roughness: 0.8,
    metalness: 0.2
  }),
  walls: new THREE.MeshStandardMaterial({ 
    color: '#606060',
    roughness: 0.7,
    metalness: 0.1
  }),
  columns: new THREE.MeshStandardMaterial({ 
    color: '#707070',
    roughness: 0.8,
    metalness: 0.2
  }),
  parkingLines: new THREE.MeshStandardMaterial({ 
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.1,
    emissive: '#404040',
    emissiveIntensity: 0.2
  }),
  car: {
    body: new THREE.MeshStandardMaterial({ 
      color: '#2E5894',
      roughness: 0.2,
      metalness: 0.8
    }),
    windows: new THREE.MeshStandardMaterial({ 
      color: '#1a1a1a',
      roughness: 0.1,
      metalness: 0.9,
      opacity: 0.7,
      transparent: true
    }),
    wheels: new THREE.MeshStandardMaterial({ 
      color: '#1a1a1a',
      roughness: 0.8,
      metalness: 0.2
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: '#CCCCCC',
      roughness: 0.1,
      metalness: 0.9
    }),
    lights: {
      head: new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        emissive: '#FFFFFF',
        emissiveIntensity: 0.5
      }),
      tail: new THREE.MeshStandardMaterial({
        color: '#FF0000',
        emissive: '#FF0000',
        emissiveIntensity: 0.5
      })
    }
  },
  cleaned: new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
    metalness: 0.2,
    emissive: '#ffffff',
    emissiveIntensity: 0.3
  }),
  dirt: new THREE.MeshStandardMaterial({
    color: '#3a3a3a',
    transparent: true,
    opacity: 0.4,
    roughness: 0.9,
    metalness: 0.1
  })
};

// Check if position is in car area
const isInCarArea = (x, z) => {
  return Math.abs(x - CAR_BOUNDS.x) < CAR_BOUNDS.width / 2 &&
         Math.abs(z - CAR_BOUNDS.z) < CAR_BOUNDS.length / 2;
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
  userSelect: 'none',
  WebkitUserSelect: 'none'
};

const dpadStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 40px)',
  gridTemplateRows: 'repeat(3, 40px)',
  gap: '5px',
  background: 'rgba(0, 0, 0, 0.5)',
  padding: '10px',
  borderRadius: '15px',
  pointerEvents: 'auto',
  touchAction: 'none'
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
  userSelect: 'none',
  WebkitUserSelect: 'none',
  outline: 'none'
};

const cameraButtonStyle = {
  ...buttonStyle,
  position: 'fixed',
  top: '20px',
  right: '20px',
  zIndex: 2000,
  width: '50px',
  height: '50px'
};

export default function ParkingGarageScene({ onStatsUpdate, movement }) {
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

  // Memoize static elements
  const staticElements = useMemo(() => ({
    structure: (
      <group>
        {/* Ceiling */}
        <mesh position={[0, 4, 0]} rotation-x={Math.PI / 2} receiveShadow frustumCulled>
          <primitive object={SHARED_GEOMETRIES.ground} />
          <primitive object={SHARED_MATERIALS.ceiling} />
        </mesh>

        {/* Floor */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow frustumCulled>
          <primitive object={SHARED_GEOMETRIES.ground} />
          <primitive object={SHARED_MATERIALS.floor} />
        </mesh>

        {/* Walls - Adjusted to match game bounds */}
        <mesh position={[0, 2, -10]} castShadow frustumCulled>
          <boxGeometry args={[30, 4, 0.5]} />
          <primitive object={SHARED_MATERIALS.walls} />
        </mesh>
        <mesh position={[-15, 2, 0]} rotation-y={Math.PI / 2} castShadow frustumCulled>
          <boxGeometry args={[20, 4, 0.5]} />
          <primitive object={SHARED_MATERIALS.walls} />
        </mesh>
        <mesh position={[15, 2, 0]} rotation-y={Math.PI / 2} castShadow frustumCulled>
          <boxGeometry args={[20, 4, 0.5]} />
          <primitive object={SHARED_MATERIALS.walls} />
        </mesh>

        {/* Add wall details */}
        <mesh position={[0, 2, 10]} castShadow frustumCulled>
          <boxGeometry args={[30, 4, 0.5]} />
          <primitive object={SHARED_MATERIALS.walls} />
        </mesh>
        
        {/* Add entrance */}
        <mesh position={[10, 1.5, 10]} castShadow frustumCulled>
          <boxGeometry args={[8, 3, 0.5]} />
          <meshStandardMaterial color="#1a1a1a" opacity={0.7} transparent />
        </mesh>
      </group>
    ),
    lighting: (
      <>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={0.6}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-far={50}
          shadow-camera-near={1}
          shadow-bias={-0.001}
        >
          <orthographicCamera 
            attach="shadow-camera"
            args={[-30, 30, 30, -30, 0.1, 50]}
          />
        </directionalLight>
        
        {/* Reduced number of ceiling lights but made them brighter */}
        {Array.from({ length: 3 }, (_, i) =>
          Array.from({ length: 2 }, (_, j) => (
            <pointLight
              key={`light-${i}-${j}`}
              position={[
                (i - 1) * 10,
                3.8,
                (j - 0.5) * 12
              ]}
              intensity={1}
              distance={12}
              decay={1.5}
              color="#fff7e6"
            />
          ))
        )}
        
        {/* Emergency lights along walls */}
        {Array.from({ length: 4 }, (_, i) => (
          <pointLight
            key={`emergency-${i}`}
            position={[(i - 1.5) * 8, 2.5, -9.5]}
            intensity={0.3}
            distance={5}
            decay={1.5}
            color="#ff4444"
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
          position={[x, 0.005, z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
          frustumCulled
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
          position={[x, 0.002, z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
          frustumCulled
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
        if (!isInCarArea(x, z)) {
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

  // Handle keyboard controls for desktop
  useEffect(() => {
    if (!isMobile) {
      let lastUpdate = 0;
      const updateInterval = 16; // ~60fps

      const handleKeyDown = (e) => {
        const now = performance.now();
        if (now - lastUpdate < updateInterval) return;
        lastUpdate = now;

        e.preventDefault();
        switch (e.key) {
          case 'ArrowUp': movement(prev => ({ ...prev, z: -1 })); break;
          case 'ArrowDown': movement(prev => ({ ...prev, z: 1 })); break;
          case 'ArrowLeft': movement(prev => ({ ...prev, x: -1 })); break;
          case 'ArrowRight': movement(prev => ({ ...prev, x: 1 })); break;
        }
      };

      const handleKeyUp = (e) => {
        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowDown': movement(prev => ({ ...prev, z: 0 })); break;
          case 'ArrowLeft':
          case 'ArrowRight': movement(prev => ({ ...prev, x: 0 })); break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isMobile]);

  // Optimized frame update
  useFrame(() => {
    if (!lavobotRef.current) return;

    const newPosition = lavobotRef.current.position.clone();
    const potentialX = newPosition.x + movement.x * MOVEMENT_SPEED;
    const potentialZ = newPosition.z + movement.z * MOVEMENT_SPEED;
    
    // Only update position if not in car area
    if (!isInCarArea(potentialX, potentialZ)) {
      newPosition.x = Math.max(GAME_BOUNDS.minX, Math.min(GAME_BOUNDS.maxX, potentialX));
      newPosition.z = Math.max(GAME_BOUNDS.minZ, Math.min(GAME_BOUNDS.maxZ, potentialZ));
      newPosition.y = 0.069;
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
        {staticElements.structure}
        {staticElements.lighting}
        
        <DirtOverlay cells={dirtyCells} />
        <CleanedPatches cells={cleanedCells} />

        {/* Support Columns - Adjusted layout */}
        {Array.from({ length: 3 }, (_, col) =>
          Array.from({ length: 3 }, (_, row) => (
            <mesh
              key={`column-${col}-${row}`}
              position={[
                (col - 1) * 10,
                2,
                (row - 1) * 6
              ]}
              castShadow
              frustumCulled
            >
              <primitive object={SHARED_GEOMETRIES.column} />
              <primitive object={SHARED_MATERIALS.columns} />
            </mesh>
          ))
        )}

        {/* Parked Car - Adjusted positions for scaled car */}
        <group position={[CAR_BOUNDS.x, 0.2, CAR_BOUNDS.z]}>  {/* Lowered height */}
          {/* Chassis */}
          <mesh position={[0, 0.15, 0]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.chassis} />
            <primitive object={SHARED_MATERIALS.car.body} />
          </mesh>
          
          {/* Main Body */}
          <mesh position={[0, 0.5, -0.2]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.body} />
            <primitive object={SHARED_MATERIALS.car.body} />
          </mesh>
          
          {/* Hood */}
          <mesh position={[0, 0.45, -1]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.hood} />
            <primitive object={SHARED_MATERIALS.car.body} />
          </mesh>
          
          {/* Trunk */}
          <mesh position={[0, 0.45, 1]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.trunk} />
            <primitive object={SHARED_MATERIALS.car.body} />
          </mesh>
          
          {/* Roof */}
          <mesh position={[0, 0.7, -0.2]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.roof} />
            <primitive object={SHARED_MATERIALS.car.body} />
          </mesh>
          
          {/* Windows */}
          <mesh position={[0, 0.65, -0.7]} rotation-x={Math.PI * 0.2} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.windshield} />
            <primitive object={SHARED_MATERIALS.car.windows} />
          </mesh>
          <mesh position={[0, 0.65, 0.3]} rotation-x={-Math.PI * 0.2} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.backWindow} />
            <primitive object={SHARED_MATERIALS.car.windows} />
          </mesh>
          {[-0.7, 0.7].map((x, i) => (
            <mesh key={`side-window-${i}`} position={[x, 0.6, -0.2]} castShadow>
              <primitive object={SHARED_GEOMETRIES.car.sideWindow} />
              <primitive object={SHARED_MATERIALS.car.windows} />
            </mesh>
          ))}
          
          {/* Wheels with Chrome Hubcaps */}
          {[[-0.6, -0.25, -0.8], [0.6, -0.25, -0.8], [-0.6, -0.25, 0.8], [0.6, -0.25, 0.8]].map(([x, y, z], i) => (
            <group key={`wheel-${i}`}>
              <mesh position={[x, y, z]} rotation-z={Math.PI / 2} castShadow>
                <primitive object={SHARED_GEOMETRIES.car.wheel} />
                <primitive object={SHARED_MATERIALS.car.wheels} />
              </mesh>
              <mesh position={[x, y - 0.06, z]} rotation-z={Math.PI / 2} castShadow>
                <primitive object={SHARED_GEOMETRIES.car.hubcap} />
                <primitive object={SHARED_MATERIALS.car.chrome} />
              </mesh>
            </group>
          ))}
          
          {/* Front Details */}
          <mesh position={[0, 0.35, -1.3]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.grille} />
            <primitive object={SHARED_MATERIALS.car.chrome} />
          </mesh>
          {[-0.5, 0.5].map((x, i) => (
            <mesh key={`headlight-${i}`} position={[x, 0.4, -1.3]} castShadow>
              <primitive object={SHARED_GEOMETRIES.car.headlight} />
              <primitive object={SHARED_MATERIALS.car.lights.head} />
            </mesh>
          ))}
          <mesh position={[0, 0.3, -1.3]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.bumper} />
            <primitive object={SHARED_MATERIALS.car.chrome} />
          </mesh>
          
          {/* Rear Details */}
          {[-0.5, 0.5].map((x, i) => (
            <mesh key={`taillight-${i}`} position={[x, 0.4, 1.3]} castShadow>
              <primitive object={SHARED_GEOMETRIES.car.taillight} />
              <primitive object={SHARED_MATERIALS.car.lights.tail} />
            </mesh>
          ))}
          <mesh position={[0, 0.3, 1.3]} castShadow>
            <primitive object={SHARED_GEOMETRIES.car.bumper} />
            <primitive object={SHARED_MATERIALS.car.chrome} />
          </mesh>
        </group>

        <primitive
          ref={lavobotRef}
          object={lavobotScene.clone()}
          position={lastPosition || [-1, 0.069, 0]}
          scale={[0.5, 0.5, 0.5]}
          rotation={[-Math.PI/2, 0, Math.PI/2]}
          castShadow
        />
      </group>
    </>
  );
} 