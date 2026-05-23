import Papa from 'papaparse';

export function generateSyntheticData(numPoints = 256, type = 'sine') {
  const data = [];
  let time = 0;
  let rwValue = 50;
  for (let i = 0; i < numPoints; i++) {
    let trueValue = 0;
    if (type === 'sine') {
      trueValue = Math.sin(time) * 50 + 50;
    } else if (type === 'square') {
      trueValue = Math.sin(time) > 0 ? 100 : 0;
    } else if (type === 'random_walk') {
      rwValue += (Math.random() - 0.5) * 10;
      trueValue = rwValue;
    } else if (type === 'complex') {
      // Base low freq + high freq + noise
      trueValue = (Math.sin(time) * 40) + (Math.sin(time * 5) * 15) + 50;
    } else if (type === 'chirp') {
      // Frequency increases over time
      trueValue = Math.sin(time * (1 + time * 0.1)) * 50 + 50;
    }
    
    // Add baseline noise
    const noise = (Math.random() - 0.5) * 20;
    data.push({
      time: i,
      value: trueValue + noise
    });
    time += 0.1;
  }
  return data;
}

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields;
        if (fields.length < 2) {
          reject(new Error("CSV must have at least 2 columns"));
          return;
        }
        // Preserve ALL columns. Use first as time, second as value by default.
        const timeField = fields[0];
        const valField = fields[1];
        
        const mapped = results.data.map((row, idx) => {
          const obj = { ...row };
          // Ensure canonical time/value fields exist
          if (obj.time === undefined) obj.time = obj[timeField] !== undefined ? obj[timeField] : idx;
          if (obj.value === undefined) obj.value = obj[valField];
          return obj;
        });
        // Attach column metadata
        mapped._fields = fields;
        resolve(mapped);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export function parseJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!Array.isArray(json)) {
          reject(new Error("JSON must be an array of objects"));
          return;
        }
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read JSON file"));
    reader.readAsText(file);
  });
}
