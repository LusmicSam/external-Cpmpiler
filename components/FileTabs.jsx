import { useState, useRef, useEffect } from "react";
import { X, RotateCcw } from "lucide-react";

/**
 * FileTabs Component
 * 
 * Displays a tab bar for the open files.
 * Supports switching active files, renaming (double-click), deleting, and clearing code.
 * 
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.files - List of open file objects.
 * @param {string} props.activeFileId - ID of the currently active file.
 * @param {function(string): void} props.onTabClick - Callback to set active file.
 * @param {function(string): void} props.onDeleteFile - Callback to delete a file.
 * @param {function(string, string): void} props.onRenameFile - Callback to rename a file.
 * @param {function(): void} props.onClear - Callback to clear the content of the active file.
 */
export default function FileTabs({
    files,
    activeFileId,
    onTabClick,
    onDeleteFile,
    onRenameFile,
    onClear
}) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const inputRef = useRef(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    /**
     * Enters edit mode for a file name.
     * @param {Object} file - The file object to rename.
     */
    const startEditing = (file) => {
        setEditingId(file.id);
        setEditName(file.name);
    };

    /**
     * Saves the edited file name.
     * Validates the new name and extension.
     */
    const saveEditing = () => {
        if (!editingId || !editName.trim()) {
            setEditingId(null);
            return;
        }

        const validExtensions = ['js', 'py', 'cpp', 'java', 'c'];

        // Check if file has an extension
        const parts = editName.trim().split('.');
        if (parts.length < 2) {
            alert("Please include a valid file extension (.js, .py, .cpp, .java, .c)");
            setEditingId(null); // Exit edit mode
            return;
        }

        const extension = parts[parts.length - 1].toLowerCase();
        if (!validExtensions.includes(extension)) {
            alert(`Invalid extension. Use: ${validExtensions.map(e => '.' + e).join(', ')}`);
            setEditingId(null); // Exit edit mode
            return;
        }

        onRenameFile(editingId, editName.trim());
        setEditingId(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            saveEditing();
        } else if (e.key === "Escape") {
            setEditingId(null);
        }
    };

    return (
        <div className="flex items-center justify-between w-full gap-2">
            {/* Scrollable Tabs Container */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-1 pb-1">
                {files.map((file) => (
                    <div
                        key={file.id}
                        onClick={() => onTabClick(file.id)}
                        onDoubleClick={() => startEditing(file)}
                        className={`
              group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm font-medium cursor-pointer border-t border-x border-transparent min-w-[100px] justify-between
              ${activeFileId === file.id
                                ? "bg-background border-border text-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }
            `}
                    >
                        {editingId === file.id ? (
                            <input
                                ref={inputRef}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={saveEditing}
                                onKeyDown={handleKeyDown}
                                className="bg-transparent border-none outline-none w-full h-full p-0 text-sm"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <>
                                <span className="truncate max-w-[120px]">{file.name}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteFile(file.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 hover:bg-background/50 rounded p-0.5 transition-opacity"
                                    title="Close"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>


        </div>
    );
}
