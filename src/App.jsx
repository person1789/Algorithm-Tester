import { useState, useEffect, useRef } from 'react';
import MenuBar from './components/MenuBar';
import Toolbar from './components/Toolbar';
import EditorPane from './components/EditorPane';
import TelemetryPane from './components/TelemetryPane';
import SubsettingControls from './components/SubsettingControls';
import DataSplitControls from './components/DataSplitControls';
import SnippetLibrary from './components/SnippetLibrary';
import DatasetBuilder from './components/DatasetBuilder';
import ParameterControls from './components/ParameterControls';
import HeaderDocs from './components/HeaderDocs';
import RunNotebook from './components/RunNotebook';
import ExportPanel from './components/ExportPanel';
import './App.css';
import { generateSyntheticData, parseCSV, parseJSON } from './utils/dataParser';
import { engineerFeatures, computePCA, computeConfusionMatrix, crossValidateRolling, normalizeData, splitData, computeCorrelationMatrix, computeACF, computeResiduals, computeConfidenceBands } from './utils/mlUtils';
import Papa from 'papaparse';
import * as tf from '@tensorflow/tfjs';

const DEFAULT_PARAMS = {
  alpha: 0.2,
  windowSize: 5,
  Q: 0.1,
  R: 250,
  maxStep: 25,
  epochs: 40,
  learningRate: 0.01
};

const DEFAULT_BUILDER_ROWS = Array.from({ length: 8 }, (_, index) => ({
  time: index,
  value: index === 0 ? 0 : '',
  label: ''
}));

const PIPELINE_TEMPLATES = {
  noise: {
    name: 'Noise filter',
    steps: [
      {
        id: 1,
        name: 'Interpolate',
        code: `return data.map((row, index, array) => {
  if (row.value !== null && row.value !== undefined && !Number.isNaN(row.value)) return row;
  let left = index - 1;
  let right = index + 1;
  while (left >= 0 && array[left].value == null) left--;
  while (right < array.length && array[right].value == null) right++;
  const a = left >= 0 ? array[left].value : 0;
  const b = right < array.length ? array[right].value : a;
  const t = left >= 0 && right < array.length ? (index - left) / (right - left) : 0;
  return { ...row, value: a + (b - a) * t };
});`
      },
      {
        id: 2,
        name: 'EMA',
        code: `let previous = data[0]?.value ?? 0;
return data.map(row => {
  const raw = row.value ?? previous;
  const value = raw * params.alpha + previous * (1 - params.alpha);
  previous = value;
  return { ...row, value };
});`
      }
    ]
  },
  anomaly: {
    name: 'Anomaly detector',
    steps: [
      {
        id: 1,
        name: 'Score',
        code: `const windowSize = params.windowSize;
return data.map((row, index, array) => {
  const start = Math.max(0, index - windowSize + 1);
  const values = array.slice(start, index + 1).map(item => item.value ?? 0);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const std = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
  const z = Math.abs(((row.value ?? 0) - mean) / std);
  return { ...row, anomaly_score: z, class: z > 3 ? 'anomaly' : 'normal' };
});`
      }
    ]
  },
  regression: {
    name: 'TensorFlow regressor',
    steps: [
      {
        id: 1,
        name: 'Dense Regressor',
        code: `const xs = tf.tensor2d(trainData.map(row => [row.time]));
const ys = tf.tensor2d(trainData.map(row => [row.value ?? 0]));

const model = tf.sequential();
model.add(tf.layers.dense({ units: 16, inputShape: [1], activation: 'relu' }));
model.add(tf.layers.dense({ units: 1 }));
model.compile({
  optimizer: tf.train.adam(params.learningRate),
  loss: 'meanSquaredError'
});

await model.fit(xs, ys, {
  epochs: params.epochs,
  callbacks: { onEpochEnd: (epoch, logs) => onEpoch(epoch, logs) }
});

await modelStore.save('latest-regressor', model);

const allX = tf.tensor2d(data.map(row => [row.time]));
const predictions = model.predict(allX).arraySync();
xs.dispose(); ys.dispose(); allX.dispose(); model.dispose();

return data.map((row, index) => ({ ...row, value: predictions[index][0] }));`
      }
    ]
  },
  classifier: {
    name: 'Threshold classifier',
    steps: [
      {
        id: 1,
        name: 'Classify',
        code: `const values = data.map(row => row.value ?? 0);
const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

return data.map(row => ({
  ...row,
  class: (row.value ?? 0) > mean ? 'high' : 'low'
}));`
      }
    ]
  }
};

