import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SnippetLibrary from '../components/SnippetLibrary';

describe('SnippetLibrary', () => {
  it('renders the Snippet Library header', () => {
    const { container } = render(<SnippetLibrary onInsert={() => {}} />);
    expect(container.textContent).toContain('Snippet Library');
  });

  it('renders all 4 categories', () => {
    const { container } = render(<SnippetLibrary onInsert={() => {}} />);
    expect(container.textContent).toContain('Filtering');
    expect(container.textContent).toContain('Neural Networks');
    expect(container.textContent).toContain('Clustering');
    expect(container.textContent).toContain('Utilities');
  });

  it('expands a category when clicked', () => {
    const { container } = render(<SnippetLibrary onInsert={() => {}} />);
    // Click "Filtering"
    const filteringCategory = screen.getByText(/Filtering/);
    fireEvent.click(filteringCategory);
    // Should show snippets
    expect(container.textContent).toContain('Simple Moving Average');
    expect(container.textContent).toContain('Exponential Moving Average');
    expect(container.textContent).toContain('1D Kalman Filter');
  });

  it('calls onInsert when a snippet is clicked', () => {
    const onInsert = vi.fn();
    render(<SnippetLibrary onInsert={onInsert} />);
    // Expand Filtering category
    fireEvent.click(screen.getByText(/Filtering/));
    // Click SMA snippet
    fireEvent.click(screen.getByText('Simple Moving Average'));
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('windowSize'));
  });

  it('expanding one category collapses the previous', () => {
    const { container } = render(<SnippetLibrary onInsert={() => {}} />);
    // Expand Filtering
    fireEvent.click(screen.getByText(/Filtering/));
    expect(container.textContent).toContain('Simple Moving Average');
    // Expand Neural Networks
    fireEvent.click(screen.getByText(/Neural Networks/));
    expect(container.textContent).toContain('Dense Regressor');
    // Filtering items should be gone
    expect(container.textContent).not.toContain('Simple Moving Average');
  });

  it('Neural Networks category contains expected snippets', () => {
    render(<SnippetLibrary onInsert={() => {}} />);
    fireEvent.click(screen.getByText(/Neural Networks/));
    expect(screen.getByText('Dense Regressor')).toBeDefined();
    expect(screen.getByText('LSTM Sequence Predictor')).toBeDefined();
    expect(screen.getByText('Autoencoder (Anomaly Detection)')).toBeDefined();
  });

  it('Clustering category contains K-Means', () => {
    render(<SnippetLibrary onInsert={() => {}} />);
    fireEvent.click(screen.getByText(/Clustering/));
    expect(screen.getByText('K-Means Classifier (k=3)')).toBeDefined();
  });

  it('Utilities category contains expected snippets', () => {
    render(<SnippetLibrary onInsert={() => {}} />);
    fireEvent.click(screen.getByText(/Utilities/));
    expect(screen.getByText('Noise Variance Estimator')).toBeDefined();
    expect(screen.getByText('Null / NaN Interpolator')).toBeDefined();
  });
});
