import { useState } from 'react';

const SNIPPETS = [
  {
    category: 'Filtering',
    items: [
      {
        name: 'Simple Moving Average',
        code: `const windowSize = 5;
return data.map((row, i, arr) => {
  const start = Math.max(0, i - windowSize + 1);
  const win = arr.slice(start, i + 1);
  const avg = win.reduce((s, r) => s + (r.value || 0), 0) / win.length;
  return { ...row, value: avg };
});`
      },
      {
        name: 'Exponential Moving Average',
        code: `const alpha = 0.2;
let prev = data[0].value;
return data.map(row => {
  const ema = row.value * alpha + prev * (1 - alpha);
  prev = ema;
  return { ...row, value: ema };
});`
      },
      {
        name: '1D Kalman Filter',
        code: `const Q = 0.1; // Process noise
const R = 250; // Measurement noise
let estimate = data[0].value;
let P = 1.0;

return data.map(row => {
  let predP = P + Q;
  const K = predP / (predP + R);
  estimate = estimate + K * (row.value - estimate);
  P = (1 - K) * predP;
  return { ...row, value: estimate };
});`
      }
    ]
  },
  {
    category: 'Neural Networks',
    items: [
      {
        name: 'Dense Regressor',
        code: `const model = tf.sequential();
model.add(tf.layers.dense({units: 16, inputShape: [1], activation: 'relu'}));
model.add(tf.layers.dense({units: 8, activation: 'relu'}));
model.add(tf.layers.dense({units: 1}));
model.compile({optimizer: 'adam', loss: 'meanSquaredError'});

const xs = tf.tensor2d(data.map(d => [d.time]));
const ys = tf.tensor2d(data.map(d => [d.value || 0]));

await model.fit(xs, ys, {
  epochs: 50,
  callbacks: { onEpochEnd: (e, l) => onEpoch(e, l) }
});

const preds = model.predict(xs).arraySync();
xs.dispose(); ys.dispose(); model.dispose();
return data.map((d, i) => ({...d, value: preds[i][0]}));`
      },
      {
        name: 'LSTM Sequence Predictor',
        code: `const seqLen = 10;
const xs = [], ys = [];
for (let i = seqLen; i < data.length; i++) {
  xs.push(data.slice(i - seqLen, i).map(d => [d.value || 0]));
  ys.push([data[i].value || 0]);
}

const model = tf.sequential();
model.add(tf.layers.lstm({units: 16, inputShape: [seqLen, 1]}));
model.add(tf.layers.dense({units: 1}));
model.compile({optimizer: 'adam', loss: 'meanSquaredError'});

const xTensor = tf.tensor3d(xs);
const yTensor = tf.tensor2d(ys);
await model.fit(xTensor, yTensor, {
  epochs: 30,
  callbacks: { onEpochEnd: (e, l) => onEpoch(e, l) }
});

const preds = model.predict(xTensor).arraySync();
xTensor.dispose(); yTensor.dispose(); model.dispose();

return data.map((d, i) => ({
  ...d,
  value: i >= seqLen ? preds[i - seqLen][0] : d.value
}));`
      },
      {
        name: 'Autoencoder (Anomaly Detection)',
        code: `const model = tf.sequential();
model.add(tf.layers.dense({units: 8, inputShape: [1], activation: 'relu'}));
model.add(tf.layers.dense({units: 2, activation: 'relu'})); // bottleneck
model.add(tf.layers.dense({units: 8, activation: 'relu'}));
model.add(tf.layers.dense({units: 1}));
model.compile({optimizer: 'adam', loss: 'meanSquaredError'});

const xs = tf.tensor2d(data.map(d => [d.value || 0]));
await model.fit(xs, xs, {
  epochs: 50,
  callbacks: { onEpochEnd: (e, l) => onEpoch(e, l) }
});

const reconstructed = model.predict(xs).arraySync();
xs.dispose(); model.dispose();

// Anomaly score = reconstruction error
return data.map((d, i) => ({
  ...d,
  value: reconstructed[i][0],
  anomaly_score: Math.abs((d.value || 0) - reconstructed[i][0])
}));`
      }
    ]
  },
  {
    category: 'Clustering',
    items: [
      {
        name: 'K-Means Classifier (k=3)',
        code: `const k = 3;
const vals = data.map(d => d.value || 0);
// Initialize centroids randomly from data
let centroids = Array.from({length: k}, () => vals[Math.floor(Math.random() * vals.length)]);

for (let iter = 0; iter < 20; iter++) {
  const clusters = Array.from({length: k}, () => []);
  vals.forEach(v => {
    const dists = centroids.map(c => Math.abs(v - c));
    clusters[dists.indexOf(Math.min(...dists))].push(v);
  });
  centroids = clusters.map(cl => cl.length > 0 ? cl.reduce((a,b) => a+b, 0) / cl.length : centroids[0]);
}

return data.map(d => {
  const v = d.value || 0;
  const dists = centroids.map(c => Math.abs(v - c));
  return { ...d, class: dists.indexOf(Math.min(...dists)) };
});`
      }
    ]
  },
  {
    category: 'Utilities',
    items: [
      {
        name: 'Noise Variance Estimator',
        code: `const cal = data.slice(0, 20).map(d => d.value || 0);
const mean = cal.reduce((a, b) => a + b, 0) / cal.length;
const variance = cal.reduce((a, v) => a + (v - mean) ** 2, 0) / cal.length;
console.log('Estimated Variance (R):', variance);
return data;`
      },
      {
        name: 'Null / NaN Interpolator',
        code: `// Linear interpolation for missing values
return data.map((row, i, arr) => {
  if (row.value !== null && row.value !== undefined && !isNaN(row.value)) return row;
  let prev = i - 1, next = i + 1;
  while (prev >= 0 && (arr[prev].value === null || arr[prev].value === undefined)) prev--;
  while (next < arr.length && (arr[next].value === null || arr[next].value === undefined)) next++;
  const vPrev = prev >= 0 ? arr[prev].value : 0;
  const vNext = next < arr.length ? arr[next].value : vPrev;
  const ratio = (prev >= 0 && next < arr.length) ? (i - prev) / (next - prev) : 0.5;
  return { ...row, value: vPrev + (vNext - vPrev) * ratio };
});`
      }
    ]
  }
];

function SnippetLibrary({ onInsert }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{
      width: '220px', flexShrink: 0, borderRight: '1px solid #ccc', backgroundColor: '#fafafa',
      overflowY: 'auto', fontSize: '12px', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '8px 10px', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid #ddd', color: '#555' }}>
        Snippet Library
      </div>
      {SNIPPETS.map((cat, ci) => (
        <div key={ci}>
          <div 
            onClick={() => setExpanded(expanded === ci ? null : ci)}
            style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 600, color: '#333', backgroundColor: expanded === ci ? '#e8e8e8' : 'transparent', borderBottom: '1px solid #eee' }}
          >
            {expanded === ci ? 'v' : '>'} {cat.category}
          </div>
          {expanded === ci && cat.items.map((snippet, si) => (
            <div key={si}
              onClick={() => onInsert(snippet.code)}
              style={{ padding: '5px 10px 5px 20px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', color: '#555' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e0e0ff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {snippet.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default SnippetLibrary;
