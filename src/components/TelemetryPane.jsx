import React, { useState } from 'react';
import PlotModule from 'react-plotly.js';
import FFT from 'fft.js';

// Handle ESM/CJS compat: some versions export { default: Component } 
const Plot = PlotModule.default || PlotModule;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error: error.message }; }
  render() {
    if (this.state.error) {
      return <div style={{padding: '20px', color: '#c62828'}}>Chart Error: {this.state.error}</div>;
    }
    return this.props.children;
  }
}

function TelemetryPane({ 
  data, filteredData, filteredDataB, logs, metrics, metricsB, 
  sweepResults, cvResults, classificationResults, pcaResults, trainingHistory,
  residuals, correlationMatrix, acfData, confidenceBands, experiments,
  viewMode, setViewMode
}) {
  const [localViewMode, setLocalViewMode] = useState('time');
  const activeViewMode = viewMode || localViewMode;
  const changeViewMode = setViewMode || setLocalViewMode;

  const calculateFFT = (inputData) => {
    if (!inputData || inputData.length < 4) return null;
    let pow = 1;
    while (pow * 2 <= inputData.length) pow *= 2;
    if (pow < 4) return null;
    const slice = inputData.slice(0, pow).map(d => d.value || 0);
    const f = new FFT(pow);
    const out = f.createComplexArray();
    const input = f.toComplexArray(slice);
    f.transform(out, input);
    const magnitudes = [], freqs = [];
    for (let i = 0; i < pow / 2; i++) {
      magnitudes.push(Math.sqrt(out[i*2]**2 + out[i*2+1]**2) / pow);
      freqs.push(i);
    }
    return { freqs, magnitudes };
  };

  const buildPlotData = () => {
    const plotData = [];
    const layout = { autosize: true, margin: { l: 45, r: 15, t: 35, b: 35 }, legend: { orientation: 'h', y: 1.1 } };

    if (sweepResults) {
      plotData.push({ x: sweepResults.map(r => r.sweepValue), y: sweepResults.map(r => r.rmse), type: 'scatter', mode: 'lines+markers', name: 'RMSE', line: { color: '#800080', width: 2 } });
      layout.title = 'Hyperparameter Sweep'; layout.xaxis = { title: 'Param' }; layout.yaxis = { title: 'RMSE' };
      return { plotData, layout };
    }

    if (activeViewMode === 'training' && trainingHistory) {
      plotData.push({ x: trainingHistory.map(h => h.epoch), y: trainingHistory.map(h => h.loss), type: 'scatter', mode: 'lines', name: 'Train Loss', line: { color: '#d32f2f', width: 2 } });
      if (trainingHistory.some(h => h.val_loss !== undefined)) {
        plotData.push({ x: trainingHistory.map(h => h.epoch), y: trainingHistory.map(h => h.val_loss), type: 'scatter', mode: 'lines', name: 'Val Loss', line: { color: '#1565c0', width: 2, dash: 'dash' } });
      }
      layout.title = 'Training Progress'; layout.xaxis = { title: 'Epoch' }; layout.yaxis = { title: 'Loss' };
      return { plotData, layout };
    }

    if (activeViewMode === 'cv' && cvResults) {
      const valid = cvResults.filter(r => r.rmse !== null);
      plotData.push({ x: valid.map(r => r.startTime), y: valid.map(r => r.rmse), type: 'scatter', mode: 'lines+markers', name: 'Rolling RMSE', line: { color: '#d32f2f', width: 2 } });
      layout.title = 'Cross-Validation Backtest'; layout.xaxis = { title: 'Chunk' }; layout.yaxis = { title: 'RMSE' };
      return { plotData, layout };
    }

    if (activeViewMode === 'pca' && pcaResults) {
      plotData.push({ x: pcaResults.map(p => p.pc1), y: pcaResults.map(p => p.pc2), type: 'scatter', mode: 'markers', name: 'PCA', marker: { color: pcaResults.map((_, i) => i), colorscale: 'Viridis', size: 5 } });
      layout.title = 'PCA Projection'; layout.xaxis = { title: 'PC1' }; layout.yaxis = { title: 'PC2' };
      return { plotData, layout };
    }

    if (activeViewMode === 'classification' && classificationResults) {
      const cm = classificationResults;
      plotData.push({ z: cm.classes.map(a => cm.classes.map(p => cm.matrix[a][p])), x: cm.classes.map(String), y: cm.classes.map(String), type: 'heatmap', colorscale: 'Blues' });
      layout.title = 'Confusion Matrix'; layout.xaxis = { title: 'Predicted' }; layout.yaxis = { title: 'Actual' };
      return { plotData, layout };
    }

    if (activeViewMode === 'residuals' && residuals && residuals.length > 0) {
      plotData.push({ x: residuals.map(r => r.time), y: residuals.map(r => r.residual), type: 'scatter', mode: 'markers', name: 'Residuals', marker: { color: residuals.map(r => r.residual), colorscale: 'RdBu', size: 4 } });
      plotData.push({ x: [residuals[0].time, residuals[residuals.length-1].time], y: [0, 0], type: 'scatter', mode: 'lines', name: 'Zero', line: { color: '#999', dash: 'dash', width: 1 }, showlegend: false });
      layout.title = 'Residual Analysis'; layout.xaxis = { title: 'Time' }; layout.yaxis = { title: 'Predicted − Actual' };
      return { plotData, layout };
    }

    if (activeViewMode === 'correlation' && correlationMatrix) {
      plotData.push({ z: correlationMatrix.matrix, x: correlationMatrix.fields, y: correlationMatrix.fields, type: 'heatmap', colorscale: 'RdBu', zmin: -1, zmax: 1 });
      layout.title = 'Feature Correlation Matrix';
      return { plotData, layout };
    }

    if (activeViewMode === 'histogram' && data && data.length > 0) {
      const values = data.map(d => d.value).filter(v => v !== null && v !== undefined);
      plotData.push({ x: values, type: 'histogram', name: 'Raw', marker: { color: 'rgba(200,200,200,0.7)' }, nbinsx: 40 });
      if (filteredData) {
        const fValues = filteredData.map(d => d.value).filter(v => v !== null && v !== undefined);
        plotData.push({ x: fValues, type: 'histogram', name: 'Filtered', marker: { color: 'rgba(46,125,50,0.5)' }, nbinsx: 40 });
      }
      layout.title = 'Value Distribution'; layout.barmode = 'overlay';
      return { plotData, layout };
    }

    if (activeViewMode === 'acf' && acfData && acfData.length > 0) {
      plotData.push({ x: acfData.map(a => a.lag), y: acfData.map(a => a.acf), type: 'bar', name: 'ACF', marker: { color: '#5c6bc0' } });
      const n = data ? data.length : 100;
      const sig = 1.96 / Math.sqrt(n);
      plotData.push({ x: [0, acfData.length], y: [sig, sig], type: 'scatter', mode: 'lines', line: { color: '#d32f2f', dash: 'dash', width: 1 }, showlegend: false });
      plotData.push({ x: [0, acfData.length], y: [-sig, -sig], type: 'scatter', mode: 'lines', line: { color: '#d32f2f', dash: 'dash', width: 1 }, showlegend: false });
      layout.title = 'Autocorrelation (ACF)'; layout.xaxis = { title: 'Lag' }; layout.yaxis = { title: 'Correlation' };
      return { plotData, layout };
    }

    if (!data || data.length === 0) return { plotData, layout };

    if (activeViewMode === 'frequency') {
      const rawFFT = calculateFFT(data);
      if (rawFFT) plotData.push({ x: rawFFT.freqs, y: rawFFT.magnitudes, type: 'scatter', mode: 'lines', name: 'Raw', line: { color: 'rgba(200,200,200,0.8)', width: 1 } });
      if (filteredData) {
        const filtFFT = calculateFFT(filteredData);
        if (filtFFT) plotData.push({ x: filtFFT.freqs, y: filtFFT.magnitudes, type: 'scatter', mode: 'lines', name: 'Filtered', line: { color: '#2e7d32', width: 2 } });
      }
      layout.xaxis = { title: 'Freq Bin' }; layout.yaxis = { title: 'Magnitude' };
      return { plotData, layout };
    }

    // Default: Time domain
    plotData.push({ x: data.map(d => d.time), y: data.map(d => d.value), type: 'scatter', mode: 'lines', name: 'Raw', line: { color: 'rgba(200,200,200,0.8)', width: 1 } });
    if (filteredData) plotData.push({ x: filteredData.map(d => d.time), y: filteredData.map(d => d.value), type: 'scatter', mode: 'lines', name: 'Model A', line: { color: '#2e7d32', width: 2 } });
    if (filteredDataB) plotData.push({ x: filteredDataB.map(d => d.time), y: filteredDataB.map(d => d.value), type: 'scatter', mode: 'lines', name: 'Model B', line: { color: '#1565c0', width: 2 } });
    
    if (confidenceBands && filteredData) {
      plotData.push({ x: confidenceBands.map(b => b.time), y: confidenceBands.map(b => b.upper), type: 'scatter', mode: 'lines', name: 'Upper CI', line: { width: 0 }, showlegend: false });
      plotData.push({ x: confidenceBands.map(b => b.time), y: confidenceBands.map(b => b.lower), type: 'scatter', mode: 'lines', name: 'Lower CI', line: { width: 0 }, fill: 'tonexty', fillcolor: 'rgba(46,125,50,0.12)', showlegend: false });
    }

    return { plotData, layout };
  };

  // Determine what to render
  const isTableView = activeViewMode === 'datapreview' || activeViewMode === 'experiments';
  const { plotData, layout: plotLayout } = isTableView ? { plotData: [], layout: {} } : buildPlotData();

  // Dynamic view buttons
  const viewButtons = [{ id: 'time', label: 'Time' }, { id: 'frequency', label: 'FFT' }, { id: 'histogram', label: 'Dist' }];
  if (data) viewButtons.push({ id: 'datapreview', label: 'Data' });
  if (acfData) viewButtons.push({ id: 'acf', label: 'ACF' });
  if (trainingHistory) viewButtons.push({ id: 'training', label: 'Loss' });
  if (residuals) viewButtons.push({ id: 'residuals', label: 'Residuals' });
  if (correlationMatrix) viewButtons.push({ id: 'correlation', label: 'Corr' });
  if (pcaResults) viewButtons.push({ id: 'pca', label: 'PCA' });
  if (classificationResults) viewButtons.push({ id: 'classification', label: 'Confusion' });
  if (cvResults) viewButtons.push({ id: 'cv', label: 'CV' });
  viewButtons.push({ id: 'experiments', label: 'Runs' });

  const renderTable = () => {
    if (activeViewMode === 'datapreview' && data && data.length > 0) {
      const keys = Object.keys(data[0]).filter(k => !k.startsWith('_'));
      return (
        <div style={{ padding: '30px 10px 10px', overflowY: 'auto', overflowX: 'auto', height: '100%', fontSize: '11px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Consolas, monospace' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left', position: 'sticky', top: 0, background: '#fff' }}>
                <th style={{padding: '3px 6px', color: '#999'}}>#</th>
                {keys.map(k => <th key={k} style={{padding: '3px 6px'}}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 200).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: row.value === null ? '#fff3e0' : 'transparent' }}>
                  <td style={{padding: '2px 6px', color: '#999'}}>{idx}</td>
                  {keys.map(k => (
                    <td key={k} style={{padding: '2px 6px', color: row[k] === null ? '#d32f2f' : '#333'}}>
                      {row[k] === null ? 'null' : typeof row[k] === 'number' ? row[k].toFixed(4) : String(row[k] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 200 && <div style={{padding: '8px', color: '#999', textAlign: 'center'}}>Showing first 200 of {data.length} rows</div>}
        </div>
      );
    }

    if (activeViewMode === 'experiments') {
      return (
        <div style={{ padding: '30px 10px 10px', overflowY: 'auto', height: '100%', fontSize: '11px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                <th style={{padding: '4px'}}>Time</th><th style={{padding: '4px'}}>Pipeline</th>
                <th style={{padding: '4px'}}>RMSE</th><th style={{padding: '4px'}}>Max Err</th>
                <th style={{padding: '4px'}}>Latency</th><th style={{padding: '4px'}}>Norm</th>
                <th style={{padding: '4px'}}>Feat</th><th style={{padding: '4px'}}>Epochs</th>
              </tr>
            </thead>
            <tbody>
              {experiments && experiments.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{padding: '3px 4px'}}>{exp.timestamp}</td>
                  <td style={{padding: '3px 4px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{exp.pipeline}</td>
                  <td style={{padding: '3px 4px', fontWeight: 'bold'}}>{exp.rmse}</td>
                  <td style={{padding: '3px 4px'}}>{exp.maxError}</td>
                  <td style={{padding: '3px 4px'}}>{exp.latency}ms</td>
                  <td style={{padding: '3px 4px'}}>{exp.norm}</td>
                  <td style={{padding: '3px 4px'}}>{exp.features ? 'Yes' : '-'}</td>
                  <td style={{padding: '3px 4px'}}>{exp.epochs || '-'}</td>
                </tr>
              ))}
              {(!experiments || experiments.length === 0) && (
                <tr><td colSpan={8} style={{padding: '20px', textAlign: 'center', color: '#999'}}>No experiments yet. Run a pipeline.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pane-content telemetry-container">
      <div className="chart-area" style={{ position: 'relative' }}>
        {/* View toggle */}
        <div style={{ position: 'absolute', top: '5px', left: '5px', zIndex: 15, display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: '70%' }}>
          {!sweepResults && viewButtons.map(btn => (
            <button key={btn.id} onClick={() => changeViewMode(btn.id)}
              style={{ padding: '2px 5px', fontSize: '10px', cursor: 'pointer', background: activeViewMode === btn.id ? '#d0d0d0' : '#fff', border: '1px solid #bbb', borderRadius: '3px' }}>
              {btn.label}
            </button>
          ))}
        </div>

        {isTableView ? renderTable() : (
          <ErrorBoundary>
            {(data || sweepResults) && plotData.length > 0 ? (
              <Plot data={plotData} layout={plotLayout} useResizeHandler={true} style={{ width: '100%', height: '100%' }} />
            ) : (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999'}}>
                Load data to begin
              </div>
            )}
          </ErrorBoundary>
        )}
        
        {/* Metrics overlay */}
        {metrics && !sweepResults && activeViewMode === 'time' && (
          <div style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,255,255,0.95)', padding: '5px 7px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}>
            <div style={{fontWeight: 'bold', color: '#2e7d32', borderBottom: '1px solid #eee', paddingBottom: '2px', marginBottom: '2px'}}>A</div>
            <div>RMSE={metrics.rmse} Max={metrics.maxError} {metrics.latency}ms</div>
            {metricsB && (
              <>
                <div style={{fontWeight: 'bold', color: '#1565c0', borderBottom: '1px solid #eee', paddingBottom: '2px', marginTop: '3px', marginBottom: '2px'}}>B</div>
                <div>RMSE={metricsB.rmse} Max={metricsB.maxError} {metricsB.latency}ms</div>
              </>
            )}
          </div>
        )}

        {classificationResults && activeViewMode === 'classification' && (
          <div style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,255,255,0.95)', padding: '5px 7px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}>
            {classificationResults.classes.map(c => (
              <div key={c}><strong>{c}</strong>: P={classificationResults.metrics[c].precision} R={classificationResults.metrics[c].recall} F1={classificationResults.metrics[c].f1}</div>
            ))}
          </div>
        )}
      </div>

      <div className="shell-area">
        <div className="shell-header">Engine Log</div>
        {logs.map((log, idx) => (
          <div key={idx} className="shell-line">{log}</div>
        ))}
        <div className="shell-line shell-prompt">{">>> "}</div>
      </div>
    </div>
  );
}

export default TelemetryPane;
