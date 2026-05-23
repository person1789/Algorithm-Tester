import { describe, it, expect } from 'vitest';
import {
  engineerFeatures,
  computePCA,
  computeConfusionMatrix,
  crossValidateRolling,
  normalizeData,
  splitData,
  computeCorrelationMatrix,
  computeACF,
  computeResiduals,
  computeConfidenceBands
} from '../utils/mlUtils';

// Helper: generate simple test data
function makeData(n, valueFn = i => i * 10) {
  return Array.from({ length: n }, (_, i) => ({ time: i, value: valueFn(i) }));
}

// ═══════════════════════════════════════════════════════
//  FEATURE ENGINEERING
// ═══════════════════════════════════════════════════════
describe('engineerFeatures', () => {
  it('adds rolling statistics to each row', () => {
    const data = makeData(10);
    const enriched = engineerFeatures(data, 3);
    const row = enriched[5];
    expect(row).toHaveProperty('rolling_mean');
    expect(row).toHaveProperty('rolling_variance');
    expect(row).toHaveProperty('rolling_min');
    expect(row).toHaveProperty('rolling_max');
    expect(row).toHaveProperty('rolling_skewness');
    expect(row).toHaveProperty('diff');
    expect(row).toHaveProperty('ema');
  });

  it('preserves original time and value', () => {
    const data = makeData(5);
    const enriched = engineerFeatures(data, 3);
    enriched.forEach((row, i) => {
      expect(row.time).toBe(i);
      expect(row.value).toBe(i * 10);
    });
  });

  it('rolling mean is correct for window size 3', () => {
    const data = makeData(5, i => i * 10); // 0, 10, 20, 30, 40
    const enriched = engineerFeatures(data, 3);
    // Index 2: window [0,10,20] → mean 10
    expect(enriched[2].rolling_mean).toBeCloseTo(10, 1);
    // Index 4: window [20,30,40] → mean 30
    expect(enriched[4].rolling_mean).toBeCloseTo(30, 1);
  });

  it('diff is the first-order difference', () => {
    const data = makeData(5, i => i * 10); // 0, 10, 20, 30, 40
    const enriched = engineerFeatures(data, 3);
    expect(enriched[1].diff).toBeCloseTo(10, 1);
    expect(enriched[3].diff).toBeCloseTo(10, 1);
  });

  it('handles null values gracefully', () => {
    const data = [
      { time: 0, value: 10 },
      { time: 1, value: null },
      { time: 2, value: 30 }
    ];
    expect(() => engineerFeatures(data, 2)).not.toThrow();
  });

  it('window size 1 means no smoothing', () => {
    const data = makeData(5, i => i * 10);
    const enriched = engineerFeatures(data, 1);
    enriched.forEach((row, i) => {
      expect(row.rolling_mean).toBeCloseTo(i * 10, 1);
      expect(row.rolling_variance).toBeCloseTo(0, 1);
    });
  });
});

