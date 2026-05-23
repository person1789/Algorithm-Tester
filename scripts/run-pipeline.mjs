#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import * as tf from '@tensorflow/tfjs';
import { engineerFeatures, normalizeData, splitData } from '../src/utils/mlUtils.js';

function printUsage() {
  console.log(`Usage:
  npm run run:pipeline -- <config.json> <input.csv|input.json> <output.csv|output.json> [options]

Options:
  --pipeline A|B       Pipeline to run. Default: A
  --target <column>    Override target column mapped to row.value
  --start <index>      First input row to include. Default: 0
  --end <index>        Last input row to include. Default: final row
  --json               Force JSON output regardless of output extension

Example:
  npm run run:pipeline -- pipeline_config.json sensor.csv filtered.csv --pipeline A`);
}

function parseArgs(argv) {
  const positional = [];
  const options = { pipeline: 'A', json: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--pipeline') options.pipeline = argv[++i] || 'A';
    else if (arg === '--target') options.target = argv[++i];
    else if (arg === '--start') options.start = Number(argv[++i]);
    else if (arg === '--end') options.end = Number(argv[++i]);
    else positional.push(arg);
  }

  return { positional, options };
}

function coerceValue(value) {
  if (value === '') return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : value;
}

async function readData(inputPath) {
  const text = await fs.readFile(inputPath, 'utf8');
  if (inputPath.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('JSON input must be an array of row objects.');
    return parsed;
  }

  const parsed = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transform: coerceValue
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(error => error.message).join('; '));
  }

  return parsed.data.map((row, index) => ({
    time: row.time ?? index,
    ...row
  }));
}

function remapTarget(data, targetColumn) {
  if (!targetColumn || targetColumn === 'value') return data;
  return data.map(row => ({ ...row, value: row[targetColumn] }));
}

function preprocessData(data, config, options) {
  const start = Number.isFinite(options.start) ? options.start : 0;
  const end = Number.isFinite(options.end) ? options.end : data.length - 1;
  const targetColumn = options.target || config.targetColumn || 'value';

  let subset = data.slice(start, end + 1);
  subset = remapTarget(subset, targetColumn);
  subset = normalizeData(subset, config.normMethod || 'none');

  if (config.featureEngineering) {
    subset = engineerFeatures(subset, config.feWindowSize || 5);
  }

  return subset;
}

async function executePipeline(pipeline, inputData, config) {
  const splits = config.splitEnabled
    ? splitData(inputData, config.splitConfig?.trainPct ?? 70, config.splitConfig?.valPct ?? 15)
    : null;

  let currentData = inputData;
  const history = [];
  const onEpoch = (epoch, logs) => history.push({ epoch, ...logs });
  const params = {
    alpha: 0.2,
    windowSize: 5,
    Q: 0.1,
    R: 250,
    maxStep: 25,
    epochs: 40,
    learningRate: 0.01,
    ...(config.params || {})
  };
  const memoryModels = new Map();
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
      memoryModels.set(name, savedArtifacts);
      return name;
    },
    load: async (name) => {
      const artifacts = memoryModels.get(name);
      if (!artifacts) throw new Error(`No saved model named '${name}'.`);
      return tf.loadLayersModel(tf.io.fromMemory(artifacts));
    },
    list: () => [...memoryModels.keys()]
  };

  for (const step of pipeline) {
    const algorithm = new (Object.getPrototypeOf(async function () {}).constructor)(
      'data',
      'tf',
      'onEpoch',
      'trainData',
      'valData',
      'testData',
      'params',
      'modelStore',
      step.code
    );

    currentData = await algorithm(
      currentData,
      tf,
      onEpoch,
      splits ? splits.train : inputData,
      splits ? splits.val : [],
      splits ? splits.test : [],
      params,
      modelStore
    );

    if (!Array.isArray(currentData)) {
      throw new Error(`Step "${step.name}" did not return an array.`);
    }
  }

  return { rows: currentData, history };
}

async function writeOutput(outputPath, rows, asJson) {
  await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  if (asJson || outputPath.toLowerCase().endsWith('.json')) {
    await fs.writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    return;
  }

  await fs.writeFile(outputPath, Papa.unparse(rows), 'utf8');
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (options.help || positional.length < 3) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  const [configPath, inputPath, outputPath] = positional;
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const pipelineKey = options.pipeline.toUpperCase() === 'B' ? 'pipelineB' : 'pipelineA';
  const pipeline = config[pipelineKey];

  if (!Array.isArray(pipeline) || pipeline.length === 0) {
    throw new Error(`Config does not contain a non-empty ${pipelineKey}.`);
  }

  const inputData = await readData(inputPath);
  const prepared = preprocessData(inputData, config, options);
  const { rows, history } = await executePipeline(pipeline, prepared, config);

  await writeOutput(outputPath, rows, options.json);
  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
  if (history.length > 0) console.log(`Captured ${history.length} training epochs.`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
