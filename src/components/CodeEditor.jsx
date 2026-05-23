import { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { autocompletion } from '@codemirror/autocomplete';

function CodeEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value || '');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        autocompletion(),
        javascript(),
        keymap.of([...defaultKeymap, indentWithTab]),
        updateListener,
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px', overflow: 'hidden' },
          '.cm-scroller': { overflow: 'auto !important', fontFamily: 'Consolas, "Courier New", monospace' },
          '.cm-content': { caretColor: '#333' },
          '.cm-gutters': { backgroundColor: '#f5f5f5', borderRight: '1px solid #ddd', color: '#999' },
          '.cm-activeLine': { backgroundColor: 'rgba(47,111,189,0.05)' },
          '.cm-activeLineGutter': { backgroundColor: 'rgba(47,111,189,0.08)' }
        })
      ]
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => { view.destroy(); };
  }, []); // Only create once

  // Sync external value changes (e.g., snippet insertion, tab switch)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value || '' }
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  return <div ref={editorRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}

export default CodeEditor;
