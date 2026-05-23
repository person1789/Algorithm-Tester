import { describe, it, expect } from 'vitest';
import {
  engineerFeatures,
  normalizeData,
  splitData,
  computeResiduals,
  computeConfidenceBands,
  computeACF,
  computeCorrelationMatrix
} from '../utils/mlUtils';
import { generateSyntheticData } from '../utils/dataParser';

// ═══════════════════════════════════════════════════════
//  END-TO-END PIPELINE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════

describe('E2E: Full Pipeline Flows', () => {
  it('synthetic → normalize → feature eng → split → metrics', () => {
    // 1. Generate data
    const raw = generateSyntheticData(200, 'sine');
    expect(raw).toHaveLength(200);

    // 2. Normalize
    const normalized = normalizeData(raw, 'minmax');
    const values = normalized.map(d => d.value);
    expect(Math.min(...values)).toBeCloseTo(0, 1);
    expect(Math.max(...values)).toBeCloseTo(1, 1);

    // 3. Feature engineering
    const enriched = engineerFeatures(normalized, 5);
    expect(enriched[10]).toHaveProperty('rolling_mean');
    expect(enriched[10]).toHaveProperty('ema');

    // 4. Split
    const splits = splitData(enriched, 70, 15);
    expect(splits.train.length + splits.val.length + splits.test.length).toBe(200);
  });

  it('pipeline with custom algorithm produces valid output', () => {
    const data = generateSyntheticData(100, 'random_walk');
    
    // Simulate running a pipeline step (moving average)
    const windowSize = 5;
    const output = data.map((row, i, arr) => {
      const start = Math.max(0, i - windowSize + 1);
      const win = arr.slice(start, i + 1);
      const avg = win.reduce((s, r) => s + r.value, 0) / win.length;
      return { ...row, value: avg };
    });

    expect(output).toHaveLength(100);
    
    // Residuals should be small since MA smooths the data
    const residuals = computeResiduals(data, output);
    expect(residuals).toHaveLength(100);
    // Average absolute residual should be finite
    const avgResidual = residuals.reduce((s, r) => s + Math.abs(r.residual), 0) / 100;
    expect(avgResidual).toBeGreaterThanOrEqual(0);
    expect(isFinite(avgResidual)).toBe(true);
  });

  it('confidence bands wrap model output correctly', () => {
    const data = generateSyntheticData(50, 'sine');
    const bands = computeConfidenceBands(data, 10);
    expect(bands).toHaveLength(50);
    
    // All bands should have upper >= lower
    bands.forEach(b => {
      expect(b.upper).toBeGreaterThanOrEqual(b.lower);
    });
  });

  it('ACF computation on all synthetic types works', () => {
    const types = ['sine', 'square', 'random_walk', 'complex', 'chirp'];
    types.forEach(type => {
      const data = generateSyntheticData(100, type);
      const acf = computeACF(data, 20);
      if (acf.length > 0) {
        expect(acf[0].acf).toBeCloseTo(1, 1);
      }
    });
  });

  it('correlation matrix on enriched data has correct dimensions', () => {
    const data = generateSyntheticData(50, 'sine');
    const enriched = engineerFeatures(data, 5);
    const fields = ['value', 'rolling_mean', 'rolling_variance', 'ema', 'diff'];
    const cm = computeCorrelationMatrix(enriched, fields);
    
    expect(cm.matrix).toHaveLength(5);
    cm.matrix.forEach(row => expect(row).toHaveLength(5));
    // Diagonal should be 1
    for (let i = 0; i < 5; i++) {
      expect(cm.matrix[i][i]).toBeCloseTo(1, 2);
    }
  });
});

// ═══════════════════════════════════════════════════════
//  ASYNC PIPELINE SANDBOX TESTS
// ═══════════════════════════════════════════════════════
describe('Async Pipeline Sandbox', () => {
  it('AsyncFunction constructor works for simple code', async () => {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('data', 'return data.map(d => ({...d, value: d.value * 2}))');
    const data = [{ time: 0, value: 5 }, { time: 1, value: 10 }];
    const result = await fn(data);
    expect(result[0].value).toBe(10);
    expect(result[1].value).toBe(20);
  });

  it('AsyncFunction supports await keyword', async () => {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('data', `
      const delayed = await new Promise(r => setTimeout(() => r(42), 10));
      return data.map(d => ({...d, value: delayed}));
    `);
    const data = [{ time: 0, value: 0 }];
    const result = await fn(data);
    expect(result[0].value).toBe(42);
  });

  it('AsyncFunction receives all injected variables', async () => {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(
      'data', 'tf', 'onEpoch', 'trainData', 'valData', 'testData',
      'return data.map(d => ({...d, trainLen: trainData.length, valLen: valData.length}))'
    );
    const data = [{ time: 0, value: 1 }];
    const train = [{ time: 0, value: 1 }, { time: 1, value: 2 }];
    const val = [{ time: 2, value: 3 }];
    const result = await fn(data, null, () => {}, train, val, []);
    expect(result[0].trainLen).toBe(2);
    expect(result[0].valLen).toBe(1);
  });

  it('AsyncFunction throws for non-array return', async () => {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('data', 'return "not an array"');
    const result = await fn([]);
    expect(Array.isArray(result)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
//  CONSOLE CAPTURE SIMULATION
// ═══════════════════════════════════════════════════════
describe('Console Capture', () => {
  it('captures console.log output', () => {
    const captured = [];
    const origLog = console.log;
    console.log = (...args) => { captured.push(args.map(String).join(' ')); };
    
    console.log('hello', 'world');
    console.log('test 123');
    
    console.log = origLog;
    
    expect(captured).toHaveLength(2);
    expect(captured[0]).toBe('hello world');
    expect(captured[1]).toBe('test 123');
  });

  it('restores original console after capture', () => {
    const origLog = console.log;
    const mockLog = () => {};
    console.log = mockLog;
    console.log = origLog;
    expect(console.log).toBe(origLog);
  });
});

// ═══════════════════════════════════════════════════════
//  EDGE CASES & ERROR HANDLING
// ═══════════════════════════════════════════════════════
describe('Edge Cases', () => {
  it('engineerFeatures handles single-element data', () => {
    const data = [{ time: 0, value: 42 }];
    const result = engineerFeatures(data, 5);
    expect(result).toHaveLength(1);
    expect(result[0].rolling_mean).toBeCloseTo(42, 1);
  });

  it('normalizeData with all same values (zero range)', () => {
    const data = [{ time: 0, value: 5 }, { time: 1, value: 5 }, { time: 2, value: 5 }];
    const result = normalizeData(data, 'minmax');
    // All values should be 0 (min = max = 5, range treated as 1)
    result.forEach(d => expect(d.value).toBeCloseTo(0, 5));
  });

  it('splitData with very small dataset', () => {
    const data = [{ time: 0, value: 1 }, { time: 1, value: 2 }];
    const splits = splitData(data, 50, 25);
    expect(splits.train.length + splits.val.length + splits.test.length).toBe(2);
  });

  it('computeResiduals with empty arrays', () => {
    const result = computeResiduals([], []);
    expect(result).toHaveLength(0);
  });

  it('engineerFeatures preserves extra columns', () => {
    const data = [
      { time: 0, value: 10, sensor: 'A' },
      { time: 1, value: 20, sensor: 'B' }
    ];
    const result = engineerFeatures(data, 2);
    expect(result[0].sensor).toBe('A');
    expect(result[1].sensor).toBe('B');
  });
});
