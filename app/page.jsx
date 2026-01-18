"use client";

import { useState, useEffect, useRef } from "react";
import LanguageSelector from "@/components/LanguageSelector";
import EditorComponent from "@/components/Editor";
import OutputPanel from "@/components/OutputPanel";
import FileTabs from "@/components/FileTabs";
import FileNamePopup from "@/components/FileNamePopup";
import { Play, Download, Plus, FileDown, FolderDown, Sun, Moon } from "lucide-react";
import JSZip from "jszip";
import { getTemplateForFile, languageIds, languageTemplates } from "@/utils/templates";
import { toBase64 } from "@/utils/base64";



export default function Home() {
  // Theme state - initialize as 'dark' to match server render
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('language') || 'javascript';
    }
    return 'javascript';
  });

  // Multi mode state - Load from localStorage
  const [files, setFiles] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('files');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return [{ id: "1", name: "main.js", content: "// Main entry point\nconsole.log('Hello from main!');", language: "javascript" }];
  });

  const [activeFileId, setActiveFileId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeFileId') || "1";
    }
    return "1";
  });

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const [stdin, setStdin] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('stdin') || "";
    }
    return "";
  });

  const [activeTab, setActiveTab] = useState("input");
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const [output, setOutput] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const editorRef = useRef(null);

  // Get current code
  const currentCode = files.find(f => f.id === activeFileId)?.content || "";

  // Load theme from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  // Helper to get file extension from language
  const getExtensionFromLanguage = (lang) => {
    const extensionMap = {
      javascript: 'js',
      python: 'py',
      cpp: 'cpp',
      java: 'java',
      c: 'c'
    };
    return extensionMap[lang] || 'txt';
  };

  // Handle language change - update active file name and content
  useEffect(() => {
    if (!activeFileId) return;

    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) return;

    // Get the new extension
    const newExtension = getExtensionFromLanguage(language);
    const currentExtension = activeFile.name.split('.').pop();

    // Only update if extension is different
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
  }, [language]);

  // Save to localStorage whenever files change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('files', JSON.stringify(files));
    }
  }, [files]);

  // Save active file ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', activeFileId);
    }
  }, [activeFileId]);

  // Save stdin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('stdin', stdin);
    }
  }, [stdin]);

  // Save language
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language);
    }
  }, [language]);

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Keyboard Shortcuts
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
  }, [files, activeFileId, stdin]); // Dependencies for run/format

  const handleCodeChange = (newCode) => {
    setFiles(prev => prev.map(f =>
      f.id === activeFileId ? { ...f, content: newCode } : f
    ));
  };

  const handleCreateFile = (fileName) => {
    const template = getTemplateForFile(fileName);
    const newFile = {
      id: Date.now().toString(),
      name: fileName,
      content: template || "",
      language: language // Inherit current language or default
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id) => {
    if (files.length <= 1) return; // Prevent deleting the last file

    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);

    if (activeFileId === id) {
      setActiveFileId(newFiles[0].id);
    }
  };

  const handleRenameFile = (id, newName) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    const oldExtension = file.name.split('.').pop()?.toLowerCase();
    const newExtension = newName.split('.').pop()?.toLowerCase();

    // If extension changed, update template and language
    if (oldExtension !== newExtension) {
      // Map extension to language
      const extensionToLanguage = {
        'js': 'javascript',
        'py': 'python',
        'cpp': 'cpp',
        'java': 'java',
        'c': 'c'
      };

      const newLang = extensionToLanguage[newExtension];

      if (newLang) {
        // Update language selector
        setLanguage(newLang);

        // Update file with new template
        const newTemplate = languageTemplates[newLang] || "";
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, name: newName, content: newTemplate, language: newLang } : f
        ));
      } else {
        // Just rename if extension not recognized
        setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, name: newName } : f
        ));
      }
    } else {
      // Just rename if extension didn't change
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, name: newName } : f
      ));
    }
  };

  const handleClear = () => {
    handleCodeChange("");
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

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
    files.forEach(file => {
      zip.file(file.name, file.content);
    });

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

  const handleRun = async () => {
    setIsLoading(true);
    setOutput(null);
    setActiveTab("output");

    try {
      const activeFile = files.find(f => f.id === activeFileId);
      if (!activeFile) return;

      const payload = {
        files: files.map(f => ({
          fileName: f.name,
          fileContent: f.content
        })),
        input: stdin,
        fileToCompile: activeFile.name,
        languageId: languageIds[language] || 63 // Default to JS if not found
      };

      // Call API directly from browser to avoid server-side SSL validation issues
      const response = await fetch("https://g6y8h3p2k0.theeducode.com/student/compile-external", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        // Judge0 result usually has stdout, stderr, compile_output
        const { stdout, stderr, compile_output, status } = data.result;

        let outputText = "";
        if (status && status.description) {
          outputText += `Status: ${status.description}\n`;
        }
        if (compile_output) {
          outputText += `Compilation Output:\n${atob(compile_output)}\n`;
        }
        if (stderr) {
          outputText += `Error:\n${atob(stderr)}\n`;
        }
        if (stdout) {
          outputText += `Output:\n${atob(stdout)}\n`;
        }

        if (!outputText) {
          outputText = "Program executed successfully with no output.";
        }

        setOutput(outputText);
      } else {
        setOutput(`Error: ${data.message || "Unknown error occurred"}`);
      }
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <main className="flex-1 flex flex-col p-6 gap-6 min-h-0">
        {/* Top Bar */}
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
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <LanguageSelector language={language} setLanguage={setLanguage} />

            <button
              onClick={handleRun}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ctrl + Enter"
            >
              <Play className="w-4 h-4" />
              {isLoading ? "Running..." : "Compile & Run"}
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
                  <button
                    onClick={handleDownloadFile}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Current File
                  </button>
                  <button
                    onClick={handleDownloadZip}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <FolderDown className="w-4 h-4" />
                    Download All (ZIP)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area - Always Side-by-Side */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Editor Section */}
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

          {/* Output Section */}
          <div className="lg:col-span-1 h-full min-h-0">
            <OutputPanel
              output={output}
              isLoading={isLoading}
              stdin={stdin}
              setStdin={setStdin}
              activeTab={activeTab}
              onTabChange={setActiveTab}
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
