import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import ParkingLotScene from './components/ParkingLotScene';
import DrivewayScene from './components/DrivewayScene';
import ParkingGarageScene from './components/ParkingGarageScene';

function App() {
  const [currentScene, setCurrentScene] = useState('parkingLot');
  const [isMobile, setIsMobile] = useState(false);
  const [movement, setMovement] = useState({ x: 0, z: 0 });
  const [stats, setStats] = useState({
    progress: 0,
    cleanedTiles: 0,
    totalTiles: 0,
    remainingTiles: 0
  });

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
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp': setMovement(prev => ({ ...prev, z: -1 })); break;
        case 'ArrowDown': setMovement(prev => ({ ...prev, z: 1 })); break;
        case 'ArrowLeft': setMovement(prev => ({ ...prev, x: -1 })); break;
        case 'ArrowRight': setMovement(prev => ({ ...prev, x: 1 })); break;
      }
    };

    const handleKeyUp = (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown': setMovement(prev => ({ ...prev, z: 0 })); break;
        case 'ArrowLeft':
        case 'ArrowRight': setMovement(prev => ({ ...prev, x: 0 })); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updateStats = (newStats) => {
    setStats(newStats);
  };

  // Simple movement controls for mobile
  const handleMove = (direction) => {
    switch(direction) {
      case 'up':
        setMovement({ x: 0, z: -1 });
        break;
      case 'down':
        setMovement({ x: 0, z: 1 });
        break;
      case 'left':
        setMovement({ x: -1, z: 0 });
        break;
      case 'right':
        setMovement({ x: 1, z: 0 });
        break;
      default:
        setMovement({ x: 0, z: 0 });
    }
  };

  const handleStop = () => {
    setMovement({ x: 0, z: 0 });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Stats UI */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '10px' : '20px',
        right: isMobile ? '10px' : '20px',
        background: 'rgba(0, 0, 0, 0.85)',
        padding: isMobile ? '10px' : '20px',
        borderRadius: '15px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        minWidth: isMobile ? '120px' : '250px',
        maxWidth: isMobile ? '150px' : 'none',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        fontSize: isMobile ? '12px' : '14px',
        pointerEvents: 'none'
      }}>
        <div style={{ 
          fontSize: isMobile ? '16px' : '20px', 
          fontWeight: 'bold', 
          color: '#4fc3f7',
          marginBottom: isMobile ? '10px' : '15px',
          textAlign: 'center',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          Progress
        </div>
        
        {/* Progress Bar */}
        <div style={{ 
          width: '100%', 
          height: isMobile ? '15px' : '20px', 
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: isMobile ? '10px' : '15px'
        }}>
          <div style={{
            width: `${stats.progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #4CAF50, #81c784)',
            transition: 'width 0.3s ease-in-out'
          }} />
        </div>

        <div style={{
          fontSize: isMobile ? '18px' : '24px',
          fontWeight: 'bold',
          color: '#81c784',
          textAlign: 'center',
          marginBottom: isMobile ? '10px' : '15px'
        }}>
          {stats.progress}%
        </div>

        <div style={{
          display: 'grid',
          gap: isMobile ? '5px' : '10px',
          fontSize: isMobile ? '12px' : '14px',
          color: '#b0bec5'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cleaned:</span>
            <span style={{ color: '#4fc3f7' }}>{stats.cleanedTiles}/{stats.totalTiles}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Left:</span>
            <span style={{ color: '#ff8a65' }}>{stats.remainingTiles}</span>
          </div>
        </div>
      </div>

      <Canvas 
        shadows 
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          KhtmlUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {currentScene === 'parkingLot' && <ParkingLotScene onStatsUpdate={updateStats} movement={movement} />}
        {currentScene === 'driveway' && <DrivewayScene onStatsUpdate={updateStats} movement={movement} />}
        {currentScene === 'parkingGarage' && <ParkingGarageScene onStatsUpdate={updateStats} movement={movement} />}
        <Environment preset="city" />
      </Canvas>

      {/* Simple Movement Controls for Mobile */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 60px)',
          gridTemplateRows: 'repeat(3, 60px)',
          gap: '5px',
          zIndex: 2000,
        }}>
          {/* Up button */}
          <div style={{ gridColumn: '2' }}>
            <button
              onTouchStart={() => handleMove('up')}
              onTouchEnd={handleStop}
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid white',
                borderRadius: '50%',
                color: 'white',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ⬆️
            </button>
          </div>
          
          {/* Left button */}
          <div style={{ gridRow: '2' }}>
            <button
              onTouchStart={() => handleMove('left')}
              onTouchEnd={handleStop}
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid white',
                borderRadius: '50%',
                color: 'white',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ⬅️
            </button>
          </div>
          
          {/* Right button */}
          <div style={{ gridColumn: '3', gridRow: '2' }}>
            <button
              onTouchStart={() => handleMove('right')}
              onTouchEnd={handleStop}
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid white',
                borderRadius: '50%',
                color: 'white',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ➡️
            </button>
          </div>
          
          {/* Down button */}
          <div style={{ gridColumn: '2', gridRow: '3' }}>
            <button
              onTouchStart={() => handleMove('down')}
              onTouchEnd={handleStop}
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid white',
                borderRadius: '50%',
                color: 'white',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ⬇️
            </button>
          </div>
        </div>
      )}
      
      {/* Scene Selector */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '10px' : 'auto',
        bottom: isMobile ? 'auto' : '20px',
        left: isMobile ? '10px' : '50%',
        transform: isMobile ? 'none' : 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        background: 'rgba(0, 0, 0, 0.85)',
        padding: isMobile ? '10px' : '10px',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}>
        <button
          onClick={() => setCurrentScene('parkingLot')}
          style={{
            padding: isMobile ? '8px 12px' : '10px 20px',
            background: currentScene === 'parkingLot' ? '#4CAF50' : '#2C3E50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background 0.3s',
            fontSize: isMobile ? '12px' : '16px',
            whiteSpace: 'nowrap'
          }}
        >
          Parking Lot
        </button>
        <button
          onClick={() => setCurrentScene('driveway')}
          style={{
            padding: isMobile ? '8px 12px' : '10px 20px',
            background: currentScene === 'driveway' ? '#4CAF50' : '#2C3E50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background 0.3s',
            fontSize: isMobile ? '12px' : '16px',
            whiteSpace: 'nowrap'
          }}
        >
          Pool Deck
        </button>
        <button
          onClick={() => setCurrentScene('parkingGarage')}
          style={{
            padding: isMobile ? '8px 12px' : '10px 20px',
            background: currentScene === 'parkingGarage' ? '#4CAF50' : '#2C3E50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background 0.3s',
            fontSize: isMobile ? '12px' : '16px',
            whiteSpace: 'nowrap'
          }}
        >
          Parking Garage
        </button>
      </div>
    </div>
  );
}

export default App; 