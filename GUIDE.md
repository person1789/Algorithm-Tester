# Algorithm Tester Guide

Algorithm Tester is a light IDE for experimenting with time-series algorithms, noise filters, and small machine-learning models. The app lets you load or generate data, write a pipeline in JavaScript, inspect the output visually, compare A/B versions, and export the same pipeline to run outside the tester.

## 1. The Basic Workflow

1. Load data with **Load**, or create a sample signal with **Gen**.
2. Choose the target column. The tester maps that column to `row.value`.
3. Write code in Pipeline A. Each step receives the output of the previous step.
4. Click **Run**. The telemetry pane plots raw data against your pipeline output.
5. Use **A/B** to compare Pipeline A against Pipeline B.
6. Use **Save** to export `pipeline_config.json`.
7. Run that config outside the UI with `npm run run:pipeline`.

The header is the command center. Every visible File, View, Run, and Tools command performs an action; the **Docs** tool panel in the app lists the same commands while you work.

## 2. What Language Do Algorithms Use?

Pipeline code is plain JavaScript. Each step is executed as an async function body, so you can use:

- Normal JavaScript syntax: `const`, `let`, arrays, objects, `map`, `reduce`, loops, helper functions.
- `await` for TensorFlow.js training or async work.
- `console.log(...)`; messages appear in the Engine Log.
- TensorFlow.js through the provided `tf` variable.

Each step runs with these variables available:

```js
data       // array of rows entering this step
tf         // TensorFlow.js namespace
onEpoch    // callback for model.fit training logs
trainData  // training split when Split is enabled, otherwise full input
valData    // validation split when Split is enabled, otherwise []
testData   // test split when Split is enabled, otherwise []
params     // tunable values controlled from the Params panel
modelStore // in-memory TensorFlow.js model save/load helper
```

Every step must return an array:

```js
return data.map(row => ({
  ...row,
  value: row.value * 0.8
}));
```

Keep `time` and other fields by spreading `...row`. The chart reads `row.time` and `row.value`.

## 3. Header Buttons

### File

- **New Data** opens the Dataset Builder with a blank table.
- **Load** imports CSV or JSON.
- **Import** loads a saved `pipeline_config.json`.
- **Save** downloads the current pipeline config.
- **CSV** downloads the latest filtered output.
- **Export** downloads a standalone `.mjs` algorithm module.

### View

- **Builder** opens the Dataset Builder.
- **Params** opens slider/input controls for `params`.
- **Snippets** opens reusable algorithm examples.
- **Notebook** opens experiment history.
- **Docs** opens the button reference.
- The telemetry dropdown chooses Time, FFT, Distribution, Data table, Run history, ACF, Residuals, Correlation, Loss, or CV.

### Run

- **Run** executes Pipeline A and Pipeline B if A/B is enabled.
- **Stop** clears outputs and metrics.
- **CV** runs rolling cross-validation.
- **Batch** runs Pipeline A across multiple files.
- **Sweep** toggles sweep mode.

### Tools

- **Preset** loads one of four starter projects: noise filter, anomaly detector, regressor, or classifier.
- **Feat** adds rolling features before your pipeline.
- **Split** enables train/validation/test split controls.
- **A/B** shows Pipeline B for comparison.
- **Target** chooses which input column is copied to `value`.

## 4. Data Shape

The tester expects rows like this:

```js
[
  { time: 0, value: 48.23 },
  { time: 1, value: 51.05 },
  { time: 2, value: 49.88 }
]
```

CSV files should have headers. A `time` column is useful but optional. If you select another target column, such as `gyro_z`, the tester copies it into `value` before running your pipeline.

## 5. Building Datasets In The App

Open **New Data** or **Builder** to create a dataset as a table.

- Edit cells directly.
- Rename columns in the header row.
- Add/remove rows and columns.
- Click **Use** to load the table as the active dataset.
- Click **Current** to copy the current loaded data into the builder.

