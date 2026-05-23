const PARAM_DEFS = [
  { key: 'alpha', label: 'EMA alpha', min: 0.01, max: 1, step: 0.01 },
  { key: 'windowSize', label: 'Window', min: 2, max: 80, step: 1 },
  { key: 'Q', label: 'Kalman Q', min: 0, max: 5, step: 0.01 },
  { key: 'R', label: 'Kalman R', min: 1, max: 1000, step: 1 },
  { key: 'maxStep', label: 'Spike clamp', min: 1, max: 250, step: 1 },
  { key: 'epochs', label: 'Epochs', min: 1, max: 200, step: 1 },
  { key: 'learningRate', label: 'Learn rate', min: 0.0001, max: 0.1, step: 0.0001 }
];

function ParameterControls({ params, setParams, onReset }) {
  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: Number(value) }));
  };

  return (
    <div className="tool-panel parameter-controls">
      <div className="tool-panel-header">
        <div>
          <strong>Parameters</strong>
          <span>Algorithms can read these values from the `params` object.</span>
        </div>
        <button className="toolbar-btn" onClick={onReset}>Reset</button>
      </div>

      <div className="parameter-grid">
        {PARAM_DEFS.map(def => (
          <label key={def.key} className="parameter-row">
            <span>{def.label}</span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={params[def.key]}
              onChange={event => updateParam(def.key, event.target.value)}
            />
            <input
              type="number"
              min={def.min}
              max={def.max}
              step={def.step}
              value={params[def.key]}
              onChange={event => updateParam(def.key, event.target.value)}
            />
          </label>
        ))}
      </div>

      <pre className="inline-code">{`const alpha = params.alpha;
const windowSize = params.windowSize;
const Q = params.Q;
const R = params.R;`}</pre>
    </div>
  );
}

export default ParameterControls;
