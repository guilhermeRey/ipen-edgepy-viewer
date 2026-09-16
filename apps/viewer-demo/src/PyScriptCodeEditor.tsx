import { useEffect, useRef } from "react";

export function PyScriptCodeEditor({ value, onChange }: Readonly<{ value: string; onChange(value: string): void }>) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const latestValueRef = useRef(value);
  const editorRef = useRef<{ destroy(): void; state: { doc: { toString(): string } }; dispatch(transaction: { changes: { from: number; to: number; insert: string } }): void } | undefined>(undefined);
  latestValueRef.current = value;

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      import("@codemirror/lang-python"),
      import("@codemirror/state"),
      import("@codemirror/view"),
      import("@codemirror/theme-one-dark"),
    ]).then(([language, state, view, theme]) => {
      if (disposed || !hostRef.current) {
        return;
      }
      const editor = new view.EditorView({
        parent: hostRef.current,
        state: state.EditorState.create({
          doc: latestValueRef.current,
          extensions: [
            language.python(),
            theme.oneDark,
            view.EditorView.lineWrapping,
            view.EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChange(update.state.doc.toString());
              }
            }),
          ],
        }),
      });
      editorRef.current = editor;
    });
    return () => {
      disposed = true;
      editorRef.current?.destroy();
      editorRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.state.doc.toString() === value) {
      return;
    }
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.toString().length, insert: value } });
  }, [value]);

  return <div ref={hostRef} className="demo-pyscript-code-editor" aria-label="PyScript Python editor" />;
}
