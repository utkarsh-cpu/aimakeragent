import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { FileUpload, type FileUploadItem } from './FileUpload';
import { Badge } from './ui/badge';
import { 
  Paperclip, 
  X, 
  FileText, 
  Image as ImageIcon, 
  File,
  Download
} from 'lucide-react';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  preview?: string;
  content?: string; // For text files
}

interface AttachmentManagerProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxAttachments?: number;
  disabled?: boolean;
  className?: string;
}

export function AttachmentManager({
  attachments,
  onAttachmentsChange,
  maxAttachments = 5,
  disabled = false,
  className = '',
}: AttachmentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([]);

  const processFileContent = async (file: File): Promise<string | undefined> => {
    // Only process text files for content extraction
    if (!file.type.startsWith('text/') && 
        !file.type.includes('json') && 
        !file.type.includes('javascript') && 
        !file.type.includes('typescript')) {
      return undefined;
    }

    try {
      const content = await file.text();
      // Limit content size to prevent memory issues
      return content.length > 10000 ? content.substring(0, 10000) + '...' : content;
    } catch (error) {
      console.warn('Failed to read file content:', error);
      return undefined;
    }
  };

  const handleFilesSelected = useCallback(async (files: FileUploadItem[]) => {
    setUploadItems(prev => [...prev, ...files]);

    // Process files and convert to attachments
    const newAttachments: Attachment[] = [];
    
    for (const fileItem of files) {
      try {
        // Update file status to uploading
        setUploadItems(prev => 
          prev.map(item => 
            item.id === fileItem.id 
              ? { ...item, status: 'uploading', progress: 0 }
              : item
          )
        );

        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setUploadItems(prev => 
            prev.map(item => 
              item.id === fileItem.id 
                ? { ...item, progress }
                : item
            )
          );
        }

        // Process file content
        const content = await processFileContent(fileItem.file);
        
        // Create URL for file (in a real app, this would be uploaded to a server)
        const url = URL.createObjectURL(fileItem.file);

        const attachment: Attachment = {
          id: fileItem.id,
          name: fileItem.name,
          size: fileItem.size,
          type: fileItem.type,
          url,
          preview: fileItem.preview,
          content,
        };

        newAttachments.push(attachment);

        // Update file status to completed
        setUploadItems(prev => 
          prev.map(item => 
            item.id === fileItem.id 
              ? { ...item, status: 'completed' }
              : item
          )
        );

      } catch (error) {
        console.error('Failed to process file:', error);
        
        // Update file status to error
        setUploadItems(prev => 
          prev.map(item => 
            item.id === fileItem.id 
              ? { ...item, status: 'error', error: 'Failed to process file' }
              : item
          )
        );
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
  }, [attachments, onAttachmentsChange]);

  const handleFileRemove = useCallback((id: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleAttachmentRemove = (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (attachment?.url) {
      URL.revokeObjectURL(attachment.url);
    }
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    // Clear completed upload items after dialog closes
    setTimeout(() => {
      setUploadItems(prev => prev.filter(item => item.status !== 'completed'));
    }, 300);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('text/')) return FileText;
    return File;
  };

  const canAddMore = attachments.length < maxAttachments;

  return (
    <div className={className}>
      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.type);
            
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm border"
              >
                {attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.name}
                    className="w-4 h-4 object-cover rounded"
                  />
                ) : (
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                )}
                
                <span className="truncate max-w-32">{attachment.name}</span>
                
                <Badge variant="secondary" className="text-xs">
                  {formatFileSize(attachment.size)}
                </Badge>
                
                {attachment.url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = attachment.url!;
                      link.download = attachment.name;
                      link.click();
                    }}
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => handleAttachmentRemove(attachment.id)}
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Attachment Button */}
      {canAddMore && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Add files ({attachments.length}/{maxAttachments})
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Attachments</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <FileUpload
                onFilesSelected={handleFilesSelected}
                onFileRemove={handleFileRemove}
                maxFiles={maxAttachments - attachments.length}
                disabled={disabled}
              />
              
              {uploadItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Upload Progress</h4>
                  {/* FileUpload component handles displaying upload items */}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleDialogClose}>
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {!canAddMore && (
        <p className="text-xs text-muted-foreground">
          Maximum {maxAttachments} attachments reached
        </p>
      )}
    </div>
  );
}