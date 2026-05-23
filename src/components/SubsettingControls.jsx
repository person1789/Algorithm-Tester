function SubsettingControls({ 
  dataSize, 
  startIndex, 
  endIndex, 
  onRangeChange,
  columns = [],
  selectedColumn = '',
  onColumnChange = () => {}
}) {
  if (dataSize === 0) return null;

  const handleStartChange = (e) => {
    const val = Number(e.target.value);
    if (val <= endIndex) onRangeChange(val, endIndex);
  };

  const handleEndChange = (e) => {
    const val = Number(e.target.value);
    if (val >= startIndex) onRangeChange(startIndex, val);
  };

  return (
    <div className="subsetting-controls">
      <div className="control-group">
        <label>Time Range Subset:</label>
        <input 
          type="range" 
          min="0" 
          max={dataSize > 0 ? dataSize - 1 : 0} 
          value={startIndex} 
          onChange={handleStartChange} 
        />
        <span> to </span>
        <input 
          type="range" 
          min="0" 
          max={dataSize > 0 ? dataSize - 1 : 0} 
          value={endIndex} 
          onChange={handleEndChange} 
        />
        <span className="range-display">[{startIndex} - {endIndex}]</span>
      </div>
      
      {columns.length > 0 && (
        <div className="control-group">
          <label>Target Column:</label>
          <select value={selectedColumn} onChange={(e) => onColumnChange(e.target.value)}>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default SubsettingControls;
