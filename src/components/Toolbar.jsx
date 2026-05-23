import { useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Download,
  FileDown,
  FolderInput,
  FolderOpen,
  GitCompare,
  PanelLeft,
  Play,
  Save,
  SlidersHorizontal,
  Square,
  Table,
  Upload,
  Wand2,
  Zap
} from 'lucide-react';

function Toolbar({
  onRun,
  onStop,
  onLoadSynthetic,
  onFileUpload,
  onSaveScripts,
  onExportCSV,
  onExportAlgorithm,
  onInjectAnomaly,
  sweepMode,
  setSweepMode,
  abMode,
  setAbMode,
  featureEngineering,
  setFeatureEngineering,
  feWindowSize,
  setFeWindowSize,
  onCrossValidate,
  normMethod,
  setNormMethod,
  splitEnabled,
  setSplitEnabled,
  onBatchEval,
  dataFields,
  targetColumn,
  setTargetColumn,
  onLoadPipeline,
  onShowTool,
  activeTool,
  telemetryView,
  setTelemetryView,
  onApplyTemplate
}) {
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const pipelineInputRef = useRef(null);
  const [synType, setSynType] = useState('sine');
  const [anomalyType, setAnomalyType] = useState('spikes');
  const [preset, setPreset] = useState('noise');

  const toolButton = (tool, label, Icon) => (
    <button
      className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => onShowTool(tool)}
      title={`Show ${label}`}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" title="Build a dataset in a table" onClick={() => onShowTool('dataset', true)}>
          <Table size={15} /> New Data
        </button>
        <button className="toolbar-btn" title="Import CSV/JSON data" onClick={() => fileInputRef.current?.click()}>
          <FolderOpen size={15} /> Load
        </button>
        <button className="toolbar-btn" title="Load pipeline_config.json" onClick={() => pipelineInputRef.current?.click()}>
          <Upload size={15} /> Import
        </button>
        <button className="toolbar-btn" title="Save pipeline_config.json" onClick={onSaveScripts}>
          <Save size={15} /> Save
        </button>
        <button className="toolbar-btn" title="Export filtered output CSV" onClick={onExportCSV}>
          <FileDown size={15} /> CSV
        </button>
        <button className="toolbar-btn" title="Export standalone algorithm module" onClick={onExportAlgorithm}>
          <Download size={15} /> Export
        </button>
        <input type="file" ref={fileInputRef} className="hidden-input" accept=".csv,.json" onChange={onFileUpload} />
        <input type="file" ref={batchInputRef} className="hidden-input" accept=".csv,.json" multiple onChange={onBatchEval} />
        <input type="file" ref={pipelineInputRef} className="hidden-input" accept=".json" onChange={onLoadPipeline} />
      </div>

      <div className="toolbar-group">
        <select value={synType} onChange={event => setSynType(event.target.value)} title="Synthetic dataset type">
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="random_walk">Walk</option>
          <option value="complex">Complex</option>
          <option value="chirp">Chirp</option>
        </select>
        <button className="toolbar-btn" onClick={() => onLoadSynthetic(synType)} title="Generate synthetic data">
          <Activity size={15} /> Gen
        </button>
        <select value={anomalyType} onChange={event => setAnomalyType(event.target.value)} title="Anomaly type">
          <option value="spikes">Spikes</option>
          <option value="nans">NaNs</option>
        </select>
        <button className="toolbar-btn" onClick={() => onInjectAnomaly(anomalyType)} title="Inject anomaly into current data">
          <Zap size={15} /> Inject
        </button>
      </div>

      <div className="toolbar-group">
        <select value={preset} onChange={event => setPreset(event.target.value)} title="Project template">
          <option value="noise">Noise filter</option>
          <option value="anomaly">Anomaly detector</option>
          <option value="regression">Regressor</option>
          <option value="classifier">Classifier</option>
        </select>
        <button className="toolbar-btn" onClick={() => onApplyTemplate(preset)} title="Load selected starter template">
          <Wand2 size={15} /> Preset
        </button>
      </div>

      <div className="toolbar-group">
        <label className="toolbar-check" title="Add rolling features before the pipeline">
          <input type="checkbox" checked={featureEngineering} onChange={event => setFeatureEngineering(event.target.checked)} />
          <Brain size={13} /> Feat
        </label>
        {featureEngineering && (
          <input type="number" value={feWindowSize} min={2} max={50} onChange={event => setFeWindowSize(parseInt(event.target.value))} title="Feature window" />
        )}
        <select value={normMethod} onChange={event => setNormMethod(event.target.value)} title="Normalization">
          <option value="none">No Norm</option>
          <option value="minmax">Min-Max</option>
          <option value="zscore">Z-Score</option>
          <option value="log">Log</option>
        </select>
        {dataFields.length > 0 && (
          <select value={targetColumn} onChange={event => setTargetColumn(event.target.value)} title="Target column mapped to value">
            {dataFields.filter(field => field !== 'time' && !field.startsWith('_')).map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        )}
      </div>

      <div className="toolbar-group">
        <label className="toolbar-check" title="Enable train/validation/test split">
          <input type="checkbox" checked={splitEnabled} onChange={event => setSplitEnabled(event.target.checked)} />
          Split
        </label>
        <label className="toolbar-check" title="Enable Pipeline B comparison">
          <input type="checkbox" checked={abMode} onChange={event => setAbMode(event.target.checked)} />
          <GitCompare size={13} /> A/B
        </label>
        <label className="toolbar-check" title="Enable sweep mode">
          <input type="checkbox" checked={sweepMode} onChange={event => setSweepMode(event.target.checked)} />
          Sweep
        </label>
      </div>

      <div className="toolbar-group">
        {toolButton('dataset', 'Builder', Table)}
        {toolButton('params', 'Params', SlidersHorizontal)}
        {toolButton('snippets', 'Snippets', BookOpen)}
        {toolButton('notebook', 'Notebook', PanelLeft)}
        {toolButton('docs', 'Docs', BookOpen)}
      </div>

      <div className="toolbar-group">
        <select value={telemetryView} onChange={event => setTelemetryView(event.target.value)} title="Telemetry view">
          <option value="time">Time</option>
          <option value="frequency">FFT</option>
          <option value="histogram">Dist</option>
          <option value="datapreview">Data</option>
          <option value="experiments">Runs</option>
          <option value="acf">ACF</option>
          <option value="residuals">Residuals</option>
          <option value="correlation">Corr</option>
          <option value="training">Loss</option>
          <option value="cv">CV</option>
        </select>
      </div>

      <div className="toolbar-group execution-group">
        <button className="toolbar-btn" title="Batch evaluate multiple files" onClick={() => batchInputRef.current?.click()}>
          <FolderInput size={15} /> Batch
        </button>
        <button className="toolbar-btn" title="Cross-validation" onClick={onCrossValidate}>
          <BarChart3 size={15} /> CV
        </button>
        <button className="toolbar-btn run" onClick={onRun} title="Run pipeline">
          <Play size={15} /> Run
        </button>
        <button className="toolbar-btn stop" onClick={onStop} title="Clear outputs">
          <Square size={15} /> Stop
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