function App() {
  const menuFileInputRef = useRef(null);
  const menuBatchInputRef = useRef(null);
  const menuPipelineInputRef = useRef(null);
  const modelArtifactsRef = useRef(new Map());
  const [data, setData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [dataFields, setDataFields] = useState([]);

  // Pipeline A
  const [pipelineA, setPipelineA] = useState([
    {
      id: 1,
      name: 'Step 1',
      code: '// \'data\', \'tf\', \'onEpoch\', \'trainData\', \'valData\', \'testData\'\n\nreturn data.map(row => ({\n  ...row,\n  value: row.value * 0.8\n}));'
    }
  ]);

  // Pipeline B
  const [pipelineB, setPipelineB] = useState([
    { id: 1, name: 'Step 1', code: 'return data;' }
  ]);

  const [abMode, setAbMode] = useState(false);
  const [filteredDataB, setFilteredDataB] = useState(null);

  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [metricsB, setMetricsB] = useState(null);

  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  // Feature Engineering
  const [featureEngineering, setFeatureEngineering] = useState(false);
  const [feWindowSize, setFeWindowSize] = useState(5);

  // Normalization
  const [normMethod, setNormMethod] = useState('none');

  // Data splitting
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitConfig, setSplitConfig] = useState({ trainPct: 70, valPct: 15 });

  // Sweep
  const [sweepMode, setSweepMode] = useState(false);
  const [sweepConfig] = useState({ varName: 'P', start: 0.1, end: 1.0, steps: 10 });
  const [sweepResults, setSweepResults] = useState(null);

  // Cross-validation
  const [cvResults, setCvResults] = useState(null);

  // Classification
  const [classificationResults, setClassificationResults] = useState(null);

  // PCA
  const [pcaResults, setPcaResults] = useState(null);

  // Training history
  const [trainingHistory, setTrainingHistory] = useState(null);

  // Snippet library
  // Active pipeline tab (A or B)
  const [activePipeline, setActivePipeline] = useState('A');
  const [collapsedPanes, setCollapsedPanes] = useState({
    snippets: true,
    pipelineA: false,
    pipelineB: false,
    telemetry: false
  });
  const [activeTool, setActiveTool] = useState('docs');
  const [builderRows, setBuilderRows] = useState(DEFAULT_BUILDER_ROWS);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [telemetryView, setTelemetryView] = useState('time');
  const [noiseSummary, setNoiseSummary] = useState(null);

  // Column mapping
  const [targetColumn, setTargetColumn] = useState('value');

  // --- NEW: Analysis data ---
  const [residuals, setResiduals] = useState(null);
  const [correlationMatrix, setCorrelationMatrix] = useState(null);
  const [acfData, setAcfData] = useState(null);
  const [confidenceBands, setConfidenceBands] = useState(null);

  // --- NEW: Experiment Tracker ---
  const [experiments, setExperiments] = useState([]);

  const modelStore = {
    save: async (name, model) => {
      let savedArtifacts = null;
      await model.save(tf.io.withSaveHandler(async (artifacts) => {
        savedArtifacts = artifacts;
        return {
          modelArtifactsInfo: {
            dateSaved: new Date(),
            modelTopologyType: 'JSON',
            weightDataBytes: artifacts.weightData?.byteLength || 0
          }
        };
      }));
      modelArtifactsRef.current.set(name, savedArtifacts);
      addLog(`Saved model '${name}' in memory.`);
      return name;
    },
    load: async (name) => {
      const artifacts = modelArtifactsRef.current.get(name);
      if (!artifacts) throw new Error(`No saved model named '${name}'.`);
      return tf.loadLayersModel(tf.io.fromMemory(artifacts));
    },
    list: () => [...modelArtifactsRef.current.keys()]
  };

  const togglePane = (pane) => {
    setCollapsedPanes(prev => ({ ...prev, [pane]: !prev[pane] }));
  };

  const showTool = (tool, forceOpen = false) => {
    setActiveTool(tool);
    if (forceOpen || collapsedPanes.snippets) {
      setCollapsedPanes(prev => ({ ...prev, snippets: false }));
    }
  };

  // Log capacity increased
  const addLog = (msg) => {
    setLogs(prev => [...prev, msg].slice(-20));
  };

  const handleSnippetInsert = (code) => {
    if (activePipeline === 'A') {
      const updated = [...pipelineA];
      if (updated.length > 0) updated[updated.length - 1] = { ...updated[updated.length - 1], code };
      setPipelineA(updated);
    } else {
      const updated = [...pipelineB];
      if (updated.length > 0) updated[updated.length - 1] = { ...updated[updated.length - 1], code };
      setPipelineB(updated);
    }
    addLog(`Snippet inserted into Pipeline ${activePipeline}.`);
  };

  const handleDataLoad = (newData, message) => {
    try {
      const fields = newData._fields
        ? [...newData._fields]
        : (newData.length > 0 ? Object.keys(newData[0]) : []);
      if (newData._fields) delete newData._fields;

      setDataFields(fields);
      setData(newData);
      setStartIndex(0);
      setEndIndex(newData.length - 1);
      setFilteredData(null); setFilteredDataB(null);
      setMetrics(null); setMetricsB(null);
      setSweepResults(null); setCvResults(null);
      setClassificationResults(null); setPcaResults(null);
      setTrainingHistory(null);
      setResiduals(null); setCorrelationMatrix(null);
      setAcfData(null); setConfidenceBands(null); setNoiseSummary(null);
      addLog(message);

      // Auto-compute correlation matrix if multivariate
      if (newData.length > 0) {
        const numericFields = fields.filter(f => {
          if (f.startsWith('_')) return false;
          return typeof newData[0][f] === 'number';
        });
        if (numericFields.length >= 3) {
          const cm = computeCorrelationMatrix(newData, numericFields);
          if (cm) setCorrelationMatrix(cm);
        }
      }

      // Auto-compute ACF
      if (newData.length >= 4) {
        const acf = computeACF(newData);
        if (acf && acf.length > 0) setAcfData(acf);
      }
    } catch (e) {
      addLog(`Load error: ${e.message}`);
    }
  };

  const handleInjectAnomaly = (type) => {
    if (!data) return;
    const newData = [...data];
    const len = newData.length;
    if (type === 'spikes') {
      for (let i = 0; i < 5; i++) {
        const idx = Math.floor(Math.random() * len);
        newData[idx] = { ...newData[idx], value: (newData[idx].value || 0) + (Math.random() > 0.5 ? 200 : -200) };
      }
      addLog("Injected 5 spikes.");
    } else if (type === 'nans') {
      for (let i = 0; i < Math.floor(len * 0.05); i++) {
        const idx = Math.floor(Math.random() * len);
        newData[idx] = { ...newData[idx], value: null };
      }
      addLog("Dropped 5% (null).");
    }
    setData(newData);
    setFilteredData(null); setFilteredDataB(null);
  };

  const remapTarget = (dataset, col) => {
    if (col === 'value') return dataset;
    return dataset.map(d => ({ ...d, value: d[col] }));
  };

  const preprocessData = (rawData) => {
    let subset = rawData.slice(startIndex, endIndex + 1);
    subset = remapTarget(subset, targetColumn);
    subset = normalizeData(subset, normMethod);
    if (featureEngineering) subset = engineerFeatures(subset, feWindowSize);
    return subset;
  };

  const executePipeline = async (pipeline, inputData, splits, epochCallback) => {
    // Console capture: intercept console.log during execution
    const capturedLogs = [];
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = (...args) => { capturedLogs.push(args.map(String).join(' ')); origLog(...args); };
    console.warn = (...args) => { capturedLogs.push('[warn] ' + args.map(String).join(' ')); origWarn(...args); };

    try {
      let currentData = inputData;
      for (const step of pipeline) {
        const algorithm = new (Object.getPrototypeOf(async function () { }).constructor)(
          'data', 'tf', 'onEpoch', 'trainData', 'valData', 'testData', 'params', 'modelStore', step.code
        );
        currentData = await algorithm(
          currentData, tf, epochCallback,
          splits ? splits.train : inputData,
          splits ? splits.val : [],
          splits ? splits.test : [],
          params,
          modelStore
        );
        if (!Array.isArray(currentData)) {
          throw new Error(`Step '${step.name}' did not return an array.`);
        }
      }
      // Flush captured logs
      capturedLogs.forEach(msg => addLog(`[console] ${msg}`));
      return currentData;
    } finally {
      console.log = origLog;
      console.warn = origWarn;
    }
  };

  const calculateMetrics = (subset, output) => {
    let sumSq = 0, maxError = 0, count = 0;
    const len = Math.min(subset.length, output.length);
    for (let i = 0; i < len; i++) {
      const v1 = output[i].value ?? 0;
      const v2 = subset[i].value ?? 0;
      const err = Math.abs(v1 - v2);
      if (err > maxError) maxError = err;
      sumSq += err * err;
      count++;
    }
    const rmse = count > 0 ? Math.sqrt(sumSq / count) : 0;
    return { rmse: rmse.toFixed(3), maxError: maxError.toFixed(3) };
  };

  const summarizeResiduals = (res, metricValues) => {
    if (!res || res.length === 0) return null;
    const abs = res.map(row => Math.abs(row.residual));
    const avgAbs = abs.reduce((sum, value) => sum + value, 0) / abs.length;
    const sorted = [...abs].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const recommendation = p95 > avgAbs * 3
      ? 'Residual spikes detected. Try the anomaly clamp preset or reduce maxStep.'
      : Number(metricValues.rmse) > avgAbs * 1.6
        ? 'Output is still noisy. Increase windowSize or lower alpha.'
        : 'Residuals look stable for this run.';
    return {
      avgAbs: avgAbs.toFixed(3),
      p95: p95.toFixed(3),
      recommendation
    };
  };

  const handleRun = async () => {
    if (!data) { addLog("Error: No data loaded."); return; }
    if (pipelineA.length === 0) { addLog("Error: Pipeline A empty."); return; }

    const subset = preprocessData(data);

    let splits = null;
    if (splitEnabled) {
      splits = splitData(subset, splitConfig.trainPct, splitConfig.valPct);
      addLog(`Split: ${splits.train.length}/${splits.val.length}/${splits.test.length}`);
    }

    // Sweep
    if (sweepMode) {
      addLog(`Sweeping '${sweepConfig.varName}' [${sweepConfig.start} to ${sweepConfig.end}]...`);
      const results = [];
      const stepSize = (sweepConfig.end - sweepConfig.start) / sweepConfig.steps;
      try {
        for (let i = 0; i <= sweepConfig.steps; i++) {
          const val = sweepConfig.start + (stepSize * i);
          let currentData = subset;
          for (const step of pipelineA) {
            const algorithm = new Function('data', sweepConfig.varName, 'params', step.code);
            currentData = algorithm(currentData, val, params);
          }
          const m = calculateMetrics(subset, currentData);
          results.push({ sweepValue: parseFloat(val.toFixed(3)), rmse: parseFloat(m.rmse) });
        }
        setSweepResults(results);
        addLog(`Sweep: ${results.length} iterations.`);
      } catch (e) { addLog(`Sweep Error: ${e.message}`); }
      return;
    }

    // Normal / A/B
    setSweepResults(null); setCvResults(null);

    const history = [];
    const onEpoch = (epoch, epochLogs) => {
      history.push({ epoch, loss: epochLogs.loss, val_loss: epochLogs.val_loss });
    };

    try {
      addLog(`Running A [${startIndex}..${endIndex}]...`);
      const t0 = performance.now();
      const resultA = await executePipeline(pipelineA, subset, splits, onEpoch);
      const t1 = performance.now();
      const latency = (t1 - t0).toFixed(2);

      setFilteredData(resultA);
      setTrainingHistory(history.length > 0 ? history : null);

      const mA = calculateMetrics(subset, resultA);
      setMetrics({ ...mA, latency });
      addLog(`A: ${latency}ms, RMSE=${mA.rmse}`);

      // Residuals
      const res = computeResiduals(subset, resultA);
      setResiduals(res);
      const summary = summarizeResiduals(res, mA);
      setNoiseSummary(summary);
      if (summary) addLog(`Residuals: avg=${summary.avgAbs}, p95=${summary.p95}. ${summary.recommendation}`);

      // Confidence bands
      const bands = computeConfidenceBands(resultA);
      setConfidenceBands(bands);

      // Classification
      if (resultA.length > 0 && resultA[0].class !== undefined) {
        const actual = subset.map(d => d.class || 'unknown');
        const predicted = resultA.map(d => d.class);
        setClassificationResults(computeConfusionMatrix(actual, predicted));
      } else {
        setClassificationResults(null);
      }

      // PCA
      if (featureEngineering && resultA.length > 0) {
        const featureKeys = ['value', 'rolling_mean', 'rolling_variance', 'ema', 'diff'];
        const matrix = resultA.map(r => featureKeys.map(k => r[k] || 0));
        setPcaResults(computePCA(matrix));
      } else {
        setPcaResults(null);
      }

      // --- Experiment Tracker: log this run ---
      const experimentEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        pipeline: pipelineA.map(s => s.name).join(' -> '),
        rmse: mA.rmse,
        maxError: mA.maxError,
        latency,
        norm: normMethod,
        features: featureEngineering,
        epochs: history.length || 0,
        params: { ...params },
        residualP95: summary?.p95,
        recommendation: summary?.recommendation
      };
      setExperiments(prev => [experimentEntry, ...prev].slice(0, 50));

      // A/B
      if (abMode) {
        const historyB = [];
        const tB0 = performance.now();
        const resultB = await executePipeline(pipelineB, subset, splits, (e, l) => historyB.push({ epoch: e, loss: l.loss }));
        const tB1 = performance.now();
        setFilteredDataB(resultB);
        const mB = calculateMetrics(subset, resultB);
        setMetricsB({ ...mB, latency: (tB1 - tB0).toFixed(2) });
        addLog(`B: ${(tB1 - tB0).toFixed(2)}ms, RMSE=${mB.rmse}`);

        // Log B experiment
        setExperiments(prev => [{
          id: Date.now() + 1, timestamp: new Date().toLocaleTimeString(),
          pipeline: 'B: ' + pipelineB.map(s => s.name).join(' -> '),
          rmse: mB.rmse, maxError: mB.maxError, latency: (tB1 - tB0).toFixed(2),
          norm: normMethod, features: featureEngineering, epochs: historyB.length || 0
        }, ...prev].slice(0, 50));
      } else {
        setFilteredDataB(null); setMetricsB(null);
      }

    } catch (e) {
      addLog(`Error: ${e.message}`);
    }
  };

  const handleCrossValidate = () => {
    if (!data) { addLog("Error: No data."); return; }
    const subset = preprocessData(data);
    const combinedCode = pipelineA.map(s => s.code).join('\n');
    const results = crossValidateRolling(subset, combinedCode, 20);
    setCvResults(results);
    addLog(`CV: ${results.length} chunks.`);
  };

  const handleStop = () => {
    setFilteredData(null); setFilteredDataB(null);
    setMetrics(null); setMetricsB(null);
    setSweepResults(null); setCvResults(null);
    setClassificationResults(null); setPcaResults(null);
    setTrainingHistory(null);
    setResiduals(null); setConfidenceBands(null); setNoiseSummary(null);
    addLog("Stopped.");
  };

  const loadSynthetic = (type = 'sine') => {
    const synData = generateSyntheticData(256, type);
    handleDataLoad(synData, `Synthetic ${type} (256 pts).`);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      let parsed;
      if (file.name.endsWith('.csv')) parsed = await parseCSV(file);
      else if (file.name.endsWith('.json')) parsed = await parseJSON(file);
      else { addLog(`Unsupported: ${file.name}`); return; }
      handleDataLoad(parsed, `Loaded ${file.name} (${parsed.length} rows)`);
    } catch (e) { addLog(`Error: ${e.message}`); }
    event.target.value = null;
  };

  const handleBatchEval = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    addLog(`Batch: ${files.length} files...`);

    for (const file of files) {
      try {
        let parsed;
        if (file.name.endsWith('.csv')) parsed = await parseCSV(file);
        else if (file.name.endsWith('.json')) parsed = await parseJSON(file);
        else continue;
        if (parsed._fields) delete parsed._fields;
        let subset = remapTarget(parsed, targetColumn);
        subset = normalizeData(subset, normMethod);
        if (featureEngineering) subset = engineerFeatures(subset, feWindowSize);
        const result = await executePipeline(pipelineA, subset, null, () => { });
        const m = calculateMetrics(subset, result);
        addLog(`  ${file.name}: RMSE=${m.rmse}`);
      } catch (e) {
        addLog(`  ${file.name}: ERR ${e.message}`);
      }
    }
    event.target.value = null;
  };

  const handleSaveScripts = () => {
    const payload = { pipelineA, pipelineB, featureEngineering, feWindowSize, normMethod, splitConfig, splitEnabled, targetColumn, params };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pipeline_config.json'; a.click();
    URL.revokeObjectURL(url);
    addLog("Saved config.");
  };

  const handleExportCSV = () => {
    if (!filteredData) { addLog("No filtered data."); return; }
    const csv = Papa.unparse(filteredData.map((row) => {
      const { _ema: internalEma, ...rest } = row;
      void internalEma;
      return rest;
    }));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'filtered_output.csv'; a.click();
    URL.revokeObjectURL(url);
    addLog("Exported CSV.");
  };

  const downloadTextFile = (filename, contents, type = 'text/plain') => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAlgorithm = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      targetColumn,
      normMethod,
      featureEngineering,
      feWindowSize,
      splitEnabled,
      splitConfig,
      params,
      pipeline: pipelineA
    };
    const moduleText = `import * as tf from '@tensorflow/tfjs';

const config = ${JSON.stringify(payload, null, 2)};

function normalizeData(data, method) {
  if (method === 'none') return data;
  const values = data.map(row => row.value).filter(value => value !== null && value !== undefined);
  if (values.length === 0) return data;
  if (method === 'minmax') {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return data.map(row => ({ ...row, value: row.value == null ? row.value : (row.value - min) / range }));
  }
  if (method === 'zscore') {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
    return data.map(row => ({ ...row, value: row.value == null ? row.value : (row.value - mean) / std }));
  }
  if (method === 'log') return data.map(row => ({ ...row, value: row.value > 0 ? Math.log(row.value) : row.value }));
  return data;
}

function engineerFeatures(data, windowSize) {
  return data.map((row, index, array) => {
    const start = Math.max(0, index - windowSize + 1);
    const values = array.slice(start, index + 1).map(item => item.value).filter(value => value !== null && value !== undefined);
    const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length || 1);
    return { ...row, rolling_mean: mean, rolling_variance: variance };
  });
}

export async function runAlgorithm(inputRows, overrides = {}) {
  const params = { ...config.params, ...(overrides.params || {}) };
  const targetColumn = overrides.targetColumn || config.targetColumn;
  let data = inputRows.map((row, index) => ({
    time: row.time ?? index,
    ...row,
    value: targetColumn === 'value' ? row.value : row[targetColumn]
  }));
  data = normalizeData(data, config.normMethod);
  if (config.featureEngineering) data = engineerFeatures(data, config.feWindowSize);

  const modelStore = overrides.modelStore || { save: async () => null, load: async () => null, list: () => [] };
  const onEpoch = overrides.onEpoch || (() => {});
  const trainData = overrides.trainData || data;
  const valData = overrides.valData || [];
  const testData = overrides.testData || [];

  for (const step of config.pipeline) {
    const fn = new (Object.getPrototypeOf(async function () {}).constructor)(
      'data', 'tf', 'onEpoch', 'trainData', 'valData', 'testData', 'params', 'modelStore', step.code
    );
    data = await fn(data, tf, onEpoch, trainData, valData, testData, params, modelStore);
    if (!Array.isArray(data)) throw new Error(\`Step "\${step.name}" did not return an array.\`);
  }
  return data;
}

export { config };
`;
    downloadTextFile('algorithm_export.mjs', moduleText, 'text/javascript');
    addLog('Exported standalone algorithm module.');
  };

  const handleExportNotebook = () => {
    downloadTextFile('run_notebook.json', `${JSON.stringify(experiments, null, 2)}\n`, 'application/json');
    addLog('Exported run notebook.');
  };

  const handleUseBuilderDataset = (rows) => {
    handleDataLoad(rows, `Builder dataset (${rows.length} rows).`);
    setTelemetryView('datapreview');
  };

  const handleImportCurrentToBuilder = () => {
    if (!data || data.length === 0) return;
    setBuilderRows(data.slice(0, 200).map(row => ({ ...row })));
    showTool('dataset', true);
    addLog('Copied current data into builder.');
  };

  const handleNewDataset = () => {
    setBuilderRows(DEFAULT_BUILDER_ROWS);
    showTool('dataset', true);
  };

  const handleApplyTemplate = (templateName) => {
    const template = PIPELINE_TEMPLATES[templateName];
    if (!template) return;
    setPipelineA(template.steps);
    setActivePipeline('A');
    showTool('params', true);
    addLog(`Loaded ${template.name} template.`);
  };

  // Pipeline Import
  const handleLoadPipeline = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      if (config.pipelineA) setPipelineA(config.pipelineA);
      if (config.pipelineB) setPipelineB(config.pipelineB);
      if (config.featureEngineering !== undefined) setFeatureEngineering(config.featureEngineering);
      if (config.feWindowSize !== undefined) setFeWindowSize(config.feWindowSize);
      if (config.normMethod !== undefined) setNormMethod(config.normMethod);
      if (config.splitConfig !== undefined) setSplitConfig(config.splitConfig);
      if (config.splitEnabled !== undefined) setSplitEnabled(config.splitEnabled);
      if (config.targetColumn !== undefined) setTargetColumn(config.targetColumn);
      if (config.params !== undefined) setParams({ ...DEFAULT_PARAMS, ...config.params });
      addLog(`Loaded pipeline from ${file.name}`);
    } catch (e) {
      addLog(`Error loading pipeline: ${e.message}`);
    }
    event.target.value = null;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRun(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSaveScripts(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const menuCommands = {
    newDataset: handleNewDataset,
    loadData: () => menuFileInputRef.current?.click(),
    importConfig: () => menuPipelineInputRef.current?.click(),
    saveConfig: handleSaveScripts,
    exportCSV: handleExportCSV,
    exportAlgorithm: handleExportAlgorithm,
    showDataset: () => showTool('dataset', true),
    showParams: () => showTool('params', true),
    showSnippets: () => showTool('snippets', true),
    showNotebook: () => showTool('notebook', true),
    showDocs: () => showTool('docs', true),
    setTelemetryView,
    run: handleRun,
    stop: handleStop,
    crossValidate: handleCrossValidate,
    batchEvaluate: () => menuBatchInputRef.current?.click(),
    toggleSweep: () => setSweepMode(prev => !prev),
    applyTemplate: handleApplyTemplate,
    resetParams: () => setParams(DEFAULT_PARAMS)
  };

  const renderToolPanel = () => {
    if (activeTool === 'dataset') {
      return (
        <DatasetBuilder
          rows={builderRows}
          setRows={setBuilderRows}
          onUseDataset={handleUseBuilderDataset}
          onImportCurrent={handleImportCurrentToBuilder}
          currentDataSize={data ? data.length : 0}
        />
      );
    }
    if (activeTool === 'params') {
      return (
        <ParameterControls
          params={params}
          setParams={setParams}
          onReset={() => setParams(DEFAULT_PARAMS)}
        />
      );
    }
    if (activeTool === 'snippets') return <SnippetLibrary onInsert={handleSnippetInsert} />;
    if (activeTool === 'notebook') {
      return <RunNotebook experiments={experiments} onExport={handleExportNotebook} />;
    }
    if (activeTool === 'export') {
      return (
        <ExportPanel
          onExportConfig={handleSaveScripts}
          onExportCSV={handleExportCSV}
          onExportAlgorithm={handleExportAlgorithm}
          hasOutput={Boolean(filteredData)}
        />
      );
    }
    return <HeaderDocs />;
  };

  return (
    <div className="app-container">
      <input type="file" ref={menuFileInputRef} className="hidden-input" accept=".csv,.json" onChange={handleFileUpload} />
      <input type="file" ref={menuBatchInputRef} className="hidden-input" accept=".csv,.json" multiple onChange={handleBatchEval} />
      <input type="file" ref={menuPipelineInputRef} className="hidden-input" accept=".json" onChange={handleLoadPipeline} />
      <MenuBar commands={menuCommands} />
      <Toolbar
        onRun={handleRun}
        onStop={handleStop}
        onLoadSynthetic={loadSynthetic}
        onFileUpload={handleFileUpload}
        onSaveScripts={handleSaveScripts}
        onExportCSV={handleExportCSV}
        onInjectAnomaly={handleInjectAnomaly}
        sweepMode={sweepMode}
        setSweepMode={setSweepMode}
        abMode={abMode}
        setAbMode={setAbMode}
        featureEngineering={featureEngineering}
        setFeatureEngineering={setFeatureEngineering}
        feWindowSize={feWindowSize}
        setFeWindowSize={setFeWindowSize}
        onCrossValidate={handleCrossValidate}
        normMethod={normMethod}
        setNormMethod={setNormMethod}
        splitEnabled={splitEnabled}
        setSplitEnabled={setSplitEnabled}
        showSnippets={!collapsedPanes.snippets}
        setShowSnippets={() => togglePane('snippets')}
        onBatchEval={handleBatchEval}
        dataFields={dataFields}
        targetColumn={targetColumn}
        setTargetColumn={setTargetColumn}
        onLoadPipeline={handleLoadPipeline}
        onExportAlgorithm={handleExportAlgorithm}
        onShowTool={showTool}
        activeTool={activeTool}
        telemetryView={telemetryView}
        setTelemetryView={setTelemetryView}
        onApplyTemplate={handleApplyTemplate}
      />

      <SubsettingControls
        dataSize={data ? data.length : 0}
        startIndex={startIndex}
        endIndex={endIndex}
        onRangeChange={(start, end) => {
          setStartIndex(start);
          setEndIndex(end);
        }}
        columns={data && data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'time' && !k.startsWith('_')) : []}
        selectedColumn={targetColumn}
        onColumnChange={setTargetColumn}
      />

      {splitEnabled && (
        <DataSplitControls splitConfig={splitConfig} setSplitConfig={setSplitConfig} />
      )}

      <div className="workspace">
        <div className={`tool-drawer ${collapsedPanes.snippets ? 'collapsed' : ''}`}>
          <div className="pane-header">
            <button className="collapse-btn" onClick={() => togglePane('snippets')} title="Toggle tool panel">
              {collapsedPanes.snippets ? '>' : '<'}
            </button>
            {!collapsedPanes.snippets && <span className="pane-title">{activeTool === 'snippets' ? 'Snippets' : activeTool}</span>}
          </div>
          {!collapsedPanes.snippets && renderToolPanel()}
        </div>

        <div className="main-content">
          <div className={`pane editor-pane ${collapsedPanes.pipelineA ? 'collapsed' : ''}`}>
            <div className="pane-header">
              <button className="collapse-btn" onClick={() => togglePane('pipelineA')} title="Toggle Pipeline A">
                {collapsedPanes.pipelineA ? '>' : '<'}
              </button>
              {!collapsedPanes.pipelineA && (
                <>
                  <button
                    className={`tab ${activePipeline === 'A' ? 'active' : ''}`}
                    onClick={() => setActivePipeline('A')}
                  >
                    Pipeline A
                  </button>
                  <span className="pane-subtitle">{pipelineA.length} step{pipelineA.length === 1 ? '' : 's'}</span>
                </>
              )}
            </div>
            {!collapsedPanes.pipelineA && (
              <EditorPane pipeline={pipelineA} setPipeline={setPipelineA} />
            )}
          </div>

          {abMode && (
            <div className={`pane editor-pane ${collapsedPanes.pipelineB ? 'collapsed' : ''}`}>
              <div className="pane-header">
                <button className="collapse-btn" onClick={() => togglePane('pipelineB')} title="Toggle Pipeline B">
                  {collapsedPanes.pipelineB ? '>' : '<'}
                </button>
                {!collapsedPanes.pipelineB && (
                  <>
                    <button
                      className={`tab ${activePipeline === 'B' ? 'active' : ''}`}
                      onClick={() => setActivePipeline('B')}
                    >
                      Pipeline B
                    </button>
                    <span className="pane-subtitle">{pipelineB.length} step{pipelineB.length === 1 ? '' : 's'}</span>
                  </>
                )}
              </div>
              {!collapsedPanes.pipelineB && (
                <EditorPane pipeline={pipelineB} setPipeline={setPipelineB} />
              )}
            </div>
          )}

          <div className={`pane telemetry-pane ${collapsedPanes.telemetry ? 'collapsed' : ''}`}>
            <div className="pane-header">
              <button className="collapse-btn" onClick={() => togglePane('telemetry')} title="Toggle telemetry">
                {collapsedPanes.telemetry ? '<' : '>'}
              </button>
              {!collapsedPanes.telemetry && (
                <>
                  <span className="tab active">Telemetry</span>
                  <span className="pane-subtitle">{logs.length} log line{logs.length === 1 ? '' : 's'}</span>
                </>
              )}
            </div>
            {!collapsedPanes.telemetry && (
              <TelemetryPane
                data={data ? data.slice(startIndex, endIndex + 1 || data.length) : []}
                filteredData={filteredData}
                filteredDataB={filteredDataB}
                metrics={metrics}
                metricsB={metricsB}
                logs={logs}
                experiments={experiments}
                confidenceBands={confidenceBands}
                sweepResults={sweepResults}
                cvResults={cvResults}
                classificationResults={classificationResults}
                pcaResults={pcaResults}
                trainingHistory={trainingHistory}
                residuals={residuals}
                correlationMatrix={correlationMatrix}
                acfData={acfData}
                viewMode={telemetryView}
                setViewMode={setTelemetryView}
              />
            )}
          </div>
        </div>
      </div>

      <div className="status-bar">
        <div>{data ? 'Ready' : 'No data loaded'} | Algorithm Tester{noiseSummary ? ` | ${noiseSummary.recommendation}` : ''}</div>
        <div>
          {data ? data.length : 0} records | Features: {data && data[0] ? Object.keys(data[0]).length : 0} | TF Backend: {tf.getBackend()}
        </div>
      </div>
    </div>
  );
}

export default App;
