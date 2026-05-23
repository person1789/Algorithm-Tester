import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import CodeEditor from './CodeEditor';

function EditorPane({ pipeline, setPipeline }) {
  const [activeStepId, setActiveStepId] = useState(pipeline[0]?.id || 1);

  const addStep = () => {
    const newId = pipeline.length > 0 ? Math.max(...pipeline.map(s => s.id)) + 1 : 1;
    const newStep = {
      id: newId,
      name: `Step ${newId}`,
      code: '// data is the output from the previous step\nreturn data;'
    };
    setPipeline([...pipeline, newStep]);
    setActiveStepId(newId);
  };

  const removeStep = (id, e) => {
    e.stopPropagation();
    const newPipeline = pipeline.filter(s => s.id !== id);
    if (newPipeline.length === 0) {
      newPipeline.push({ id: 1, name: 'Step 1', code: 'return data;' });
    }
    setPipeline(newPipeline);
    if (activeStepId === id) {
      setActiveStepId(newPipeline[newPipeline.length - 1].id);
    }
  };

  const updateCode = (newCode) => {
    setPipeline(pipeline.map(s => s.id === activeStepId ? { ...s, code: newCode } : s));
  };

  const updateName = (e, id) => {
    setPipeline(pipeline.map(s => s.id === id ? { ...s, name: e.target.value } : s));
  };

  const activeStep = pipeline.find(s => s.id === activeStepId);

  return (
    <div className="pane-content" style={{ flexDirection: 'column', padding: '0' }}>
      <div className="pipeline-tabs" style={{ display: 'flex', borderBottom: '1px solid #ccc', backgroundColor: '#e0e0e0', overflowX: 'auto' }}>
        {pipeline.map((step) => (
          <div 
            key={step.id} 
            className={`pipeline-tab ${activeStepId === step.id ? 'active' : ''}`}
            onClick={() => setActiveStepId(step.id)}
            style={{ 
              padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: activeStepId === step.id ? '#fafafa' : 'transparent',
              borderRight: '1px solid #ccc',
              borderBottom: activeStepId === step.id ? '2px solid #2f6fbd' : 'none'
            }}
          >
            <input 
              value={step.name} 
              onChange={(e) => updateName(e, step.id)} 
              onClick={(e) => e.stopPropagation()}
              style={{ border: 'none', background: 'transparent', width: '80px', outline: 'none', fontSize: '13px' }}
            />
            {pipeline.length > 1 && (
              <X size={14} onClick={(e) => removeStep(step.id, e)} style={{ opacity: 0.5, cursor: 'pointer' }} />
            )}
          </div>
        ))}
        <button onClick={addStep} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px' }} title="Add Step">
          <Plus size={16} />
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <CodeEditor
          value={activeStep ? activeStep.code : ''}
          onChange={updateCode}
        />
      </div>
    </div>
  );
}

export default EditorPane;
