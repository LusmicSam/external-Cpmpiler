"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import LanguageSelector from "@/components/LanguageSelector";
import EditorComponent from "@/components/Editor";
import OutputPanel from "@/components/OutputPanel";
import FileTabs from "@/components/FileTabs";
import FileNamePopup from "@/components/FileNamePopup";
import { Play, Download, Plus, FileDown, FolderDown } from "lucide-react";
import JSZip from "jszip";
import { getTemplateForFile, languageIds } from "@/utils/templates";
import { toBase64 } from "@/utils/base64";



export default function Home() {
  const [language, setLanguage] = useState("javascript");

  // Multi mode state (Default and only mode now)
  const [files, setFiles] = useState([
    { id: "1", name: "main.js", content: "// Main entry point\nconsole.log('Hello from main!');", language: "javascript" }
  ]);
  const [activeFileId, setActiveFileId] = useState("1");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [stdin, setStdin] = useState("");
  const [activeTab, setActiveTab] = useState("input");
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const [output, setOutput] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const editorRef = useRef(null);

  // Get current code
  const currentCode = files.find(f => f.id === activeFileId)?.content || "";

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
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, name: newName } : f
    ));
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

      const response = await fetch("https://g6y8h3p2kz.theeducode.com/student/compile-external", {
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
          <button
            onClick={() => setIsPopupOpen(true)}
            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New File
          </button>

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
                <EditorComponent
                  language={language}
                  code={currentCode}
                  setCode={handleCodeChange}
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