Use `time` and `value` for the simplest datasets. Add columns like `label`, `sensor_a`, or `temperature` when building classifier or multivariate examples.

## 6. Parameters

Open **Params** to tune algorithm values without editing code. Pipeline code reads them from `params`:

```js
const alpha = params.alpha;
const windowSize = params.windowSize;
const Q = params.Q;
const R = params.R;
```

Available defaults:

- `params.alpha`
- `params.windowSize`
- `params.Q`
- `params.R`
- `params.maxStep`
- `params.epochs`
- `params.learningRate`

Saved configs include parameter values, and the external runner passes the same `params` object.

## 7. Preset Projects

The **Preset** dropdown creates working starter pipelines:

- **Noise filter**: missing-value interpolation plus EMA smoothing.
- **Anomaly detector**: rolling z-score and `class` labels.
- **Regressor**: TensorFlow.js dense model that predicts `value` from `time`.
- **Classifier**: simple high/low threshold classifier.

Presets are meant to be edited. Load one, run it, tune Params, then save or export.

## 8. Noise Filtering Recipes

### Simple Moving Average

Good first pass for noisy sensors.

```js
const windowSize = params.windowSize;

return data.map((row, index, array) => {
  const start = Math.max(0, index - windowSize + 1);
  const window = array.slice(start, index + 1);
  const avg = window.reduce((sum, item) => sum + (item.value ?? 0), 0) / window.length;
  return { ...row, value: avg };
});
```

### Exponential Moving Average

Smoother than raw data, but faster to respond than a simple moving average.

```js
const alpha = params.alpha;
let previous = data[0]?.value ?? 0;

return data.map(row => {
  const value = (row.value ?? previous) * alpha + previous * (1 - alpha);
  previous = value;
  return { ...row, value };
});
```

### Spike Clamper

Useful when sensors occasionally jump far outside the local trend.

```js
const maxStep = params.maxStep;
let previous = data[0]?.value ?? 0;

return data.map(row => {
  const raw = row.value ?? previous;
  const delta = Math.max(-maxStep, Math.min(maxStep, raw - previous));
  const value = previous + delta;
  previous = value;
  return { ...row, value };
});
```

### Missing-Value Interpolator

Use before heavier filters if your data has blanks, `null`, or `NaN`.

```js
return data.map((row, index, array) => {
  if (row.value !== null && row.value !== undefined && !Number.isNaN(row.value)) return row;

  let left = index - 1;
  let right = index + 1;
  while (left >= 0 && array[left].value == null) left--;
  while (right < array.length && array[right].value == null) right++;

  const a = left >= 0 ? array[left].value : 0;
  const b = right < array.length ? array[right].value : a;
  const t = left >= 0 && right < array.length ? (index - left) / (right - left) : 0;

  return { ...row, value: a + (b - a) * t };
});
```

### 1D Kalman Filter

Good for filtering noisy one-dimensional sensor readings when you can tune the noise values.

```js
const Q = params.Q;   // process noise: higher follows changes faster
const R = params.R;   // measurement noise: higher trusts sensor less

let estimate = data[0]?.value ?? 0;
let P = 1;

return data.map(row => {
  const measurement = row.value ?? estimate;

  const predictedP = P + Q;
  const K = predictedP / (predictedP + R);

  estimate = estimate + K * (measurement - estimate);
  P = (1 - K) * predictedP;

  return { ...row, value: estimate };
});
```

## 9. Residual Inspector

After a run, the tester computes residuals between raw and filtered output.

- Open telemetry **Residuals** to inspect error over time.
- The status bar and Engine Log show a short recommendation.
- High residual spikes usually mean you should clamp spikes or increase `R`.
- Persistent noisy residuals usually mean you should lower `alpha` or increase `windowSize`.

## 10. Estimating Noise

If the first part of a dataset is a calibration period, estimate variance and use it as Kalman `R`:

