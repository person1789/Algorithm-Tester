# Algorithm Tester

A light, Thonny-inspired workspace for building and testing JavaScript time-series algorithms, noise filters, and TensorFlow.js models.

## Run The App

```bash
npm install
npm run dev
```

Open the local Vite URL, usually `http://localhost:5173/`.

## Use The Tester

- **Load** imports CSV or JSON.
- **New Data / Builder** creates editable table datasets inside the app.
- **Gen** creates synthetic sample data.
- **Preset** loads starter projects for filters, anomaly detection, regression, or classification.
- **Params** exposes slider-controlled values as `params` inside algorithm code.
- **Pipeline A/B** are editable JavaScript pipelines.
- **Run** executes the active pipeline and plots output against the raw data.
- **Split** creates train, validation, and test data for ML models.
- **Notebook** records experiment metrics and parameter snapshots.
- **Save** exports `pipeline_config.json`.
- **CSV** exports the filtered result.
- **Export** creates a standalone `.mjs` algorithm module.

Full usage notes and algorithm recipes are in [GUIDE.md](./GUIDE.md).

## Run A Saved Pipeline Outside The UI

After saving a config from the app:

```bash
npm run run:pipeline -- pipeline_config.json input.csv filtered.csv
```

Use Pipeline B:

```bash
npm run run:pipeline -- pipeline_config.json input.csv filtered.csv --pipeline B
```

Override the target column:

```bash
npm run run:pipeline -- pipeline_config.json robot-log.csv filtered.csv --target gyro_z
```

Pipeline configs execute JavaScript, so only run configs you wrote or trust.

## Build

```bash
npm run build
```
