interface ControlPanelProps {
  config: {
    seed: number;
    maxTicks: number;
    nodes: number;
    entities: number;
    maxTypes: number;
  };
  isRunning: boolean;
  speed: number;
  onConfigChange: (key: string, value: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

export function ControlPanel({
  config,
  isRunning,
  speed,
  onConfigChange,
  onStart,
  onPause,
  onResume,
  onStep,
  onSpeedChange,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      <h2>Controls</h2>

      <div className="config-grid">
        <div className="config-item">
          <label>Seed</label>
          <input
            type="number"
            value={config.seed}
            onChange={(e) => onConfigChange('seed', parseInt(e.target.value) || 0)}
            disabled={isRunning}
          />
        </div>
        <div className="config-item">
          <label>Max Ticks</label>
          <input
            type="number"
            value={config.maxTicks}
            onChange={(e) => onConfigChange('maxTicks', parseInt(e.target.value) || 100)}
            disabled={isRunning}
          />
        </div>
        <div className="config-item">
          <label>Nodes</label>
          <input
            type="number"
            value={config.nodes}
            onChange={(e) => onConfigChange('nodes', parseInt(e.target.value) || 10)}
            disabled={isRunning}
          />
        </div>
        <div className="config-item">
          <label>Entities</label>
          <input
            type="number"
            value={config.entities}
            onChange={(e) => onConfigChange('entities', parseInt(e.target.value) || 10)}
            disabled={isRunning}
          />
        </div>
        <div className="config-item">
          <label>Max Types</label>
          <input
            type="number"
            value={config.maxTypes}
            onChange={(e) => onConfigChange('maxTypes', parseInt(e.target.value) || 5)}
            disabled={isRunning}
          />
        </div>
      </div>

      <div className="control-buttons">
        {!isRunning ? (
          <>
            <button className="btn-primary" onClick={onStart}>
              Start
            </button>
            <button className="btn-secondary" onClick={onStep}>
              Step
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={onPause}>
              Pause
            </button>
            <button className="btn-secondary" onClick={onStep}>
              Step
            </button>
          </>
        )}
        {!isRunning && (
          <button className="btn-secondary" onClick={onResume}>
            Resume
          </button>
        )}
      </div>

      <div className="speed-control">
        <label>Speed</label>
        <input
          type="range"
          min="0.5"
          max="4"
          step="0.5"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
        />
        <span>{speed}x</span>
      </div>
    </div>
  );
}
