/**
 * Feature Engineering Module
 * Automatically enriches raw time-series data with rolling statistics.
 */

export function engineerFeatures(data, windowSize = 5) {
  return data.map((row, index, array) => {
    const start = Math.max(0, index - windowSize + 1);
    const windowSlice = array.slice(start, index + 1).map(r => r.value).filter(v => v !== null && v !== undefined);
    
    const n = windowSlice.length;
    if (n === 0) return { ...row };

    // Rolling Mean
    const mean = windowSlice.reduce((a, b) => a + b, 0) / n;

    // Rolling Variance
    const variance = windowSlice.reduce((a, v) => a + (v - mean) ** 2, 0) / n;

    // Rolling Min / Max
    const min = Math.min(...windowSlice);
    const max = Math.max(...windowSlice);

    // Rolling Skewness
    const stdDev = Math.sqrt(variance) || 1;
    const skewness = windowSlice.reduce((a, v) => a + ((v - mean) / stdDev) ** 3, 0) / n;

    // First-order Difference
    const diff = index > 0 && array[index - 1].value !== null 
      ? (row.value || 0) - (array[index - 1].value || 0) 
      : 0;

    // EMA (alpha = 2 / (window+1))
    let ema = row.value || 0;
    if (index > 0) {
      const alpha = 2 / (windowSize + 1);
      const prevEma = array[index - 1]._ema || array[index - 1].value || 0;
      ema = (row.value || 0) * alpha + prevEma * (1 - alpha);
    }

    const enriched = {
      ...row,
      rolling_mean: parseFloat(mean.toFixed(4)),
      rolling_variance: parseFloat(variance.toFixed(4)),
      rolling_min: parseFloat(min.toFixed(4)),
      rolling_max: parseFloat(max.toFixed(4)),
      rolling_skewness: parseFloat(skewness.toFixed(4)),
      diff: parseFloat(diff.toFixed(4)),
      ema: parseFloat(ema.toFixed(4)),
      _ema: ema // internal, not displayed
    };

    return enriched;
  });
}

/**
 * Simple PCA implementation for 2D projection.
 * Takes an array of feature vectors (arrays of numbers) and returns 2D projected points.
 */
export function computePCA(featureMatrix) {
  if (!featureMatrix || featureMatrix.length < 2 || featureMatrix[0].length < 2) return null;

  const n = featureMatrix.length;
  const dims = featureMatrix[0].length;

  // 1. Center the data (subtract mean of each column)
  const means = Array(dims).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dims; d++) {
      means[d] += featureMatrix[i][d];
    }
  }
  for (let d = 0; d < dims; d++) means[d] /= n;

  const centered = featureMatrix.map(row => row.map((v, d) => v - means[d]));

  // 2. Compute covariance matrix
  const cov = Array(dims).fill(null).map(() => Array(dims).fill(0));
  for (let i = 0; i < dims; i++) {
    for (let j = 0; j < dims; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j];
      }
      cov[i][j] = sum / (n - 1);
    }
  }

  // 3. Power iteration to find top 2 eigenvectors (simple approach)
  function powerIteration(matrix, numIter = 100) {
    const size = matrix.length;
    let vec = Array(size).fill(0).map(() => Math.random());
    for (let iter = 0; iter < numIter; iter++) {
      const newVec = Array(size).fill(0);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          newVec[i] += matrix[i][j] * vec[j];
        }
      }
      const norm = Math.sqrt(newVec.reduce((a, v) => a + v * v, 0));
      vec = newVec.map(v => v / norm);
    }
    return vec;
  }

  const pc1 = powerIteration(cov);

  // Deflate covariance matrix to find second component
  const eigenvalue1 = pc1.reduce((s, _, i) => s + pc1.reduce((ss, _, j) => ss + cov[i][j] * pc1[j], 0) * pc1[i], 0);
  const deflated = cov.map((row, i) => row.map((v, j) => v - eigenvalue1 * pc1[i] * pc1[j]));
  const pc2 = powerIteration(deflated);

  // 4. Project data onto PC1, PC2
  const projected = centered.map(row => ({
    pc1: row.reduce((s, v, d) => s + v * pc1[d], 0),
    pc2: row.reduce((s, v, d) => s + v * pc2[d], 0)
  }));

  return projected;
}

/**
 * Confusion Matrix calculation for classification outputs.
 */
export function computeConfusionMatrix(actual, predicted) {
  const classes = [...new Set([...actual, ...predicted])].sort();
  const matrix = {};
  const counts = {};

  classes.forEach(c => {
    matrix[c] = {};
    classes.forEach(c2 => matrix[c][c2] = 0);
    counts[c] = { tp: 0, fp: 0, fn: 0, tn: 0 };
  });

  for (let i = 0; i < actual.length; i++) {
    matrix[actual[i]][predicted[i]]++;
  }

  // Calculate per-class metrics
  classes.forEach(c => {
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] === c && predicted[i] === c) counts[c].tp++;
      else if (actual[i] !== c && predicted[i] === c) counts[c].fp++;
      else if (actual[i] === c && predicted[i] !== c) counts[c].fn++;
      else counts[c].tn++;
    }
  });

  const metrics = {};
  classes.forEach(c => {
    const { tp, fp, fn } = counts[c];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    metrics[c] = { precision: precision.toFixed(3), recall: recall.toFixed(3), f1: f1.toFixed(3) };
  });

  return { classes, matrix, metrics };
}