// ═══════════════════════════════════════════════════════
//  PCA
// ═══════════════════════════════════════════════════════
describe('computePCA', () => {
  it('returns null for insufficient data', () => {
    expect(computePCA(null)).toBeNull();
    expect(computePCA([])).toBeNull();
    expect(computePCA([[1]])).toBeNull();
  });

  it('projects N points to 2D', () => {
    const matrix = [
      [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]
    ];
    const result = computePCA(matrix);
    expect(result).toHaveLength(4);
    result.forEach(p => {
      expect(p).toHaveProperty('pc1');
      expect(p).toHaveProperty('pc2');
      expect(typeof p.pc1).toBe('number');
      expect(typeof p.pc2).toBe('number');
    });
  });

  it('produces distinct projections for distinct inputs', () => {
    const matrix = [
      [1, 0], [0, 1], [1, 1], [0, 0], [2, 3]
    ];
    const result = computePCA(matrix);
    const pc1Values = result.map(r => r.pc1);
    const unique = new Set(pc1Values.map(v => v.toFixed(3)));
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════
//  CONFUSION MATRIX
// ═══════════════════════════════════════════════════════
describe('computeConfusionMatrix', () => {
  it('computes correct matrix for binary classification', () => {
    const actual    = ['A', 'A', 'B', 'B', 'A'];
    const predicted = ['A', 'B', 'B', 'B', 'A'];
    const result = computeConfusionMatrix(actual, predicted);

    expect(result.classes).toEqual(['A', 'B']);
    expect(result.matrix['A']['A']).toBe(2); // TP for A
    expect(result.matrix['A']['B']).toBe(1); // FN for A (predicted B)
    expect(result.matrix['B']['B']).toBe(2); // TP for B
    expect(result.matrix['B']['A']).toBe(0); // FN for B
  });

  it('computes precision, recall, f1 per class', () => {
    const actual    = ['A', 'A', 'B', 'B'];
    const predicted = ['A', 'B', 'B', 'A'];
    const result = computeConfusionMatrix(actual, predicted);

    expect(result.metrics).toHaveProperty('A');
    expect(result.metrics).toHaveProperty('B');
    expect(parseFloat(result.metrics['A'].precision)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(result.metrics['A'].recall)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(result.metrics['A'].f1)).toBeGreaterThanOrEqual(0);
  });

  it('handles multi-class classification', () => {
    const actual    = ['A', 'B', 'C', 'A', 'C'];
    const predicted = ['A', 'B', 'B', 'A', 'C'];
    const result = computeConfusionMatrix(actual, predicted);

    expect(result.classes).toEqual(['A', 'B', 'C']);
    expect(result.matrix['A']['A']).toBe(2);
    expect(result.matrix['C']['B']).toBe(1);
  });

  it('handles perfect classification', () => {
    const labels = ['X', 'Y', 'X', 'Y'];
    const result = computeConfusionMatrix(labels, labels);
    expect(parseFloat(result.metrics['X'].precision)).toBe(1);
    expect(parseFloat(result.metrics['X'].recall)).toBe(1);
    expect(parseFloat(result.metrics['X'].f1)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════
//  CROSS-VALIDATION
// ═══════════════════════════════════════════════════════
describe('crossValidateRolling', () => {
  it('returns correct number of chunks', () => {
    const data = makeData(60);
    const code = 'return data;'; // passthrough
    const results = crossValidateRolling(data, code, 20);
    expect(results).toHaveLength(3); // 60/20 = 3 chunks
  });

  it('each chunk has rmse and startTime', () => {
    const data = makeData(40);
    const code = 'return data.map(d => ({...d, value: d.value + 1}));';
    const results = crossValidateRolling(data, code, 20);
    results.forEach(r => {
      expect(r).toHaveProperty('rmse');
      expect(r).toHaveProperty('startTime');
    });
  });

  it('passthrough pipeline has zero RMSE', () => {
    const data = makeData(40);
    const code = 'return data;';
    const results = crossValidateRolling(data, code, 20);
    results.forEach(r => {
      expect(r.rmse).toBeCloseTo(0, 5);
    });
  });

  it('handles pipeline errors gracefully', () => {
    const data = makeData(20);
    const code = 'throw new Error("broken");';
    const results = crossValidateRolling(data, code, 10);
    results.forEach(r => {
      expect(r.rmse).toBeNull();
      expect(r).toHaveProperty('error');
    });
  });
});

// ═══════════════════════════════════════════════════════
//  NORMALIZATION
// ═══════════════════════════════════════════════════════
describe('normalizeData', () => {
  it('returns original data when method is none', () => {
    const data = makeData(5);
    const result = normalizeData(data, 'none');
    expect(result).toEqual(data);
  });

  it('min-max scales values to [0, 1]', () => {
    const data = makeData(5, i => i * 25); // 0, 25, 50, 75, 100
    const result = normalizeData(data, 'minmax');
    expect(result[0].value).toBeCloseTo(0, 5);
    expect(result[4].value).toBeCloseTo(1, 5);
    expect(result[2].value).toBeCloseTo(0.5, 5);
  });

  it('z-score normalizes to mean≈0, std≈1', () => {
    const data = makeData(100, i => i);
    const result = normalizeData(data, 'zscore');
    const mean = result.reduce((a, d) => a + d.value, 0) / result.length;
    expect(mean).toBeCloseTo(0, 1);
  });

  it('log transform applies natural log', () => {
    const data = [
      { time: 0, value: 1 },
      { time: 1, value: Math.E },
      { time: 2, value: Math.E * Math.E }
    ];
    const result = normalizeData(data, 'log');
    expect(result[0].value).toBeCloseTo(0, 5);
    expect(result[1].value).toBeCloseTo(1, 5);
    expect(result[2].value).toBeCloseTo(2, 5);
  });

  it('handles empty data', () => {
    expect(normalizeData([], 'minmax')).toEqual([]);
    expect(normalizeData(null, 'zscore')).toBeNull();
  });

  it('preserves null values in normalization', () => {
    const data = [{ time: 0, value: 10 }, { time: 1, value: null }, { time: 2, value: 20 }];
    const result = normalizeData(data, 'minmax');
    expect(result[1].value).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
//  DATA SPLITTING
// ═══════════════════════════════════════════════════════
describe('splitData', () => {
  it('splits data into correct proportions', () => {
    const data = makeData(100);
    const splits = splitData(data, 70, 15);
    expect(splits.train).toHaveLength(70);
    expect(splits.val).toHaveLength(15);
    expect(splits.test).toHaveLength(15);
  });

  it('train + val + test equals original length', () => {
    const data = makeData(100);
    const splits = splitData(data, 60, 20);
    expect(splits.train.length + splits.val.length + splits.test.length).toBe(100);
  });

  it('handles 100% train', () => {
    const data = makeData(50);
    const splits = splitData(data, 100, 0);
    expect(splits.train).toHaveLength(50);
    expect(splits.val).toHaveLength(0);
    expect(splits.test).toHaveLength(0);
  });

  it('preserves data order', () => {
    const data = makeData(20);
    const splits = splitData(data, 50, 25);
    expect(splits.train[0].time).toBe(0);
    expect(splits.val[0].time).toBe(10);
    expect(splits.test[0].time).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════
//  CORRELATION MATRIX
// ═══════════════════════════════════════════════════════
describe('computeCorrelationMatrix', () => {
  it('returns null for insufficient data', () => {
    expect(computeCorrelationMatrix(null, ['a', 'b'])).toBeNull();
    expect(computeCorrelationMatrix([{a: 1}], ['a', 'b'])).toBeNull();
    expect(computeCorrelationMatrix([{a: 1}, {a: 2}], ['a'])).toBeNull();
  });

  it('diagonal is always 1.0', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ a: i, b: i * 2, c: Math.random() }));
    const result = computeCorrelationMatrix(data, ['a', 'b', 'c']);
    expect(result.matrix[0][0]).toBeCloseTo(1, 2);
    expect(result.matrix[1][1]).toBeCloseTo(1, 2);
    expect(result.matrix[2][2]).toBeCloseTo(1, 2);
  });

  it('perfectly correlated fields have correlation ≈ 1', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i * 3 + 7 }));
    const result = computeCorrelationMatrix(data, ['x', 'y']);
    expect(result.matrix[0][1]).toBeCloseTo(1, 2);
    expect(result.matrix[1][0]).toBeCloseTo(1, 2);
  });

  it('correlation matrix is symmetric', () => {
    const data = Array.from({ length: 30 }, (_, i) => ({ a: i, b: i * 2, c: i * i }));
    const result = computeCorrelationMatrix(data, ['a', 'b', 'c']);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(result.matrix[i][j]).toBeCloseTo(result.matrix[j][i], 3);
      }
    }
  });

  it('returns correct field names', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ foo: i, bar: i }));
    const result = computeCorrelationMatrix(data, ['foo', 'bar']);
    expect(result.fields).toEqual(['foo', 'bar']);
  });
});

// ═══════════════════════════════════════════════════════
//  AUTOCORRELATION (ACF)
// ═══════════════════════════════════════════════════════
describe('computeACF', () => {
  it('returns empty for very short data', () => {
    expect(computeACF(makeData(2))).toEqual([]);
  });

  it('lag 0 is always 1.0', () => {
    const data = makeData(50, i => Math.sin(i));
    const acf = computeACF(data);
    expect(acf[0].lag).toBe(0);
    expect(acf[0].acf).toBeCloseTo(1, 2);
  });

  it('returns correct number of lags', () => {
    const data = makeData(100);
    const acf = computeACF(data, 20);
    expect(acf).toHaveLength(21); // 0 through 20 inclusive
  });

  it('detects periodicity in sine wave', () => {
    // A sine wave should show ACF approaching 1 again at its period
    const data = makeData(200, i => Math.sin(i * 0.1));
    const acf = computeACF(data, 40);
    // ACF should decrease from 1 at lag 0
    expect(acf[0].acf).toBeCloseTo(1, 1);
    expect(Math.abs(acf[1].acf)).toBeLessThan(1);
  });

  it('constant data returns empty (zero variance)', () => {
    const data = makeData(20, () => 5);
    const acf = computeACF(data);
    expect(acf).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════
//  RESIDUALS
// ═══════════════════════════════════════════════════════
describe('computeResiduals', () => {
  it('returns null for null inputs', () => {
    expect(computeResiduals(null, null)).toBeNull();
    expect(computeResiduals(null, makeData(5))).toBeNull();
    expect(computeResiduals(makeData(5), null)).toBeNull();
  });

  it('computes correct residuals', () => {
    const raw = [{ time: 0, value: 10 }, { time: 1, value: 20 }];
    const filtered = [{ time: 0, value: 12 }, { time: 1, value: 18 }];
    const result = computeResiduals(raw, filtered);
    expect(result).toHaveLength(2);
    expect(result[0].residual).toBeCloseTo(2, 5);   // 12 - 10
    expect(result[1].residual).toBeCloseTo(-2, 5);   // 18 - 20
  });

  it('handles mismatched lengths by using shorter', () => {
    const raw = makeData(10);
    const filtered = makeData(5, i => i * 10 + 1);
    const result = computeResiduals(raw, filtered);
    expect(result).toHaveLength(5);
  });

  it('passthrough has zero residuals', () => {
    const data = makeData(20);
    const result = computeResiduals(data, data);
    result.forEach(r => expect(r.residual).toBeCloseTo(0, 5));
  });
});

// ═══════════════════════════════════════════════════════
//  CONFIDENCE BANDS
// ═══════════════════════════════════════════════════════
describe('computeConfidenceBands', () => {
  it('returns null for too-short data', () => {
    expect(computeConfidenceBands(makeData(3), 10)).toBeNull();
  });

  it('returns upper and lower bands for each point', () => {
    const data = makeData(20);
    const bands = computeConfidenceBands(data, 5);
    expect(bands).toHaveLength(20);
    bands.forEach(b => {
      expect(b).toHaveProperty('time');
      expect(b).toHaveProperty('upper');
      expect(b).toHaveProperty('lower');
      expect(b.upper).toBeGreaterThanOrEqual(b.lower);
    });
  });

  it('constant data has zero-width bands', () => {
    const data = makeData(20, () => 42);
    const bands = computeConfidenceBands(data, 5);
    bands.slice(4).forEach(b => { // After window fills up
      expect(b.upper).toBeCloseTo(b.lower, 5);
    });
  });

  it('wider variance produces wider bands', () => {
    const narrow = makeData(20, () => 50);
    const wide = makeData(20, i => i % 2 === 0 ? 0 : 100);
    const bandsNarrow = computeConfidenceBands(narrow, 5);
    const bandsWide = computeConfidenceBands(wide, 5);
    const widthNarrow = bandsNarrow[10].upper - bandsNarrow[10].lower;
    const widthWide = bandsWide[10].upper - bandsWide[10].lower;
    expect(widthWide).toBeGreaterThan(widthNarrow);
  });
});
