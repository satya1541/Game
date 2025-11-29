import { useState, useRef, useEffect } from "react";
import { CloudUpload, X, Edit, Trash2, FileText, Lock, Unlock, FolderPlus } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { uploadFiles, uploadFilesDirect, deleteFile, updateFile, lockFile, unlockFile } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import CustomPopup from "./custom-popup";
import CustomConfirmationDialog from "./custom-confirmation-dialog";
import { useNotifications } from "./notifications";
import uploadGif from "@assets/Uploading to cloud_1759562035510.gif";
import { motion, AnimatePresence } from "framer-motion";

import apkIcon from "@assets/apk file_1759147327484.png";
import rarZipIcon from "@assets/rar-zip_1759147327478.png";
import emulatorIcon from "@assets/emulator-file_1759147327480.png";
import softwareIcon from "@assets/software-exe file_1759147327481.png";
import scriptIcon from "@assets/script file_1759147327482.png";

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'apks': return apkIcon;
    case 'softwares': return softwareIcon;
    case 'scripts': return scriptIcon;
    case 'archives': return rarZipIcon;
    case 'emulators': return emulatorIcon;
    case 'configs': return scriptIcon;
    default: return softwareIcon;
  }
};

export default function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ progress: 0, speed: 0, speedFormatted: "0 KB/s" });
  const [uploadStartTime, setUploadStartTime] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
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

  const [lockDialog, setLockDialog] = useState({
    isOpen: false,
    fileId: '',
    fileName: '',
    mode: 'lock' as 'lock' | 'unlock',
    pin: '',
    confirmPin: '',
    error: ''
  });

  const [createFolderDialog, setCreateFolderDialog] = useState({
    isOpen: false,
    folderName: ''
  });

  // Map between actual category values (used in database) and display names
  const FOLDER_DISPLAY_NAMES: Record<string, string> = {
    'softwares': 'Software',
    'videos': 'Video',
    'images': 'Image',
    'apks': 'APK',
    'scripts': 'Script',
    'archives': 'Archive',
    'configs': 'Config',
    'emulators': 'Emulator',
    'regs': 'Registry'
  };
  
  // Get display name from category value
  const getFolderDisplayName = (categoryValue: string): string => {
    return FOLDER_DISPLAY_NAMES[categoryValue.toLowerCase()] || categoryValue;
  };
  
  // Category values used in database (keys of the mapping)
  const PREDEFINED_FOLDER_VALUES = Object.keys(FOLDER_DISPLAY_NAMES);

  // Get recent uploads for this user
  const { data: recentFiles, refetch: refetchFiles } = useQuery({
    queryKey: ["/api/files", { limit: 10 }],
    staleTime: 30000,
  });

  // Get custom folders
  const { data: foldersData } = useQuery({
    queryKey: ["/api/folders"],
    staleTime: 60000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setUploadStartTime(Date.now());

      // Create new AbortController for this upload
      abortControllerRef.current = new AbortController();

      // Use direct S3 upload for better performance and no size limits
      const result = await uploadFilesDirect(
        files, 
        undefined, 
        (progressInfo) => {
          setUploadProgress(progressInfo);
        },
        abortControllerRef.current.signal
      );

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
      // Normalize error object to ensure .message exists
      const errorMessage = error?.message || String(error);
      
      // Check if upload was cancelled
      if (errorMessage.includes('cancelled') || errorMessage.includes('aborted')) {
        setUploadProgress({ progress: 0, speed: 0, speedFormatted: "0 KB/s" });
        // Show cancellation message
        setPopup({
          isOpen: true,
          type: 'info',
          title: 'Upload Cancelled',
          message: 'File upload has been cancelled'
        });
        return;
      }

      // Parse specific validation errors for better user experience
      let title = 'Upload Failed';
      let message = errorMessage;

      // Check for file size validation error
      if (errorMessage.includes('Number must be greater than 0') && errorMessage.includes('size')) {
        title = 'Invalid File Size';
        message = 'One or more files are empty (0 bytes). Please select files with content and try again.';
      } 
      // Check for other common validation errors
      else if (errorMessage.includes('File type') && errorMessage.includes('not supported')) {
        title = 'Unsupported File Type';
        message = 'The selected file type is not supported. Please choose a different file format.';
      }
      // File upload errors (no size limits)
      else if (errorMessage.includes('File too large') || errorMessage.includes('exceeds')) {
        title = 'Upload Error';
        message = 'There was an issue uploading your file. Please try again.';
      }
      // Check for network or server errors
      else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
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
    onSettled: () => {
      // Always clean up abort controller after mutation completes (success or error)
      abortControllerRef.current = null;
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

  const lockMutation = useMutation({
    mutationFn: ({ fileId, pin }: { fileId: string; pin: string }) => 
      lockFile(fileId, pin),
    onSuccess: () => {
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'File Locked',
        message: 'File has been locked successfully with PIN'
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      refetchFiles();
      setLockDialog({ isOpen: false, fileId: '', fileName: '', mode: 'lock', pin: '', confirmPin: '', error: '' });
    },
    onError: (error) => {
      setLockDialog(prev => ({ ...prev, error: error.message }));
    },
  });

  const unlockMutation = useMutation({
    mutationFn: ({ fileId, pin }: { fileId: string; pin: string }) => 
      unlockFile(fileId, pin),
    onSuccess: () => {
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'File Unlocked',
        message: 'File has been unlocked successfully'
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      refetchFiles();
      setLockDialog({ isOpen: false, fileId: '', fileName: '', mode: 'lock', pin: '', confirmPin: '', error: '' });
    },
    onError: (error) => {
      setLockDialog(prev => ({ ...prev, error: error.message }));
    },
  });

  const handleCancelUpload = () => {
    // Abort the ongoing upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Don't set to null yet - let the promise rejection handle cleanup
    }
    
    // Don't reset mutation immediately - let it reject naturally to avoid unhandled promise
    // The onError handler will handle cleanup
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    // Only process if we actually have files selected
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
    }
    // Note: We don't reset the input value when no files are selected (cancel case)
    // This prevents any potential re-triggering of the dialog
  };

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

  const handleLockFile = (file: any) => {
    if (file.isLocked) {
      // If already locked, open unlock dialog
      setLockDialog({
        isOpen: true,
        fileId: file.id,
        fileName: file.originalName,
        mode: 'unlock',
        pin: '',
        confirmPin: '',
        error: ''
      });
    } else {
      // If not locked, open lock dialog
      setLockDialog({
        isOpen: true,
        fileId: file.id,
        fileName: file.originalName,
        mode: 'lock',
        pin: '',
        confirmPin: '',
        error: ''
      });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName })
      });
      if (!response.ok) throw new Error('Failed to create folder');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setCreateFolderDialog({ isOpen: false, folderName: '' });
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'Folder Created',
        message: 'New folder has been created successfully'
      });
    },
    onError: () => {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to create folder'
      });
    }
  });

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ fileId, folderName }: { fileId: string; folderName: string }) => {
      const response = await fetch(`/api/files/${fileId}/move-to-folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderName })
      });
      if (!response.ok) throw new Error('Failed to move file');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both files and folders caches so dashboard updates dynamically
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'File Moved',
        message: 'File has been moved to the folder successfully'
      });
      refetchFiles();
    },
    onError: () => {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to move file'
      });
    }
  });

  const confirmLockAction = () => {
    // Validate PIN
    if (!/^\d{4}$/.test(lockDialog.pin)) {
      setLockDialog(prev => ({ ...prev, error: 'PIN must be exactly 4 digits' }));
      return;
    }

    if (lockDialog.mode === 'lock') {
      // For locking, require PIN confirmation
      if (lockDialog.pin !== lockDialog.confirmPin) {
        setLockDialog(prev => ({ ...prev, error: 'PINs do not match' }));
        return;
      }
      lockMutation.mutate({ fileId: lockDialog.fileId, pin: lockDialog.pin });
    } else {
      // For unlocking, just verify the PIN
      unlockMutation.mutate({ fileId: lockDialog.fileId, pin: lockDialog.pin });
    }
  };

  // Auto-submit when user types 4 digits
  useEffect(() => {
    if (!lockDialog.isOpen || lockMutation.isPending || unlockMutation.isPending) return;

    if (lockDialog.mode === 'unlock') {
      // Auto-submit for unlock when 4 digits entered
      if (lockDialog.pin.length === 4) {
        setTimeout(() => confirmLockAction(), 100);
      }
    } else {
      // Auto-submit for lock when both PIN fields have 4 digits
      if (lockDialog.pin.length === 4 && lockDialog.confirmPin.length === 4) {
        setTimeout(() => confirmLockAction(), 100);
      }
    }
  }, [lockDialog.pin, lockDialog.confirmPin, lockDialog.mode, lockDialog.isOpen]);

  const files = (recentFiles as any)?.files || [];
  const userFiles = files.slice(0, 5); // Show last 5 uploaded files

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8" id="upload">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
            <span className="text-gradient">Upload Your Files</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Upload and share your gaming files, mods, tools, and configs with the community. 
            Fast, secure, and optimized for gamers.
          </p>
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.01 }}
          className={cn(
            "premium-card cursor-pointer relative p-12 mb-8 transition-all duration-300",
            isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          data-testid="upload-zone"
        >
          <div className="relative z-10 pointer-events-none">
            <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <img src={uploadGif} alt="Upload to cloud" className="w-full h-full object-contain" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-foreground">
              Drag & Drop Multiple Files Here
            </h3>
            <p className="text-muted-foreground mb-4">
              or <span 
                className="text-primary font-semibold cursor-pointer hover:underline pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                data-testid="browse-files-button"
              >
                browse all files
              </span> to upload
            </p>
          </div>
          <input 
            ref={fileInputRef}
            id="file-input"
            type="file" 
            className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" 
            multiple 
            onChange={handleFileSelect}
            data-testid="file-input"
          />
        </motion.div>

        {/* Upload Progress */}
        {uploadMutation.isPending && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-6"
            data-testid="upload-progress"
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="text-foreground font-medium">Uploading files...</span>
              <div className="flex items-center gap-3">
                <span className="text-primary font-bold text-lg">{uploadProgress.progress}%</span>
                <Button
                  onClick={handleCancelUpload}
                  variant="outline"
                  size="sm"
                  data-testid="cancel-upload-button"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
            <Progress value={uploadProgress.progress} className="w-full h-3" />
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="loader-ring" style={{ width: '16px', height: '16px' }} />
                <span className="text-sm text-muted-foreground">
                  {uploadProgress.progress < 100 ? "Uploading..." : "Processing..."}
                </span>
              </div>
              {uploadProgress.speed > 0 && (
                <div className="text-sm text-primary font-medium">
                  {uploadProgress.speedFormatted}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Recently Uploaded Files Management */}
        {userFiles.length > 0 && (
          <div className="mt-12 max-w-4xl mx-auto">
            <h3 className="text-2xl font-gaming font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent text-center">
              Recently Uploaded Files
            </h3>
            <div className="space-y-3">
              {userFiles.map((file: any) => (
                <motion.div 
                  key={file.id} 
                  className="glass-card p-4 hover:bg-background/30 transition-all duration-150 relative"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  data-testid={`file-card-${file.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 glass-light border border-primary/20 rounded-lg flex items-center justify-center relative">
                        <img 
                          src={getCategoryIcon(file.category)} 
                          alt={`${file.category} icon`}
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground" data-testid={`file-name-${file.id}`}>{file.originalName}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {file.sizeFormatted} • {file.category} • {file.uploadedAtFormatted}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select
                        value={file.folderId || file.category || ""}
                        onValueChange={(folderValue) => {
                          if (folderValue) {
                            moveToFolderMutation.mutate({
                              fileId: file.id,
                              folderName: folderValue
                            });
                          }
                        }}
                      >
                        <SelectTrigger 
                          className="w-40 h-9 bg-blue-500/20 border-blue-600 border px-3 hover:bg-blue-500/30"
                          data-testid={`folder-select-${file.id}`}
                        >
                          <span className="text-blue-600 font-bold text-sm">
                            {getFolderDisplayName(file.folderId || file.category || "Select folder")}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="backdrop-blur-md bg-background/80">
                          {PREDEFINED_FOLDER_VALUES.map((folderValue) => (
                            <SelectItem key={folderValue} value={folderValue} data-testid={`select-folder-${folderValue}`}>
                              {getFolderDisplayName(folderValue)}
                            </SelectItem>
                          ))}
                          {(foldersData as any)?.folders && (foldersData as any).folders
                            .filter((folder: any) => !PREDEFINED_FOLDER_VALUES.includes(folder.name.toLowerCase()))
                            .map((folder: any) => (
                            <SelectItem key={folder.id} value={folder.name} data-testid={`select-folder-custom-${folder.id}`}>
                              {folder.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => setCreateFolderDialog({ isOpen: true, folderName: '' })}
                        size="sm"
                        variant="outline"
                        className="bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white"
                        data-testid={`button-add-folder-${file.id}`}
                        title="Add new folder"
                      >
                        <FolderPlus className="w-4 h-4 mr-1" />
                        Add Folder
                      </Button>
                      <Button
                        onClick={() => handleLockFile(file)}
                        size="sm"
                        variant="outline"
                        className={cn(
                          file.isLocked 
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white" 
                            : "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white"
                        )}
                        data-testid={`button-lock-${file.id}`}
                      >
                        {file.isLocked ? (
                          <>
                            <Unlock className="w-4 h-4 mr-1" />
                            Unlock
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-1" />
                            Lock
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleEditFile(file)}
                        size="sm"
                        variant="outline"
                        className="bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                        data-testid={`button-edit-${file.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDeleteFile(file)}
                        size="sm"
                        variant="outline"
                        className="bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        data-testid={`button-delete-${file.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </motion.div>
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
            <div className="relative glass-card max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95 duration-200">
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
                  <div className="glass-light rounded-lg p-3 border border-primary/20">
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


        {/* Create Custom Folder Dialog */}
        {createFolderDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setCreateFolderDialog({ isOpen: false, folderName: '' })}
            />
            <motion.div 
              className="relative max-w-md w-full mx-4 bg-gradient-to-br from-slate-800/95 via-slate-800/90 to-slate-900/95 rounded-2xl border border-gradient-from border-opacity-50 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                borderImage: 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgba(56, 189, 248, 0.2), rgba(34, 211, 238, 0.1))',
                boxShadow: '0 0 30px rgba(34, 211, 238, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FolderPlus className="w-6 h-6 text-cyan-400" strokeWidth={2} />
                  </motion.div>
                  <h2 className="text-lg font-bold font-display text-gradient">Create Custom Folder</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCreateFolderDialog({ isOpen: false, folderName: '' })}
                  className="w-8 h-8 hover:bg-cyan-500/20 transition-colors"
                  data-testid="button-close-create-folder"
                >
                  <X className="w-4 h-4 text-cyan-400" />
                </Button>
              </div>
              <div className="p-8 space-y-4">
                <p className="text-sm text-slate-300 font-medium">Enter folder name:</p>
                <Input
                  value={createFolderDialog.folderName}
                  onChange={(e) => setCreateFolderDialog(prev => ({ ...prev, folderName: e.target.value }))}
                  placeholder="e.g., My Projects, Downloads"
                  className="w-full bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-cyan-500/30 rounded-xl text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all"
                  autoFocus
                  data-testid="input-folder-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && createFolderDialog.folderName.trim()) {
                      createFolderMutation.mutate(createFolderDialog.folderName.trim());
                    }
                  }}
                />
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setCreateFolderDialog({ isOpen: false, folderName: '' })}
                  className="flex-1 border-slate-600 hover:bg-slate-700/50 text-slate-300 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (createFolderDialog.folderName.trim()) {
                      createFolderMutation.mutate(createFolderDialog.folderName.trim());
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-semibold transition-all"
                  disabled={!createFolderDialog.folderName.trim() || createFolderMutation.isPending}
                  data-testid="button-confirm-create-folder"
                >
                  Create
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Lock/Unlock PIN Dialog */}
        {lockDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setLockDialog({ isOpen: false, fileId: '', fileName: '', mode: 'lock', pin: '', confirmPin: '', error: '' })}
            />
            <motion.div 
              className="relative max-w-md w-full mx-4 bg-gradient-to-br from-slate-800/95 via-slate-800/90 to-slate-900/95 rounded-2xl border border-gradient-from border-opacity-50 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                borderImage: lockDialog.mode === 'lock' 
                  ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.3), rgba(34, 197, 94, 0.2), rgba(74, 222, 128, 0.1))'
                  : 'linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(217, 119, 6, 0.2), rgba(251, 191, 36, 0.1))',
                boxShadow: lockDialog.mode === 'lock'
                  ? '0 0 30px rgba(74, 222, 128, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
                  : '0 0 30px rgba(251, 191, 36, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className={`flex items-center justify-between p-6 border-b border-slate-700/50 bg-gradient-to-r ${lockDialog.mode === 'lock' ? 'from-transparent via-green-500/5 to-transparent' : 'from-transparent via-amber-500/5 to-transparent'}`}>
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ 
                      filter: lockDialog.mode === 'lock'
                        ? ['drop-shadow(0 0 10px rgba(74, 222, 128, 0))', 'drop-shadow(0 0 20px rgba(74, 222, 128, 0.6))', 'drop-shadow(0 0 10px rgba(74, 222, 128, 0))']
                        : ['drop-shadow(0 0 10px rgba(251, 191, 36, 0))', 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.6))', 'drop-shadow(0 0 10px rgba(251, 191, 36, 0))']
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {lockDialog.mode === 'lock' ? (
                      <Lock className="w-6 h-6 text-green-400" strokeWidth={2} />
                    ) : (
                      <Unlock className="w-6 h-6 text-amber-400" strokeWidth={2} />
                    )}
                  </motion.div>
                  <h2 className="text-lg font-bold font-display text-gradient">
                    {lockDialog.mode === 'lock' ? 'Lock File' : 'Unlock File'}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLockDialog({ isOpen: false, fileId: '', fileName: '', mode: 'lock', pin: '', confirmPin: '', error: '' })}
                  className={`w-8 h-8 ${lockDialog.mode === 'lock' ? 'hover:bg-green-500/20' : 'hover:bg-amber-500/20'} transition-colors`}
                  data-testid="button-close-lock"
                >
                  <X className={`w-4 h-4 ${lockDialog.mode === 'lock' ? 'text-green-400' : 'text-amber-400'}`} />
                </Button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-300 font-medium">
                    {lockDialog.mode === 'lock' 
                      ? `Set a 4-digit PIN to protect` 
                      : `Enter the 4-digit PIN to unlock`}
                  </p>
                  <p className="text-xs text-slate-400">
                    "{lockDialog.fileName}"
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={lockDialog.pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setLockDialog(prev => ({ ...prev, pin: value, error: '' }));
                      }}
                      placeholder="••••"
                      className={`w-full text-center text-4xl tracking-[0.5em] bg-gradient-to-r from-slate-700/50 to-slate-600/50 border rounded-xl placeholder:text-slate-500 focus:ring-2 focus:border-opacity-0 transition-all font-mono font-bold ${
                        lockDialog.mode === 'lock'
                          ? 'border-green-500/30 text-green-300 focus:ring-green-400/50 focus:border-green-400'
                          : 'border-amber-500/30 text-amber-300 focus:ring-amber-400/50 focus:border-amber-400'
                      }`}
                      maxLength={4}
                      autoFocus
                      data-testid="input-pin"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && lockDialog.pin.length === 4) {
                          if (lockDialog.mode === 'unlock' || lockDialog.confirmPin.length === 4) {
                            confirmLockAction();
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-slate-400 text-center">
                      {lockDialog.pin.length}/4 digits
                    </p>
                  </div>

                  {lockDialog.mode === 'lock' && (
                    <div className="space-y-2">
                      <Input
                        type="password"
                        value={lockDialog.confirmPin}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setLockDialog(prev => ({ ...prev, confirmPin: value, error: '' }));
                        }}
                        placeholder="••••"
                        className="w-full text-center text-4xl tracking-[0.5em] bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-green-500/30 rounded-xl text-green-300 placeholder:text-slate-500 focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all font-mono font-bold"
                        maxLength={4}
                        data-testid="input-confirm-pin"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && lockDialog.pin.length === 4 && lockDialog.confirmPin.length === 4) {
                            confirmLockAction();
                          }
                        }}
                      />
                      <p className="text-xs text-slate-400 text-center">
                        {lockDialog.confirmPin.length}/4 digits
                      </p>
                    </div>
                  )}

                  {lockDialog.error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="bg-gradient-to-r from-red-500/20 to-red-600/10 rounded-lg p-4 border border-red-500/30"
                    >
                      <p className="text-sm font-medium text-red-300">{lockDialog.error}</p>
                    </motion.div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setLockDialog({ isOpen: false, fileId: '', fileName: '', mode: 'lock', pin: '', confirmPin: '', error: '' })}
                  className="flex-1 border-slate-600 hover:bg-slate-700/50 text-slate-300 transition-colors"
                  data-testid="button-cancel-lock"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmLockAction}
                  className={`flex-1 font-semibold transition-all ${
                    lockDialog.mode === 'lock' 
                      ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white" 
                      : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                  }`}
                  disabled={
                    lockDialog.pin.length !== 4 || 
                    (lockDialog.mode === 'lock' && lockDialog.confirmPin.length !== 4) ||
                    lockMutation.isPending || 
                    unlockMutation.isPending
                  }
                  data-testid="button-confirm-lock"
                >
                  {lockMutation.isPending || unlockMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </div>
                  ) : (
                    <>
                      {lockDialog.mode === 'lock' ? (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Lock File
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 mr-2" />
                          Unlock File
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

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