"use client";

import { useState, useEffect, useRef } from "react";
import LanguageSelector from "@/components/LanguageSelector";
import EditorComponent from "@/components/Editor";
import OutputPanel from "@/components/OutputPanel";
import FileTabs from "@/components/FileTabs";
import FileNamePopup from "@/components/FileNamePopup";
import { Play, Download, Plus, FileDown, FolderDown, Sun, Moon, History, Share2 } from "lucide-react";
import JSZip from "jszip";
import LZString from "lz-string";
import { getTemplateForFile, languageIds, languageTemplates } from "@/utils/templates";

/**
 * Main Application Component
 * 
 * This component acts as the main controller for the online compiler.
 * It manages the state for files, themes, editor language, and code execution.
 * Now supports multiple test cases and execution history.
 */
export default function Home() {
  // ==========================================
  // State Management
  // ==========================================

  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize with default values to prevent hydration mismatch
  const [language, setLanguage] = useState('javascript');

  const [files, setFiles] = useState([
    { id: "1", name: "main.js", content: "// Main entry point\nconsole.log('Hello from main!');", language: "javascript" }
  ]);

  const [activeFileId, setActiveFileId] = useState("1");

  const [testCases, setTestCases] = useState([
    { id: 1, input: "", output: null, status: "pending" }
  ]);

  const [activeTestCaseId, setActiveTestCaseId] = useState(1);
  const [history, setHistory] = useState([]);

  // UI States
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stdin, setStdin] = useState("");
  const [activeTab, setActiveTab] = useState("input");
  const [output, setOutput] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  const editorRef = useRef(null);

  // Derived state
  const currentCode = files.find(f => f.id === activeFileId)?.content || "";

  // ==========================================
  // Effects
  // ==========================================

  /**
   * Initialize State from LocalStorage
   * Runs only once on mount to avoid hydration mismatch.
   */
  useEffect(() => {
    setMounted(true);

    // Check for Shared URL Data First
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('data');

    if (sharedData) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(sharedData);
        if (decompressed) {
          const data = JSON.parse(decompressed);
          setLanguage(data.language);
          setFiles(data.files);
          setTestCases(data.testCases);
          setActiveFileId(data.files[0]?.id || "1");

          // Clear URL to clean up
          window.history.replaceState({}, document.title, window.location.pathname);
          return; // Skip loading local storage if shared data found
        }
      } catch (e) {
        console.error("Failed to restore shared code:", e);
      }
    }

    // Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    // Language
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) setLanguage(savedLanguage);

    // Files
    const savedFiles = localStorage.getItem('files');
    if (savedFiles) setFiles(JSON.parse(savedFiles));

    // Active File
    const savedActiveFileId = localStorage.getItem('activeFileId');
    if (savedActiveFileId) setActiveFileId(savedActiveFileId);

    // Test Cases
    const savedTestCases = localStorage.getItem('testCases');
    if (savedTestCases) setTestCases(JSON.parse(savedTestCases));

    // History
    const savedHistory = localStorage.getItem('executionHistory');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    // Stdin
    const savedStdin = localStorage.getItem('stdin');
    if (savedStdin) setStdin(savedStdin);

  }, []);

  useEffect(() => {
    if (!activeFileId) return;
    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) return;

    const getExtensionFromLanguage = (lang) => {
      const extensionMap = { javascript: 'js', python: 'py', cpp: 'cpp', java: 'java', c: 'c' };
      return extensionMap[lang] || 'txt';
    };

    const newExtension = getExtensionFromLanguage(language);
    const currentExtension = activeFile.name.split('.').pop();

    if (currentExtension !== newExtension) {
      const baseName = activeFile.name.split('.')[0];
      const newName = `${baseName}.${newExtension}`;
      const newTemplate = languageTemplates[language] || "";

      setFiles(prev => prev.map(f =>
        f.id === activeFileId
          ? { ...f, name: newName, content: newTemplate, language: language }
          : f
      ));
    }
  }, [language, activeFileId]);

  // Persistence
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('files', JSON.stringify(files)); }, [files]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('activeFileId', activeFileId); }, [activeFileId]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('language', language); }, [language]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('testCases', JSON.stringify(testCases)); }, [testCases]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('executionHistory', JSON.stringify(history)); }, [history]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files, activeFileId, testCases]);

  // ==========================================
  // Handlers
  // ==========================================

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleCodeChange = (newCode) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: newCode } : f));
  };

  const handleCreateFile = (fileName) => {
    const template = getTemplateForFile(fileName);
    const newFile = {
      id: Date.now().toString(),
      name: fileName,
      content: template || "",
      language: language
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id) => {
    if (files.length <= 1) return;
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    if (activeFileId === id) setActiveFileId(newFiles[0].id);
  };

  const handleRenameFile = (id, newName) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    const oldExtension = file.name.split('.').pop()?.toLowerCase();
    const newExtension = newName.split('.').pop()?.toLowerCase();
    const extensionToLanguage = { 'js': 'javascript', 'py': 'python', 'cpp': 'cpp', 'java': 'java', 'c': 'c' };

    if (oldExtension !== newExtension) {
      const newLang = extensionToLanguage[newExtension];
      if (newLang) {
        setLanguage(newLang);
        const newTemplate = languageTemplates[newLang] || "";
        setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName, content: newTemplate, language: newLang } : f));
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
      }
    } else {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    }
  };

  const handleClear = () => handleCodeChange("");
  const handleFormat = () => editorRef.current?.getAction('editor.action.formatDocument').run();

  const handleDownloadFile = () => {
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadOptions(false);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    files.forEach(file => zip.file(file.name, file.content));
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadOptions(false);
  };

  /**
   * Generates a unique shareable URL with the current code and inputs.
   */
  const handleShare = () => {
    const data = {
      language,
      files,
      testCases
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;

    navigator.clipboard.writeText(url).then(() => {
      alert("Shareable link copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link. See console for URL.");
      console.log("Share Link:", url);
    });
  };

  /**
   * Executes code for ALL active test cases in parallel.
   */
  const handleRun = async () => {
    setIsLoading(true);
    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) return;

    // Prepare common payload
    const basePayload = {
      files: files.map(f => ({ fileName: f.name, fileContent: f.content })),
      fileToCompile: activeFile.name,
      languageId: languageIds[language] || 63
    };

    try {
      // Run all test cases in parallel
      const results = await Promise.all(testCases.map(async (tc) => {
        try {
          const response = await fetch("https://g6y8h3p2k0.theeducode.com/student/compile-external", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...basePayload, input: tc.input || "" }),
          });

          const data = await response.json();

          if (data.success) {
            const { stdout, stderr, compile_output, status } = data.result;
            let outputText = "";
            if (status?.description) outputText += `Status: ${status.description}\n`;
            if (compile_output) outputText += `Compilation Output:\n${atob(compile_output)}\n`;
            if (stderr) outputText += `Error:\n${atob(stderr)}\n`;
            if (stdout) outputText += `Output:\n${atob(stdout)}\n`;
            if (!outputText) outputText = "Program executed successfully with no output.";

            return { ...tc, output: outputText, status: stderr || (status?.id > 3) ? 'error' : 'success' };
          } else {
            return { ...tc, output: data.message || "Unknown error", status: 'error' };
          }
        } catch (err) {
          return { ...tc, output: `Error: ${err.message}`, status: 'error' };
        }
      }));

      setTestCases(results);
      saveToHistory(results);

    } catch (error) {
      console.error("Execution error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Saves the current run to history
   * Limits history to the 10 most recent runs.
   */
  const saveToHistory = (results) => {
    const newHistoryItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      language,
      files: JSON.parse(JSON.stringify(files)), // Deep copy
      testCases: JSON.parse(JSON.stringify(results))
    };

    // Limit to 10 most recent items as requested
    const updatedHistory = [newHistoryItem, ...history].slice(0, 10);
    setHistory(updatedHistory);
  };

  /**
   * Restores a past submission
   */
  const restoreFromHistory = (item) => {
    if (confirm("Restore this version? current changes will be overwritten.")) {
      setLanguage(item.language);
      setFiles(item.files);
      setTestCases(item.testCases);
      setIsHistoryOpen(false);
    }
  };

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <main className="flex-1 flex flex-col p-6 gap-6 min-h-0 relative">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPopupOpen(true)}
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New File
            </button>

            <button
              onClick={toggleTheme}
              className="bg-card hover:bg-muted border border-border px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className={`bg-card hover:bg-muted border border-border px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${isHistoryOpen ? "bg-muted text-primary" : ""}`}
              title="Execution History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* <button
              onClick={handleShare}
              className="bg-card hover:bg-muted border border-border px-3 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors text-primary"
              title="Share Code"
            >
              <Share2 className="w-4 h-4" />
            </button> */}
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <LanguageSelector language={language} setLanguage={setLanguage} />

            <button
              onClick={handleRun}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isLoading ? "Running..." : "Run All Test Cases"}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ml-auto sm:ml-0"
              >
                <Download className="w-4 h-4" />
                Download
              </button>

              {showDownloadOptions && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1">
                  <button onClick={handleDownloadFile} className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2">
                    <FileDown className="w-4 h-4" /> Current File
                  </button>
                  <button onClick={handleDownloadZip} className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2">
                    <FolderDown className="w-4 h-4" /> Download All (ZIP)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Panel (Absolute Overlay) */}
        {isHistoryOpen && (
          <div className="absolute top-16 left-6 bottom-6 w-80 bg-card border border-border rounded-lg shadow-xl z-20 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/20 font-medium flex justify-between items-center">
              Execution History
              <button onClick={() => setIsHistoryOpen(false)} className="text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No history yet.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-3 border border-border rounded-md mb-2 bg-background hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold uppercase text-primary">{item.language}</span>
                      <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3 truncate">
                      {item.testCases.length} Test Cases | Status: {item.testCases.every(tc => tc.status === 'success') ? '✅' : '❌'}
                    </div>
                    <button
                      onClick={() => restoreFromHistory(item)}
                      className="w-full py-1 text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Editor */}
          <div className="lg:col-span-2 flex flex-col gap-4 h-full min-h-0">
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0">
                {mounted ? (
                  <EditorComponent
                    language={language}
                    code={currentCode}
                    setCode={handleCodeChange}
                    theme={theme}
                    onEditorMount={(editor) => editorRef.current = editor}
                    headerContent={
                      <FileTabs
                        files={files}
                        activeFileId={activeFileId}
                        onTabClick={setActiveFileId}
                        onDeleteFile={handleDeleteFile}
                        onRenameFile={handleRenameFile}
                        onClear={handleClear}
                      />
                    }
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-card border border-border rounded-lg">
                    <div className="text-muted-foreground">Loading editor...</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Test Cases Output */}
          <div className="lg:col-span-1 h-full min-h-0">
            <OutputPanel
              testCases={testCases}
              setTestCases={setTestCases}
              activeTestCaseId={activeTestCaseId}
              setActiveTestCaseId={setActiveTestCaseId}
              isLoading={isLoading}
              onRun={handleRun}
            />
          </div>
        </div>
      </main>

      <FileNamePopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onCreate={handleCreateFile}
      />
    </div>
  );
}