```js
const calibration = data.slice(0, 40).map(row => row.value ?? 0);
const mean = calibration.reduce((sum, value) => sum + value, 0) / calibration.length;
const variance = calibration.reduce((sum, value) => sum + (value - mean) ** 2, 0) / calibration.length;

console.log('Estimated R:', variance);
return data;
```

## 11. Building ML Models

The tester supports TensorFlow.js through `tf`. Model steps can be async and should return predictions in the same row format.

```js
const xs = tf.tensor2d(trainData.map(row => [row.time]));
const ys = tf.tensor2d(trainData.map(row => [row.value ?? 0]));

const model = tf.sequential();
model.add(tf.layers.dense({ units: 16, inputShape: [1], activation: 'relu' }));
model.add(tf.layers.dense({ units: 1 }));
model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

await model.fit(xs, ys, {
  epochs: params.epochs,
  callbacks: {
    onEpochEnd: (epoch, logs) => onEpoch(epoch, logs)
  }
});

await modelStore.save('latest-regressor', model);

const allX = tf.tensor2d(data.map(row => [row.time]));
const predictions = model.predict(allX).arraySync();

xs.dispose();
ys.dispose();
allX.dispose();
model.dispose();

return data.map((row, index) => ({
  ...row,
  value: predictions[index][0]
}));
```

Use **Split** when training models. `trainData`, `valData`, and `testData` then contain the selected percentages.

### Model Save/Load

The tester injects an in-memory `modelStore` for TensorFlow.js models:

```js
await modelStore.save('main', model);
const model = await modelStore.load('main');
console.log(modelStore.list());
```

This is for the current app session. For permanent use, export the algorithm or save the pipeline config and retrain/run it outside the tester.

## 12. A/B Testing

Turn on **A/B** when you want to compare two algorithm versions:

- Pipeline A might be a simple moving average.
- Pipeline B might be an EMA or Kalman filter.
- The chart overlays both outputs.
- Metrics show RMSE, max error, and latency for each pipeline.

## 13. Run Notebook

Open **Notebook** to see experiment history:

- Pipeline name
- Time
- RMSE
- Max error
- Latency
- Normalization
- Feature-engineering state
- Parameter snapshot
- Residual recommendation

Use **Export JSON** to save run history.

## 14. Exporting Algorithms

Use **Export** to download a standalone `.mjs` module. The exported module contains:

- Pipeline A code
- Parameter values
- Target column
- Normalization settings
- Feature-engineering settings
- A `runAlgorithm(inputRows, overrides)` function

Example use:

```js
import { runAlgorithm } from './algorithm_export.mjs';

const filtered = await runAlgorithm(rows, {
  params: { alpha: 0.15 }
});
```

## 15. Running Outside The Tester

After a pipeline works in the UI:

1. Click **Save** to download `pipeline_config.json`.
2. Put that file beside your input CSV or JSON.
3. Run:

```bash
npm run run:pipeline -- pipeline_config.json input.csv filtered.csv
```

Choose Pipeline B:

```bash
npm run run:pipeline -- pipeline_config.json input.csv filtered.csv --pipeline B
```

Override the target column:

```bash
npm run run:pipeline -- pipeline_config.json robot-log.csv filtered.csv --target gyro_z
```

Write JSON output:

```bash
npm run run:pipeline -- pipeline_config.json input.csv filtered.json --json
```

The external runner uses the same JavaScript step syntax and passes the same variables: `data`, `tf`, `onEpoch`, `trainData`, `valData`, `testData`, `params`, and `modelStore`.

Important: pipeline files execute JavaScript. Only run configs you wrote or trust.

## 16. Debugging Checklist

- If the chart is empty, make sure each step returns an array.
- If a model is flat, check that `value` is numeric.
- If a filter lags too much, reduce the moving-average window, increase EMA `alpha`, or increase Kalman `Q`.
- If a filter is too noisy, increase the window, decrease EMA `alpha`, or increase Kalman `R`.
- Use `console.log(...)` inside a step and read the Engine Log.
- Start with a simple one-step pipeline before stacking multiple transforms.
