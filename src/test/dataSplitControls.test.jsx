import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import DataSplitControls from '../components/DataSplitControls';

describe('DataSplitControls', () => {
  const defaultConfig = { trainPct: 70, valPct: 15 };

  it('renders train and val sliders', () => {
    const { container } = render(
      <DataSplitControls splitConfig={defaultConfig} setSplitConfig={() => {}} />
    );
    expect(container.textContent).toContain('Data Split');
    expect(container.textContent).toContain('Train:');
    expect(container.textContent).toContain('Val:');
    expect(container.textContent).toContain('70%');
    expect(container.textContent).toContain('15%');
  });

  it('displays correct test percentage', () => {
    const { container } = render(
      <DataSplitControls splitConfig={defaultConfig} setSplitConfig={() => {}} />
    );
    expect(container.textContent).toContain('Test: 15%');
  });

  it('displays 0% test when train+val=100', () => {
    const { container } = render(
      <DataSplitControls splitConfig={{ trainPct: 80, valPct: 20 }} setSplitConfig={() => {}} />
    );
    expect(container.textContent).toContain('Test: 0%');
  });

  it('calls setSplitConfig when train slider changes', () => {
    const setSplitConfig = vi.fn();
    const { container } = render(
      <DataSplitControls splitConfig={defaultConfig} setSplitConfig={setSplitConfig} />
    );
    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[0], { target: { value: '60' } });
    expect(setSplitConfig).toHaveBeenCalledWith({ trainPct: 60, valPct: 15 });
  });

  it('calls setSplitConfig when val slider changes', () => {
    const setSplitConfig = vi.fn();
    const { container } = render(
      <DataSplitControls splitConfig={defaultConfig} setSplitConfig={setSplitConfig} />
    );
    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[1], { target: { value: '20' } });
    expect(setSplitConfig).toHaveBeenCalledWith({ trainPct: 70, valPct: 20 });
  });
});
