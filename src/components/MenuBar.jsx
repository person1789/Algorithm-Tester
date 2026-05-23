function MenuBar({ commands }) {
  const groups = [
    {
      label: 'File',
      items: [
        ['New Data', commands.newDataset],
        ['Load Data', commands.loadData],
        ['Import Config', commands.importConfig],
        ['Save Config', commands.saveConfig],
        ['Export CSV', commands.exportCSV],
        ['Export Algorithm', commands.exportAlgorithm]
      ]
    },
    {
      label: 'View',
      items: [
        ['Dataset Builder', commands.showDataset],
        ['Parameters', commands.showParams],
        ['Snippets', commands.showSnippets],
        ['Run Notebook', commands.showNotebook],
        ['Documentation', commands.showDocs],
        ['Telemetry: Time', () => commands.setTelemetryView('time')],
        ['Telemetry: Data', () => commands.setTelemetryView('datapreview')],
        ['Telemetry: Runs', () => commands.setTelemetryView('experiments')]
      ]
    },
    {
      label: 'Run',
      items: [
        ['Run Pipeline', commands.run],
        ['Stop', commands.stop],
        ['Cross Validate', commands.crossValidate],
        ['Batch Evaluate', commands.batchEvaluate],
        ['Toggle Sweep', commands.toggleSweep]
      ]
    },
    {
      label: 'Tools',
      items: [
        ['Noise Filter Template', () => commands.applyTemplate('noise')],
        ['Anomaly Detector Template', () => commands.applyTemplate('anomaly')],
        ['Regression Template', () => commands.applyTemplate('regression')],
        ['Classifier Template', () => commands.applyTemplate('classifier')],
        ['Reset Parameters', commands.resetParams]
      ]
    }
  ];

  return (
    <div className="menu-bar">
      {groups.map(group => (
        <details key={group.label} className="menu-group">
          <summary>{group.label}</summary>
          <div className="menu-dropdown">
            {group.items.map(([label, handler]) => (
              <button key={label} onClick={handler}>{label}</button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default MenuBar;
