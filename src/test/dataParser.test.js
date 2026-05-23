import { describe, it, expect } from 'vitest';
import { generateSyntheticData } from '../utils/dataParser';

describe('dataParser', () => {
  // ─────────────── generateSyntheticData ───────────────

  describe('generateSyntheticData', () => {
    it('generates the correct number of points', () => {
      const data = generateSyntheticData(100, 'sine');
      expect(data).toHaveLength(100);
    });

    it('generates default 256 points when no count specified', () => {
      const data = generateSyntheticData();
      expect(data).toHaveLength(256);
    });

    it('returns objects with time and value fields', () => {
      const data = generateSyntheticData(10, 'sine');
      data.forEach((row, i) => {
        expect(row).toHaveProperty('time', i);
        expect(row).toHaveProperty('value');
        expect(typeof row.value).toBe('number');
      });
    });

    it('generates sine wave data', () => {
      const data = generateSyntheticData(50, 'sine');
      // Sine wave centered around 50, values should be roughly 0-100 + noise
      const values = data.map(d => d.value);
      expect(Math.max(...values)).toBeGreaterThan(20);
      expect(Math.min(...values)).toBeLessThan(80);
    });

    it('generates square wave data', () => {
      const data = generateSyntheticData(100, 'square');
      // Square wave alternates between ~0 and ~100
      const values = data.map(d => d.value);
      expect(values.some(v => v > 50)).toBe(true);
      expect(values.some(v => v < 50)).toBe(true);
    });

    it('generates random walk data', () => {
      const data = generateSyntheticData(100, 'random_walk');
      const values = data.map(d => d.value);
      // Random walk should have varying values, not constant
      const unique = new Set(values.map(v => Math.round(v)));
      expect(unique.size).toBeGreaterThan(1);
    });

    it('generates complex waveform data', () => {
      const data = generateSyntheticData(100, 'complex');
      expect(data).toHaveLength(100);
      data.forEach(row => expect(typeof row.value).toBe('number'));
    });

    it('generates chirp waveform data', () => {
      const data = generateSyntheticData(100, 'chirp');
      expect(data).toHaveLength(100);
      data.forEach(row => expect(typeof row.value).toBe('number'));
    });

    it('time values are sequential integers starting at 0', () => {
      const data = generateSyntheticData(20, 'sine');
      data.forEach((row, i) => expect(row.time).toBe(i));
    });
  });
});
