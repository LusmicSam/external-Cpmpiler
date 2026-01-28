"use client";

import Editor, { loader } from "@monaco-editor/react";
import { useRef, useState, useEffect } from "react";
import { ZoomIn, ZoomOut, Undo2, Redo2, Loader2, RotateCcw } from "lucide-react";

/**
 * EditorComponent
 * 
 * Wrapper around the Monaco Editor.
 * customizable with themes, language, and content.
 * Includes Zoom and Undo/Redo controls.
 * Uses local monaco-editor instance via dynamic import to avoid SSR issues.
 * 
 * @component
 * @param {Object} props
 * @param {string} props.language - The programming language ID (e.g., 'javascript').
 * @param {string} props.code - The current code content.
 * @param {function(string): void} props.setCode - Callback to update code content.
 * @param {string} [props.theme='dark'] - Editor theme ('dark' or 'light').
 * @param {React.ReactNode} [props.headerContent] - Optional content to render in the header.
 * @param {function(Object): void} [props.onEditorMount] - Callback when editor mounts.
 */
export default function EditorComponent({
    language,
    code,
    setCode,
    theme = "dark",
    headerContent,
    onEditorMount,
    onReset
}) {
    const editorRef = useRef(null);
    const [fontSize, setFontSize] = useState(14);
    const [isMonacoReady, setIsMonacoReady] = useState(false);

    useEffect(() => {
        // Dynamically import monaco-editor on client-side only
        import("monaco-editor").then((monaco) => {
            loader.config({ monaco: monaco.default || monaco });
            setIsMonacoReady(true);
        });
    }, []);

    /**
     * Handles editor mount event.
     * Configures custom themes and exposes the editor instance.
     * 
     * @param {Object} editor - The Monaco editor instance.
     * @param {Object} monaco - The Monaco API instance.
     */
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        if (onEditorMount) onEditorMount(editor);

        // Define custom themes
        monaco.editor.defineTheme('custom-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#0f172a', // Matches Tailwind slate-900 or card bg
                'editor.selectionBackground': '#3b82f660', // Visible selection color (increased opacity)
            }
        });

        monaco.editor.defineTheme('custom-light', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#ffffff',
                'editor.selectionBackground': '#bae6fdaa', // Visible selection color (light blue, higher opacity)
            }
        });

        // Set theme based on prop
        monaco.editor.setTheme(theme === 'dark' ? 'custom-dark' : 'custom-light');
    };

    const handleZoomIn = () => setFontSize(prev => Math.min(prev + 2, 32));
    const handleZoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));

    const handleUndo = () => {
        editorRef.current?.trigger('toolbar', 'undo');
        editorRef.current?.focus();
    };

    const handleRedo = () => {
        editorRef.current?.trigger('toolbar', 'redo');
        editorRef.current?.focus();
    };

    return (
        <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-card flex flex-col">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border h-10 shrink-0">
                <div className="flex items-center gap-2">
                    {headerContent ? (
                        headerContent
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground">Program</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {onReset && (
                        <>
                            <button
                                onClick={onReset}
                                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                title="Reset Code"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <div className="w-px h-4 bg-border mx-1" />
                        </>
                    )}
                    <button
                        onClick={handleZoomIn}
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn size={16} />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <button
                        onClick={handleUndo}
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title="Undo"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        onClick={handleRedo}
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title="Redo"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>
            </div>

            {/* Monaco Editor Instance */}
            <div className="flex-1 relative">
                {!isMonacoReady ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Loading Editor...</span>
                        </div>
                    </div>
                ) : (
                    <Editor
                        height="100%"
                        language={language}
                        value={code}
                        onChange={(value) => setCode(value || "")}
                        onMount={handleEditorDidMount}
                        theme={theme === 'dark' ? 'custom-dark' : 'custom-light'}
                        options={{
                            minimap: { enabled: true },
                            fontSize: fontSize,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 16, bottom: 16 },
                            formatOnType: true,
                            formatOnPaste: true,
                            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                            mouseWheelZoom: true,
                        }}
                    />
                )}
            </div>
        </div>
    );
}
