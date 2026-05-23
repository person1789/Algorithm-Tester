function RunNotebook({ experiments, onExport }) {
  return (
    <div className="tool-panel notebook-panel">
      <div className="tool-panel-header">
        <div>
          <strong>Run Notebook</strong>
          <span>Saved experiment history from pipeline runs.</span>
        </div>
        <button className="toolbar-btn" onClick={onExport} disabled={!experiments.length}>Export JSON</button>
      </div>

      {experiments.length === 0 ? (
        <div className="empty-state">Run a pipeline to capture metrics here.</div>
      ) : (
        <div className="notebook-list">
          {experiments.map(exp => (
            <article key={exp.id} className="notebook-entry">
              <header>
                <strong>{exp.pipeline}</strong>
                <span>{exp.timestamp}</span>
              </header>
              <div className="notebook-metrics">
                <span>RMSE {exp.rmse}</span>
                <span>Max {exp.maxError}</span>
                <span>{exp.latency}ms</span>
                <span>{exp.norm}</span>
                <span>{exp.features ? 'features on' : 'features off'}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default RunNotebook;
