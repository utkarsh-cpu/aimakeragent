import { useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  File,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  status: "pending" | "uploading" | "completed" | "error";
  progress?: number;
  error?: string;
}

interface FileUploadProps {
  onFilesSelected: (files: FileUploadItem[]) => void;
  onFileRemove: (id: string) => void;
  maxFileSize?: number; // in MB
  maxFiles?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPTED_TYPES = [
  "image/*",
  "text/*",
  "application/pdf",
  "application/json",
  "application/javascript",
  "application/typescript",
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 5;

export function FileUpload({
  onFilesSelected,
  onFileRemove,
  maxFileSize = MAX_FILE_SIZE_MB,
  maxFiles = MAX_FILES,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  className = "",
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFiles = useCallback(
    async (fileList: FileList) => {
      if (disabled) return;

      const validateFile = (file: File): string | null => {
        // Check file size
        if (file.size > maxFileSize * 1024 * 1024) {
          return `File size exceeds ${maxFileSize}MB limit`;
        }

        // Check file type
        const isAccepted = acceptedTypes.some((type) => {
          if (type.endsWith("/*")) {
            const category = type.split("/")[0];
            return file.type.startsWith(category + "/");
          }
          return file.type === type;
        });

        if (!isAccepted) {
          return "File type not supported";
        }

        return null;
      };

      const createFileItem = async (file: File): Promise<FileUploadItem> => {
        const id = Math.random().toString(36).substring(2, 15);
        const item: FileUploadItem = {
          id,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "pending",
        };

        // Create preview for images
        if (file.type.startsWith("image/")) {
          try {
            const preview = await createImagePreview(file);
            item.preview = preview;
          } catch (error) {
            console.warn("Failed to create image preview:", error);
          }
        }

        return item;
      };

      const newFiles: FileUploadItem[] = [];
      const errors: string[] = [];

      // Check total file count
      if (files.length + fileList.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const error = validateFile(file);

        if (error) {
          errors.push(`${file.name}: ${error}`);
          continue;
        }

        try {
          const fileItem = await createFileItem(file);
          newFiles.push(fileItem);
        } catch (error) {
          errors.push(`${file.name}: Failed to process file`);
        }
      }

      if (newFiles.length > 0) {
        const updatedFiles = [...files, ...newFiles];
        setFiles(updatedFiles);
        onFilesSelected(newFiles);
      }

      if (errors.length > 0) {
        console.error("File upload errors:", errors);
        // You could show these errors in a toast or alert
      }
    },
    [files, maxFiles, maxFileSize, acceptedTypes, disabled, onFilesSelected],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles);
      }
    },
    [disabled, processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        processFiles(selectedFiles);
      }
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles],
  );

  const handleRemoveFile = (id: string) => {
    const updatedFiles = files.filter((f) => f.id !== id);
    setFiles(updatedFiles);
    onFileRemove(id);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type.startsWith("text/")) return FileText;
    return File;
  };

  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-1">
          {isDragOver
            ? "Drop files here"
            : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground">
          Max {maxFiles} files, {maxFileSize}MB each
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((fileItem) => {
            const FileIcon = getFileIcon(fileItem.type);

            return (
              <div
                key={fileItem.id}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border"
              >
                {/* File Preview/Icon */}
                <div className="flex-shrink-0">
                  {fileItem.preview ? (
                    <img
                      src={fileItem.preview}
                      alt={fileItem.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {fileItem.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileItem.size)}
                  </p>

                  {/* Progress Bar */}
                  {fileItem.status === "uploading" &&
                    fileItem.progress !== undefined && (
                      <Progress
                        value={fileItem.progress}
                        className="mt-1 h-1"
                      />
                    )}

                  {/* Error Message */}
                  {fileItem.status === "error" && fileItem.error && (
                    <p className="text-xs text-destructive mt-1">
                      {fileItem.error}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {fileItem.status === "completed" && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {fileItem.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  {fileItem.status === "uploading" && (
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(fileItem.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* File Type Info */}
      <div className="mt-2 text-xs text-muted-foreground">
        <p>
          Supported formats: Images, Text files, PDF, JSON, JavaScript,
          TypeScript
        </p>
      </div>
    </div>
  );
}