/**
 * Cross-validation with rolling window backtesting.
 * Runs the pipeline on chunks of data and returns rolling RMSE over time.
 */
export function crossValidateRolling(data, pipelineCode, chunkSize = 20) {
  const results = [];
  const totalChunks = Math.floor(data.length / chunkSize);

  for (let c = 0; c < totalChunks; c++) {
    const start = c * chunkSize;
    const end = start + chunkSize;
    const chunk = data.slice(start, end);

    try {
      const algorithm = new Function('data', pipelineCode);
      const output = algorithm(chunk);

      if (Array.isArray(output) && output.length > 0) {
        let sumSq = 0;
        const len = Math.min(chunk.length, output.length);
        for (let i = 0; i < len; i++) {
          const err = (output[i].value || 0) - (chunk[i].value || 0);
          sumSq += err * err;
        }
        results.push({ chunkIndex: c, startTime: chunk[0].time, rmse: Math.sqrt(sumSq / len) });
      }
    } catch (e) {
      results.push({ chunkIndex: c, startTime: chunk[0]?.time || c, rmse: null, error: e.message });
    }
  }

  return results;
}

/**
 * Normalize data values using the specified method.
 */
export function normalizeData(data, method = 'none') {
  if (method === 'none' || !data || data.length === 0) return data;

  const values = data.map(d => d.value).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return data;

  if (method === 'minmax') {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return data.map(d => ({
      ...d,
      value: d.value !== null && d.value !== undefined ? (d.value - min) / range : d.value
    }));
  }

  if (method === 'zscore') {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length) || 1;
    return data.map(d => ({
      ...d,
      value: d.value !== null && d.value !== undefined ? (d.value - mean) / std : d.value
    }));
  }

  if (method === 'log') {
    return data.map(d => ({
      ...d,
      value: d.value !== null && d.value !== undefined && d.value > 0 ? Math.log(d.value) : d.value
    }));
  }

  return data;
}

/**
 * Split data into train/validation/test sets.
 */
export function splitData(data, trainPct, valPct) {
  const n = data.length;
  const trainEnd = Math.floor(n * trainPct / 100);
  const valEnd = Math.floor(n * (trainPct + valPct) / 100);
  return {
    train: data.slice(0, trainEnd),
    val: data.slice(trainEnd, valEnd),
    test: data.slice(valEnd)
  };
}

/**
 * Compute Pearson correlation matrix for multivariate data.
 * @param {Array} data - Array of objects
 * @param {Array} fields - Column names to include
 * @returns {{ fields, matrix }} correlation matrix
 */
export function computeCorrelationMatrix(data, fields) {
  if (!data || data.length < 3 || !fields || fields.length < 2) return null;

  const n = data.length;
  const cols = fields.map(f => data.map(d => {
    const v = d[f];
    return v !== null && v !== undefined && !isNaN(v) ? v : 0;
  }));

  const means = cols.map(c => c.reduce((a, b) => a + b, 0) / n);
  const stds = cols.map((c, i) => {
    const s = Math.sqrt(c.reduce((a, v) => a + (v - means[i]) ** 2, 0) / n);
    return s || 1;
  });

  const matrix = [];
  for (let i = 0; i < fields.length; i++) {
    const row = [];
    for (let j = 0; j < fields.length; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (cols[i][k] - means[i]) * (cols[j][k] - means[j]);
      }
      row.push(parseFloat((sum / (n * stds[i] * stds[j])).toFixed(3)));
    }
    matrix.push(row);
  }

  return { fields, matrix };
}

/**
 * Compute autocorrelation function (ACF) for a time series.
 * @param {Array} data - Array of objects with .value
 * @param {number} maxLag - Maximum lag to compute
 * @returns {Array} [{lag, acf}]
 */
export function computeACF(data, maxLag = 40) {
  const values = data.map(d => d.value ?? 0);
  const n = values.length;
  if (n < 4) return [];

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  if (variance === 0) return [];

  const lags = Math.min(maxLag, Math.floor(n / 2));
  const result = [];

  for (let lag = 0; lag <= lags; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += (values[i] - mean) * (values[i + lag] - mean);
    }
    result.push({ lag, acf: parseFloat((sum / (n * variance)).toFixed(4)) });
  }

  return result;
}

/**
 * Compute residuals between raw and filtered data.
 */
export function computeResiduals(raw, filtered) {
  if (!raw || !filtered) return null;
  const len = Math.min(raw.length, filtered.length);
  const residuals = [];
  for (let i = 0; i < len; i++) {
    const actual = raw[i].value ?? 0;
    const predicted = filtered[i].value ?? 0;
    residuals.push({
      time: raw[i].time,
      residual: predicted - actual,
      predicted
    });
  }
  return residuals;
}

/**
 * Compute confidence intervals (mean ± stddev) using a rolling window.
 */
export function computeConfidenceBands(filtered, windowSize = 10) {
  if (!filtered || filtered.length < windowSize) return null;
  
  return filtered.map((row, i, arr) => {
    const start = Math.max(0, i - windowSize + 1);
    const win = arr.slice(start, i + 1).map(d => d.value ?? 0);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    const std = Math.sqrt(win.reduce((a, v) => a + (v - mean) ** 2, 0) / win.length);
    return {
      time: row.time,
      upper: mean + std,
      lower: mean - std
    };
  });
}

