function DataSplitControls({ splitConfig, setSplitConfig }) {
  const { trainPct, valPct } = splitConfig;
  const testPct = Math.max(0, 100 - trainPct - valPct);

  return (
    <div className="data-split-controls">
      <strong>Data Split</strong>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        Train:
        <input
          type="range" min={10} max={90} value={trainPct}
          onChange={e => setSplitConfig({ ...splitConfig, trainPct: parseInt(e.target.value) })}
          style={{ width: '80px' }}
        />
        <span style={{ fontFamily: 'monospace', width: '30px' }}>{trainPct}%</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        Val:
        <input
          type="range" min={0} max={Math.max(0, 90 - trainPct)} value={valPct}
          onChange={e => setSplitConfig({ ...splitConfig, valPct: parseInt(e.target.value) })}
          style={{ width: '80px' }}
        />
        <span style={{ fontFamily: 'monospace', width: '30px' }}>{valPct}%</span>
      </label>
      <span style={{ fontFamily: 'monospace', color: '#888' }}>
        Test: {testPct}%
      </span>
    </div>
  );
}

export default DataSplitControls;
