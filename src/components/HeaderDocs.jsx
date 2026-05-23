const DOC_SECTIONS = [
  {
    group: 'File',
    items: [
      ['New Data', 'Open the table builder and start a blank editable dataset.'],
      ['Load', 'Import a CSV or JSON dataset.'],
      ['Import', 'Load a saved pipeline_config.json.'],
      ['Save', 'Download the current pipeline configuration.'],
      ['CSV', 'Download the latest filtered output.'],
      ['Export', 'Download a standalone algorithm module.']
    ]
  },
  {
    group: 'View',
    items: [
      ['Builder', 'Show the dataset table builder.'],
      ['Params', 'Show tunable values available as params inside algorithms.'],
      ['Snippets', 'Show reusable algorithm snippets.'],
      ['Notebook', 'Show saved experiment runs.'],
      ['Docs', 'Show this button reference.'],
      ['Time/FFT/Dist/Data/Runs', 'Choose the telemetry view from the header.']
    ]
  },
  {
    group: 'Run',
    items: [
      ['Run', 'Execute Pipeline A, and Pipeline B when A/B is enabled.'],
      ['Stop', 'Clear current outputs and metrics.'],
      ['CV', 'Run rolling cross-validation on Pipeline A.'],
      ['Batch', 'Run Pipeline A against several CSV/JSON files.'],
      ['Sweep', 'Run a parameter sweep using the configured sweep variable.']
    ]
  },
  {
    group: 'Tools',
    items: [
      ['Preset', 'Load a starter project: filter, anomaly detector, regressor, or classifier.'],
      ['A/B', 'Enable side-by-side pipeline comparison.'],
      ['Split', 'Enable train/validation/test controls.'],
      ['Feat', 'Add rolling features before the pipeline.'],
      ['Target', 'Choose which input column is copied to row.value.']
    ]
  }
];

function HeaderDocs() {
  return (
    <div className="tool-panel docs-panel">
      <div className="tool-panel-header">
        <div>
          <strong>Header Reference</strong>
          <span>Every visible command in the header should do real work.</span>
        </div>
      </div>
      {DOC_SECTIONS.map(section => (
        <section key={section.group}>
          <h3>{section.group}</h3>
          <dl>
            {section.items.map(([name, description]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export default HeaderDocs;
