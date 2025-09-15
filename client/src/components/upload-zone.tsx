import { useState, useCallback, useRef, useEffect } from "react";
import { CloudUpload, X, Edit, Trash2, FileText } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { uploadFiles, uploadFilesDirect, deleteFile, updateFile } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import CustomPopup from "./custom-popup";
import CustomConfirmationDialog from "./custom-confirmation-dialog";
import { useNotifications } from "./notifications";

export default function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ progress: 0, speed: 0, speedFormatted: "0 KB/s" });
  const [uploadStartTime, setUploadStartTime] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const [popup, setPopup] = useState({ 
    isOpen: false, 
    type: 'success' as 'success' | 'error' | 'info', 
    title: '', 
    message: '' 
  });
  

  const [editDialog, setEditDialog] = useState({
    isOpen: false,
    fileId: '',
    fileName: '',
    newFileName: ''
  });

  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    fileId: '',
    fileName: ''
  });

  // Get recent uploads for this user
  const { data: recentFiles, refetch: refetchFiles } = useQuery({
    queryKey: ["/api/files", { limit: 10 }],
    staleTime: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setUploadStartTime(Date.now());
      
      // Use direct S3 upload for better performance and no size limits
      const result = await uploadFilesDirect(files, undefined, (progressInfo) => {
        setUploadProgress(progressInfo);
      });
      
      // Add original file count for fallback
      return { ...result, originalFileCount: files.length };
    },
    onSuccess: (data) => {
      // Use files array length if available, otherwise fall back to original count
      const fileCount = data.files?.length ?? data.originalFileCount ?? 0;
      
      // Show popup
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'Upload Successful',
        message: `${fileCount} file(s) uploaded successfully`
      });
      
      // Add notification with real file data
      if (data.files && data.files.length > 0) {
        data.files.forEach((file: any) => {
          addNotification({
            type: 'upload',
            title: 'File Upload Complete',
            message: `Your file "${file.originalName}" has been successfully uploaded.`,
            read: false
          });
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      refetchFiles(); // Refresh recent files
      setUploadProgress({ progress: 0, speed: 0, speedFormatted: "0 KB/s" });
    },
    onError: (error) => {
      // Parse specific validation errors for better user experience
      let title = 'Upload Failed';
      let message = error.message;

      // Check for file size validation error
      if (error.message.includes('Number must be greater than 0') && error.message.includes('size')) {
        title = 'Invalid File Size';
        message = 'One or more files are empty (0 bytes). Please select files with content and try again.';
      } 
      // Check for other common validation errors
      else if (error.message.includes('File type') && error.message.includes('not supported')) {
        title = 'Unsupported File Type';
        message = 'The selected file type is not supported. Please choose a different file format.';
      }
      // File upload errors (no size limits)
      else if (error.message.includes('File too large') || error.message.includes('exceeds')) {
        title = 'Upload Error';
        message = 'There was an issue uploading your file. Please try again.';
      }
      // Check for network or server errors
      else if (error.message.includes('Network') || error.message.includes('fetch')) {
        title = 'Connection Error';
        message = 'Unable to upload file due to network issues. Please check your connection and try again.';
      }

      setPopup({
        isOpen: true,
        type: 'error',
        title,
        message
      });
      setUploadProgress({ progress: 0, speed: 0, speedFormatted: "0 KB/s" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'File Deleted',
        message: 'File has been deleted successfully'
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      refetchFiles();
    },
    onError: (error) => {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Delete Failed',
        message: error.message
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ fileId, updates }: { fileId: string; updates: any }) => 
      updateFile(fileId, updates),
    onSuccess: () => {
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'File Updated',
        message: 'File name has been updated successfully'
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      refetchFiles();
      setEditDialog({ isOpen: false, fileId: '', fileName: '', newFileName: '' });
    },
    onError: (error) => {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: error.message
      });
    },
  });

  const handleCancelUpload = () => {
    // Cancel the upload mutation
    uploadMutation.reset();
    setUploadProgress({ progress: 0, speed: 0, speedFormatted: "0 KB/s" });
    setPopup({
      isOpen: true,
      type: 'info',
      title: 'Upload Cancelled',
      message: 'File upload has been cancelled'
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // File validation function (unlimited size and count)
  const validateFiles = (files: FileList): { valid: File[], invalid: { file: File, reason: string }[] } => {
    const valid: File[] = [];
    const invalid: { file: File, reason: string }[] = [];

    // Only check for empty files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size === 0) {
        invalid.push({
          file,
          reason: `File "${file.name}" is empty (0 bytes).`
        });
      } else {
        valid.push(file);
      }
    }

    return { valid, invalid };
  };

  const processFiles = (files: FileList) => {
    const { valid, invalid } = validateFiles(files);
    
    if (invalid.length > 0) {
      // Show custom themed popup for file size/count errors
      const errorMessages = invalid.map(item => item.reason).join('\n');
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Upload Limit Exceeded',
        message: errorMessages
      });
      
      // If some files are valid, ask user if they want to proceed with valid files
      if (valid.length > 0) {
        setTimeout(() => {
          const shouldProceed = confirm(
            `${invalid.length} file(s) were rejected due to size/count limits.\n\nDo you want to proceed with uploading the ${valid.length} valid file(s)?`
          );
          if (shouldProceed) {
            // Create a proper FileList from valid files without DataTransfer
            // which can lose file properties
            const validFileList = {
              length: valid.length,
              item: (index: number) => valid[index] || null,
              [Symbol.iterator]: function* () { yield* valid; },
              ...valid.reduce((obj, file, index) => ({ ...obj, [index]: file }), {})
            } as FileList;
            uploadMutation.mutate(validFileList);
          }
        }, 2000);
      }
    } else if (valid.length > 0) {
      // Use original files directly to preserve all file properties
      uploadMutation.mutate(files);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [uploadMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    
    if (files && files.length > 0) {
      // Create a proper FileList copy to avoid issues when input is cleared
      const filesCopy = {
        length: files.length,
        item: (index: number) => files[index] || null,
        [Symbol.iterator]: function* () { 
          for (let i = 0; i < files.length; i++) {
            yield files[i];
          }
        },
        ...Array.from(files).reduce((obj, file, index) => ({ ...obj, [index]: file }), {})
      } as FileList;
      
      // Reset the input first to avoid FileList reference issues
      e.target.value = '';
      
      // Process with the stable copy
      processFiles(filesCopy);
    } else {
      // Reset the input so the same files can be selected again
      e.target.value = '';
    }
  }, [uploadMutation]);

  const handleEditFile = (file: any) => {
    setEditDialog({
      isOpen: true,
      fileId: file.id,
      fileName: file.originalName,
      newFileName: file.originalName
    });
  };

  const handleDeleteFile = (file: any) => {
    setConfirmDelete({
      isOpen: true,
      fileId: file.id,
      fileName: file.originalName
    });
  };

  const confirmEdit = () => {
    if (editDialog.newFileName.trim() && editDialog.newFileName !== editDialog.fileName) {
      editMutation.mutate({
        fileId: editDialog.fileId,
        updates: { originalName: editDialog.newFileName.trim() }
      });
    } else {
      setEditDialog({ isOpen: false, fileId: '', fileName: '', newFileName: '' });
    }
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate(confirmDelete.fileId);
    setConfirmDelete({ isOpen: false, fileId: '', fileName: '' });
  };

  const files = (recentFiles as any)?.files || [];
  const userFiles = files.slice(0, 5); // Show last 5 uploaded files

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8" id="upload">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-6xl font-gaming font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent animate-float">
          UPLOAD YOUR FILES
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          Upload and share your gaming files, mods, tools, and configs with the community. 
          Fast, secure, and optimized for gamers.
        </p>

        {/* Upload Zone */}
        <div 
          className={cn(
            "upload-zone glow-border rounded-xl p-12 mb-8 cursor-pointer relative overflow-hidden",
            isDragOver && "drag-over"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="upload-zone"
        >
          <div className="relative z-10 pointer-events-none">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
              <CloudUpload className="text-4xl text-primary" />
            </div>
            <h3 className="text-2xl font-gaming font-semibold mb-4 text-foreground">
              Drag & Drop Multiple Files Here
            </h3>
            <p className="text-muted-foreground mb-4">
              or <span className="text-primary font-semibold cursor-pointer hover:underline">browse files</span> to upload
            </p>
          </div>
          <input 
            ref={fileInputRef}
            id="file-input"
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
            multiple 
            onChange={handleFileSelect}
            accept=".apk,.xapk,.exe,.bat,.zip,.rar,.7z,.cfg,.config,.ini,.json,.xml,.txt,.md,.log,.sh,.py,.js,.html,.css,.reg"
            data-testid="file-input"
          />
        </div>

        {/* Upload Progress */}
        {uploadMutation.isPending && (
          <div className="bg-card rounded-lg p-6 border border-border glow-border shadow-lg shadow-black/30" data-testid="upload-progress">
            <div className="flex items-center justify-between mb-4">
              <span className="text-foreground font-medium">Uploading files...</span>
              <div className="flex items-center space-x-3">
                <span className="text-primary font-bold text-lg">{uploadProgress.progress}%</span>
                <Button
                  onClick={handleCancelUpload}
                  variant="outline"
                  size="sm"
                  className="bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  data-testid="cancel-upload-button"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
            <Progress value={uploadProgress.progress} className="w-full h-3" />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">
                  {uploadProgress.progress < 100 ? "Uploading..." : "Processing..."}
                </span>
              </div>
              {uploadProgress.speed > 0 && (
                <div className="text-sm text-accent font-medium">
                  {uploadProgress.speedFormatted}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recently Uploaded Files Management */}
        {userFiles.length > 0 && (
          <div className="mt-12 max-w-4xl mx-auto">
            <h3 className="text-2xl font-gaming font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent text-center">
              Recently Uploaded Files
            </h3>
            <div className="space-y-3">
              {userFiles.map((file: any) => (
                <div key={file.id} className="bg-card/50 border border-border/50 rounded-lg p-4 backdrop-blur-sm shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/30 transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{file.originalName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {file.sizeFormatted} • {file.category} • {file.uploadedAtFormatted}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handleEditFile(file)}
                        size="sm"
                        variant="outline"
                        className="bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDeleteFile(file)}
                        size="sm"
                        variant="outline"
                        className="bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit File Name Dialog */}
        {editDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditDialog({ isOpen: false, fileId: '', fileName: '', newFileName: '' })}
            />
            <div className="relative bg-background border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <Edit className="w-6 h-6 text-blue-500" />
                  <h2 className="text-lg font-semibold text-foreground">Edit File Name</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditDialog({ isOpen: false, fileId: '', fileName: '', newFileName: '' })}
                  className="w-8 h-8 hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6">
                <p className="text-muted-foreground mb-4">Enter a new name for the file:</p>
                <Input
                  value={editDialog.newFileName}
                  onChange={(e) => setEditDialog(prev => ({ ...prev, newFileName: e.target.value }))}
                  placeholder="Enter new file name"
                  className="w-full mb-4"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmEdit();
                    }
                  }}
                />
                {editDialog.fileName && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground">
                      Current: <span className="text-primary">{editDialog.fileName}</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setEditDialog({ isOpen: false, fileId: '', fileName: '', newFileName: '' })}
                  className="min-w-20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmEdit}
                  className="min-w-20 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!editDialog.newFileName.trim() || editDialog.newFileName === editDialog.fileName}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Update
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <CustomConfirmationDialog
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete({ isOpen: false, fileId: '', fileName: '' })}
          onConfirm={handleConfirmDelete}
          type="delete"
          title="Delete File"
          message="Are you sure you want to delete this file? This action cannot be undone."
          fileName={confirmDelete.fileName}
        />

        <CustomPopup
          isOpen={popup.isOpen}
          onClose={() => setPopup(prev => ({ ...prev, isOpen: false }))}
          type={popup.type}
          title={popup.title}
          message={popup.message}
        />
      </div>
    </section>
  );
}
