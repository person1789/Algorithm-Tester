function ExportPanel({ onExportConfig, onExportCSV, onExportAlgorithm, hasOutput }) {
  return (
    <div className="tool-panel export-panel">
      <div className="tool-panel-header">
        <div>
          <strong>Export</strong>
          <span>Move a working experiment out of the tester.</span>
        </div>
      </div>

      <div className="export-actions">
        <button className="toolbar-btn" onClick={onExportConfig}>Save pipeline_config.json</button>
        <button className="toolbar-btn" onClick={onExportCSV} disabled={!hasOutput}>Export filtered_output.csv</button>
        <button className="toolbar-btn" onClick={onExportAlgorithm}>Export standalone algorithm .mjs</button>
      </div>

      <pre className="inline-code">{`npm run run:pipeline -- pipeline_config.json input.csv filtered.csv`}</pre>
    </div>
  );
}

export default ExportPanel;
