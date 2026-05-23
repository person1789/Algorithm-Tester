import { Plus, Trash2, Table, Upload } from 'lucide-react';

function coerceCell(value) {
  if (value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function DatasetBuilder({ rows, setRows, onUseDataset, onImportCurrent, currentDataSize }) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : ['time', 'value'];

  const updateCell = (rowIndex, column, value) => {
    setRows(rows.map((row, index) => (
      index === rowIndex ? { ...row, [column]: value } : row
    )));
  };

  const addRow = () => {
    const next = {};
    columns.forEach(column => {
      next[column] = column === 'time' ? rows.length : '';
    });
    setRows([...rows, next]);
  };

  const removeRow = (rowIndex) => {
    setRows(rows.filter((_, index) => index !== rowIndex));
  };

  const addColumn = () => {
    let index = columns.length + 1;
    let name = `feature_${index}`;
    while (columns.includes(name)) {
      index++;
      name = `feature_${index}`;
    }
    setRows(rows.map(row => ({ ...row, [name]: '' })));
  };

  const removeColumn = (column) => {
    if (columns.length <= 1) return;
    setRows(rows.map(row => {
      const next = { ...row };
      delete next[column];
      return next;
    }));
  };

  const renameColumn = (oldName, newName) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === oldName || columns.includes(cleanName)) return;
    setRows(rows.map(row => {
      const next = {};
      columns.forEach(column => {
        next[column === oldName ? cleanName : column] = row[column];
      });
      return next;
    }));
  };

  const normalizedRows = rows.map((row, index) => {
    const normalized = {};
    columns.forEach(column => {
      normalized[column] = coerceCell(row[column]);
    });
    if (normalized.time === null || normalized.time === undefined) normalized.time = index;
    return normalized;
  });

  return (
    <div className="tool-panel dataset-builder">
      <div className="tool-panel-header">
        <div>
          <strong>Dataset Builder</strong>
          <span>Build small CSV-like datasets directly in the tester.</span>
        </div>
        <div className="tool-panel-actions">
          <button className="toolbar-btn" onClick={onImportCurrent} disabled={!currentDataSize} title="Copy currently loaded data into the table">
            <Upload size={14} /> Current
          </button>
          <button className="toolbar-btn" onClick={() => onUseDataset(normalizedRows)} title="Load this table as the active dataset">
            <Table size={14} /> Use
          </button>
        </div>
      </div>

      <div className="dataset-table-wrap">
        <table className="dataset-table">
          <thead>
            <tr>
              <th>#</th>
              {columns.map(column => (
                <th key={column}>
                  <input
                    value={column}
                    onChange={event => renameColumn(column, event.target.value)}
                    title="Rename column"
                  />
                  <button onClick={() => removeColumn(column)} title={`Remove ${column}`}>
                    <Trash2 size={12} />
                  </button>
                </th>
              ))}
              <th>
                <button onClick={addColumn} title="Add column">
                  <Plus size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td>{rowIndex}</td>
                {columns.map(column => (
                  <td key={column}>
                    <input
                      value={row[column] ?? ''}
                      onChange={event => updateCell(rowIndex, column, event.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button onClick={() => removeRow(rowIndex)} title="Remove row">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="toolbar-btn dataset-add-row" onClick={addRow}>
        <Plus size={14} /> Add Row
      </button>
    </div>
  );
}

export default DatasetBuilder;
