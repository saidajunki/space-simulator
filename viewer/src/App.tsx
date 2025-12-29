import { useState, useCallback } from 'react';
import { WorldCanvas } from './components/WorldCanvas';
import { StatsPanel } from './components/StatsPanel';
import { ControlPanel } from './components/ControlPanel';
import { useSimulation } from './hooks/useSimulation';
import './App.css';

function App() {
  const [config, setConfig] = useState({
    seed: 42,
    maxTicks: 1000,
    nodes: 20,
    entities: 30,
    maxTypes: 5,
  });

  const {
    state,
    stats,
    isRunning,
    speed,
    start,
    pause,
    resume,
    step,
    setSpeed,
  } = useSimulation(config);

  const handleConfigChange = useCallback((key: string, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Universe Simulation Viewer</h1>
        <span className="tick">Tick: {state?.tick ?? 0}</span>
      </header>
      
      <main className="main">
        <div className="canvas-container">
          <WorldCanvas state={state} />
        </div>
        
        <aside className="sidebar">
          <ControlPanel
            config={config}
            isRunning={isRunning}
            speed={speed}
            onConfigChange={handleConfigChange}
            onStart={start}
            onPause={pause}
            onResume={resume}
            onStep={step}
            onSpeedChange={setSpeed}
          />
          <StatsPanel stats={stats} />
        </aside>
      </main>
    </div>
  );
}

export default App;
