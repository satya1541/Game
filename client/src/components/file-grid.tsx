import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Smartphone, Monitor, Terminal, Archive, Settings, Plus, Loader2, Eye, Edit, Trash2, RotateCcw, Lock, LockOpen, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { downloadFile, deleteFile, updateFile, verifyFilePin, deleteFolder } from "@/lib/api";
import { cn } from "@/lib/utils";
import CustomPopup from "./custom-popup";
import CustomConfirmationDialog from "./custom-confirmation-dialog";
import { useNotifications } from "./notifications";
import { motion } from "framer-motion";

// Import category icons
import apkIcon from "@assets/apk file_1759147327484.png";
import rarZipIcon from "@assets/rar-zip_1759147327478.png";
import emulatorIcon from "@assets/emulator-file_1759147327480.png";
import softwareIcon from "@assets/software-exe file_1759147327481.png";
import scriptIcon from "@assets/script file_1759147327482.png";

interface FileGridProps {
  category: string;
  searchQuery: string;
  sortBy?: string;
  showActions?: 'download' | 'manage' | 'history';
  currentUserId?: string;
  viewMode?: 'grid' | 'list';
  selectedFolder?: string | null;
  onFolderSelect?: (folder: string | null) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'apks': return Smartphone;
    case 'softwares': return Monitor;
    case 'scripts': return Terminal;
    case 'archives': return Archive;
    case 'configs': return Settings;
    default: return Monitor;
  }
};

const getCategoryFolderIcon = (categoryName: string) => {
  switch (categoryName.toLowerCase()) {
    case 'apks': return apkIcon;
    case 'softwares': return softwareIcon;
    case 'scripts': return scriptIcon;
    case 'archives': return rarZipIcon;
    case 'emulators': return emulatorIcon;
    case 'configs': return scriptIcon; // Use script icon for configs as fallback
    default: return softwareIcon; // Default fallback
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'apks': return 'text-green-400';
    case 'softwares': return 'text-blue-400';
    case 'scripts': return 'text-orange-400';
    case 'archives': return 'text-purple-400';
    case 'configs': return 'text-pink-400';
    default: return 'text-blue-400';
  }
};

const getFileExtension = (filename: string) => {
  return filename.split('.').pop()?.toUpperCase() || 'FILE';
};

// LocalStorage helper functions for tracking unlocked files
const UNLOCKED_FILES_KEY = 'h4vx_unlocked_files';

const getUnlockedFiles = (): Set<string> => {
  try {
    const stored = localStorage.getItem(UNLOCKED_FILES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const addUnlockedFile = (fileId: string): void => {
  const unlocked = getUnlockedFiles();
  unlocked.add(fileId);
  localStorage.setItem(UNLOCKED_FILES_KEY, JSON.stringify(Array.from(unlocked)));
};

const isFileUnlocked = (fileId: string): boolean => {
  return getUnlockedFiles().has(fileId);
};

// Helper function to check if file is previewable
const isPreviewable = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const previewableImages = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff'];
  const previewableVideos = ['mp4', 'webm', 'ogg', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg'];
  const previewableText = ['txt', 'md', 'log', 'json', 'xml', 'cfg', 'config', 'ini', 'sh', 'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'bat', 'cmd', 'yaml', 'yml', 'toml', 'sql', 'gradle', 'properties', 'conf', 'env', 'dockerfile', 'makefile', 'java', 'c', 'cpp', 'cc', 'h', 'hpp', 'rs', 'go', 'gitignore'];
  const previewableDocs = ['pdf'];
  return [...previewableImages, ...previewableVideos, ...previewableText, ...previewableDocs].includes(ext);
};

const getPreviewType = (fileName: string): 'image' | 'video' | 'text' | 'pdf' => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff'];
  const videoExts = ['mp4', 'webm', 'ogg', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg'];
  const textExts = ['txt', 'md', 'log', 'json', 'xml', 'cfg', 'config', 'ini', 'sh', 'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'bat', 'cmd', 'yaml', 'yml', 'toml', 'sql', 'gradle', 'properties', 'conf', 'env', 'dockerfile', 'makefile', 'java', 'c', 'cpp', 'cc', 'h', 'hpp', 'rs', 'go', 'gitignore'];
  const pdfExts = ['pdf'];
  
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (pdfExts.includes(ext)) return 'pdf';
  if (textExts.includes(ext)) return 'text';
  return 'text'; // Default fallback
};

// Predefined folder IDs that cannot be deleted (must match server-side definitions)
// Using lowercase category values to match database storage format
const PREDEFINED_FOLDER_VALUES = [
  'softwares', 'videos', 'images', 'apks', 'scripts', 'archives', 'configs', 'emulators', 'regs'
];

// Also keep the original format for backwards compatibility with storage.getFolders()
const PREDEFINED_FOLDERS = ['Software', 'Video', 'Image', 'APK', 'Script', 'Archive', 'Config'];

// Helper to check if a folder is predefined (handles both formats)
const isPredefinedFolder = (folderId: string): boolean => {
  const lowerCaseId = folderId.toLowerCase();
  return PREDEFINED_FOLDER_VALUES.includes(lowerCaseId) || 
         PREDEFINED_FOLDERS.map(f => f.toLowerCase()).includes(lowerCaseId);
};

// Remove background styling function - cards will be transparent like folders

export default function FileGrid({ category, searchQuery, sortBy, showActions = 'download', currentUserId, viewMode = 'grid', selectedFolder, onFolderSelect }: FileGridProps) {
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { progress: number; speed: number; speedFormatted: string }>>({});
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const [popup, setPopup] = useState({ 
    isOpen: false, 
    type: 'success' as 'success' | 'error', 
    title: '', 
    message: '' 
  });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'delete' as 'delete' | 'confirm' | 'warning',
    title: '',
    message: '',
    fileName: '',
    fileId: '',
    onConfirm: () => {}
  });

  const [pinDialog, setPinDialog] = useState({
    isOpen: false,
    fileId: '',
    fileName: '',
    pin: '',
    error: ''
  });

  const [folderPinDialog, setFolderPinDialog] = useState({
    isOpen: false,
    folderId: '',
    folderName: '',
    pin: '',
    error: ''
  });

  const [cardAnimations, setCardAnimations] = useState<Record<string, 'lock' | 'unlock' | null>>({});

  const [preview, setPreview] = useState({
    isOpen: false,
    fileId: '',
    fileName: '',
    fileUrl: '',
    fileType: 'image' as 'image' | 'video' | 'text' | 'pdf',
    textContent: ''
  });

  // Fetch folders when no folder is selected, otherwise fetch files from specific folder
  const { data: foldersData, isLoading: foldersLoading, error: foldersError } = useQuery({
    queryKey: ["/api/folders"],
    staleTime: 30000,
    enabled: !selectedFolder
  });

  const { data: filesData, isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: selectedFolder 
      ? [`/api/folders/${selectedFolder}/files`, { search: searchQuery || undefined }]
      : ["/api/files", { 
          category: category === 'all' ? undefined : category, 
          search: searchQuery || undefined,
          sort: sortBy || undefined 
        }],
    staleTime: 30000,
    enabled: !!selectedFolder || !selectedFolder
  });

  const isLoading = selectedFolder ? filesLoading : foldersLoading;
  const error = selectedFolder ? filesError : foldersError;

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => deleteFolder(folderId),
    onSuccess: () => {
      // Close confirmation dialog
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      
      // Show success popup
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'Folder Deleted',
        message: 'Folder has been deleted successfully'
      });
      
      // Auto-close popup after 3 seconds
      setTimeout(() => {
        setPopup(prev => ({ ...prev, isOpen: false }));
      }, 3000);
      
      // Invalidate folders query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    },
    onError: (error) => {
      // Close confirmation dialog
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      
      // Show error popup
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to delete folder'
      });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: ({ fileId, pin }: { fileId: string; pin?: string }) => 
      downloadFile(fileId, (progressInfo) => {
        setDownloadProgress(prev => ({ ...prev, [fileId]: progressInfo }));
      }, pin),
    onSuccess: (_, { fileId }) => {
      // Find the file data to get the real filename
      const files = (filesData as any)?.files || [];
      const downloadedFile = files.find((f: any) => f.id === fileId);
      
      // Show popup
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'Downloading.......',
        message: 'Your download has started successfully'
      });

      // Auto-close popup after 3 seconds
      setTimeout(() => {
        setPopup(prev => ({ ...prev, isOpen: false }));
      }, 3000);
      
      // Add notification with real file data
      if (downloadedFile) {
        addNotification({
          type: 'download',
          title: 'Download Complete',
          message: `Download of "${downloadedFile.originalName}" has completed successfully.`,
          read: false
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    },
    onError: (error, { fileId }) => {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Download Failed',
        message: error.message
      });
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    },
    onSettled: (_, __, { fileId }) => {
      setLoadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    },
  });

  const handleDownload = (fileId: string) => {
    // Find the file info to show in confirmation
    const fileInfo = files?.find((f: any) => f.id === fileId);
    const fileName = fileInfo?.originalName || 'this file';
    
    // Check if file is locked AND not already unlocked by user
    if (fileInfo?.isLocked && !isFileUnlocked(fileId)) {
      // Show PIN dialog
      setPinDialog({
        isOpen: true,
        fileId: fileId,
        fileName: fileName,
        pin: '',
        error: ''
      });
      return;
    }
    
    // Show confirmation dialog using existing confirmation system
    setConfirmDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Download Confirmation',
      message: `Are you sure you want to download "${fileName}"?`,
      fileName: fileName,
      fileId: fileId,
      onConfirm: () => {
        // Proceed with download
        setLoadingFiles(prev => new Set(prev).add(fileId));
        setDownloadProgress(prev => ({ ...prev, [fileId]: { progress: 0, speed: 0, speedFormatted: 'Starting...' } }));
        downloadMutation.mutate({ fileId });
      }
    });
  };

  const handlePinVerification = async (pinToVerify?: string) => {
    const pinValue = pinToVerify || pinDialog.pin;
    
    // Validate PIN format
    if (!/^\d{4}$/.test(pinValue)) {
      setPinDialog(prev => ({ ...prev, error: 'PIN must be exactly 4 digits', pin: '' }));
      return;
    }

    try {
      // First, verify the PIN with the backend - must succeed before any animation
      await verifyFilePin(pinDialog.fileId, pinValue);
      
      // PIN is correct! Now we can proceed
      // Save to localStorage
      addUnlockedFile(pinDialog.fileId);

      // Get current fileId before closing dialog (in case it gets cleared)
      const fileId = pinDialog.fileId;
      
      // Close PIN dialog FIRST
      setPinDialog({ isOpen: false, fileId: '', fileName: '', pin: '', error: '' });

      // THEN trigger unlock animation only after successful verification
      setCardAnimations(prev => ({ ...prev, [fileId]: 'unlock' }));

      // Clear animation after it completes - user must manually click download button
      setTimeout(() => {
        setCardAnimations(prev => ({ ...prev, [fileId]: null }));
      }, 600);
    } catch (error) {
      // PIN verification FAILED - no animation, no unlocking, stay in dialog
      const errorMessage = error instanceof Error ? error.message : 'Incorrect PIN';
      setPinDialog(prev => ({ 
        ...prev, 
        error: errorMessage,
        pin: '' // Clear PIN field so user can try again
      }));
    }
  };

  const handleFolderPinVerification = (pinToVerify?: string) => {
    const pinValue = pinToVerify || folderPinDialog.pin;
    
    // Validate PIN format
    if (!/^\d{4}$/.test(pinValue)) {
      setFolderPinDialog(prev => ({ ...prev, error: 'PIN must be exactly 4 digits', pin: '' }));
      return;
    }

    // Check if PIN is correct (hardcoded to 1541)
    if (pinValue !== '1541') {
      setFolderPinDialog(prev => ({ 
        ...prev, 
        error: 'Incorrect PIN',
        pin: ''
      }));
      return;
    }

    // PIN is correct! Show confirmation dialog
    const folderId = folderPinDialog.folderId;
    const folderName = folderPinDialog.folderName;
    
    // Close PIN dialog
    setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' });

    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      type: 'delete',
      title: 'Delete Folder',
      message: `Are you sure you want to delete the folder "${folderName}"? This action cannot be undone.`,
      fileName: folderName,
      fileId: folderId,
      onConfirm: () => {
        deleteFolderMutation.mutate(folderId);
      }
    });
  };

  const handleViewDetails = (file: any) => {
    setPopup({
      isOpen: true,
      type: 'success',
      title: file.originalName,
      message: `File: ${file.originalName}\nSize: ${file.sizeFormatted}\nCategory: ${file.category}\nUploaded: ${file.uploadedAtFormatted}\nDownloads: ${file.downloadCount}\n\nDescription: ${file.description || 'No description available'}`
    });
  };

  const handleEdit = (file: any) => {
    setConfirmDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Edit File',
      message: `Edit file: ${file.originalName}\n\nThis will allow you to modify the file name, description, and category.`,
      fileName: file.originalName,
      fileId: file.id,
      onConfirm: async () => {
        try {
          // For demo purposes, just update the description
          await updateFile(file.id, {
            description: `Updated ${file.category} file - ${new Date().toLocaleString()}`
          });
          
          setPopup({
            isOpen: true,
            type: 'success',
            title: 'File Updated',
            message: `"${file.originalName}" has been updated successfully.`
          });
          
          // Refresh the file list
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        } catch (error) {
          setPopup({
            isOpen: true,
            type: 'error',
            title: 'Update Failed',
            message: error instanceof Error ? error.message : 'Failed to update file'
          });
        }
      }
    });
  };

  const handleDelete = (file: any) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete',
      title: 'Delete File',
      message: 'Are you sure you want to delete this file? This action cannot be undone.',
      fileName: file.originalName,
      fileId: file.id,
      onConfirm: async () => {
        try {
          await deleteFile(file.id);
          
          setPopup({
            isOpen: true,
            type: 'success',
            title: 'File Deleted',
            message: `"${file.originalName}" has been deleted successfully.`
          });
          
          // Refresh the file list and stats
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        } catch (error) {
          setPopup({
            isOpen: true,
            type: 'error',
            title: 'Delete Failed',
            message: error instanceof Error ? error.message : 'Failed to delete file'
          });
        }
      }
    });
  };

  const handleReDownload = (fileId: string) => {
    // Same as regular download but different context
    handleDownload(fileId);
  };

  const handlePreview = async (file: any) => {
    // Check if file is locked AND not already unlocked by user
    if (file.isLocked && !isFileUnlocked(file.id)) {
      // Show PIN dialog instead of preview
      setPinDialog({
        isOpen: true,
        fileId: file.id,
        fileName: file.originalName,
        pin: '',
        error: ''
      });
      return;
    }

    const previewType = getPreviewType(file.originalName);
    const fileUrl = `/api/files/${file.id}/preview`;
    
    let textContent = '';
    
    // For text files, fetch content
    if (previewType === 'text') {
      try {
        const response = await fetch(`/api/files/${file.id}/preview-text`);
        if (response.ok) {
          textContent = await response.text();
        } else if (response.status === 403) {
          // File is locked, show PIN dialog
          setPinDialog({
            isOpen: true,
            fileId: file.id,
            fileName: file.originalName,
            pin: '',
            error: ''
          });
          return;
        }
      } catch (error) {
        console.error('Failed to fetch text preview:', error);
        textContent = 'Failed to load preview content';
      }
    }
    
    setPreview({
      isOpen: true,
      fileId: file.id,
      fileName: file.originalName,
      fileUrl: fileUrl,
      fileType: previewType,
      textContent: textContent
    });
  };

  const renderActionButtons = (file: any) => {
    const isDownloading = loadingFiles.has(file.id);

    if (showActions === 'download') {
      return (
        <Button
          onClick={() => handleDownload(file.id)}
          disabled={isDownloading}
          className="bg-[#de5c5c] hover:bg-[#c54848] text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#de5c5c]/25 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ transition: 'all 0.1s ease' }}
          data-testid={`download-button-${file.id}`}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {downloadProgress[file.id]?.progress || 0}%
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download
            </>
          )}
        </Button>
      );
    }

    if (showActions === 'history') {
      return (
        <div className="flex flex-col gap-1 w-full">
          <Button
            onClick={() => handleReDownload(file.id)}
            disabled={isDownloading}
            variant="outline"
            size="sm"
            className="gap-1 text-xs px-2 py-1 h-7 w-full justify-start"
          >
            <RotateCcw className="w-3 h-3" />
            Re-download
          </Button>
          <Button
            onClick={() => handleViewDetails(file)}
            variant="outline"
            size="sm"
            className="gap-1 text-xs px-2 py-1 h-7 w-full justify-start"
          >
            <Eye className="w-3 h-3" />
            View Details
          </Button>
        </div>
      );
    }

    if (showActions === 'manage') {
      return (
        <div className="flex gap-1 flex-wrap">
          <Button
            onClick={() => handleEdit(file)}
            variant="outline"
            size="sm"
            className="gap-1 text-xs px-2 py-1 h-7"
          >
            <Edit className="w-3 h-3" />
            Edit
          </Button>
          <Button
            onClick={() => handleDelete(file)}
            variant="outline"
            size="sm"
            className="gap-1 text-xs px-2 py-1 h-7 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </Button>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="premium-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-secondary rounded-xl animate-pulse" />
                  <div className="w-20 h-6 bg-secondary rounded-full animate-pulse" />
                </div>
                <div className="w-3/4 h-5 bg-secondary rounded-lg mb-3 animate-pulse" />
                <div className="w-full h-4 bg-secondary/60 rounded-lg mb-4 animate-pulse" />
                <div className="flex justify-between items-center">
                  <div className="w-16 h-4 bg-secondary/40 rounded animate-pulse" />
                  <div className="w-24 h-9 bg-gradient-primary rounded-lg opacity-30 animate-pulse" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card p-12 max-w-md mx-auto"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Terminal className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Error Loading Files</h3>
            <p className="text-muted-foreground">Please try again later</p>
          </motion.div>
        </div>
      </section>
    );
  }

  const files = (filesData as any)?.files || [];
  const folders = (foldersData as any)?.folders || [];

  // Show folders with files if no folder is selected and no search query
  if (!selectedFolder && !searchQuery && folders.length > 0) {
    return (
      <section className="pt-0 pb-8 px-4 sm:px-6 lg:px-8" id="folders">
        <div className="max-w-7xl mx-auto">
          {/* Back button when in folder view */}
          {selectedFolder && onFolderSelect && (
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => onFolderSelect(null)}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Back to Folders
              </Button>
              <h2 className="text-2xl font-gaming font-bold mt-4 text-primary">
                {selectedFolder} Files
              </h2>
            </div>
          )}
          
          {/* Folders Grid View */}
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-display font-bold mb-8 text-foreground"
          >
            All Folders
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...folders].sort((a: any, b: any) => {
              return (b.fileCount || 0) - (a.fileCount || 0);
            }).map((folder: any, index: number) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="folder-card group relative p-6 cursor-pointer"
                data-testid={`folder-${folder.name}`}
                onClick={() => onFolderSelect && onFolderSelect(folder.name)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-primary p-0.5">
                    <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center">
                      <img 
                        src={getCategoryFolderIcon(folder.name)} 
                        alt={`${folder.name} icon`}
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-premium">
                      {folder.name}
                    </span>
                    {!isPredefinedFolder(folder.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFolderPinDialog({
                            isOpen: true,
                            folderId: folder.id,
                            folderName: folder.name,
                            pin: '',
                            error: ''
                          });
                        }}
                        data-testid={`button-delete-folder-${folder.id}`}
                        title="Delete folder"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {folder.name} Files
                </h3>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Contains {folder.fileCount || 0} {(folder.fileCount || 0) === 1 ? 'file' : 'files'}
                </p>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{folder.fileCount || 0} items</span>
                  <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    View files
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* PIN Verification Dialog for Folder Deletion */}
        {folderPinDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' })}
            />
            <motion.div 
              className="relative glass-card max-w-md w-full mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-6 h-6 text-red-500" />
                  <h2 className="text-lg font-semibold text-foreground">Delete Folder</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' })}
                  className="w-8 h-8 hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6">
                <p className="text-muted-foreground mb-4">
                  Enter the 4-digit PIN to delete the folder "{folderPinDialog.folderName}"
                </p>
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Enter PIN
                  </label>
                  <Input
                    type="password"
                    value={folderPinDialog.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setFolderPinDialog(prev => ({ ...prev, pin: value, error: '' }));
                      
                      // Auto-submit when 4 digits are entered
                      if (value.length === 4) {
                        setTimeout(() => {
                          handleFolderPinVerification(value);
                        }, 50);
                      }
                    }}
                    placeholder="4-digit PIN"
                    className="w-full text-center text-2xl tracking-widest"
                    maxLength={4}
                    autoFocus
                    data-testid="input-folder-pin-verify"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && folderPinDialog.pin.length === 4) {
                        handleFolderPinVerification();
                      }
                    }}
                  />
                </div>

                {folderPinDialog.error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-light rounded-lg p-3 border border-destructive/20 bg-destructive/10 mt-4"
                  >
                    <p className="text-sm font-medium text-destructive">{folderPinDialog.error}</p>
                  </motion.div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' })}
                  className="min-w-20"
                  data-testid="button-cancel-folder-pin"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirmation Dialog for Folder Deletion */}
        <CustomConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          type={confirmDialog.type}
          title={confirmDialog.title}
          message={confirmDialog.message}
          fileName={confirmDialog.fileName}
          confirmText={confirmDialog.type === 'delete' ? 'Delete' : 'Confirm'}
          variant={confirmDialog.type === 'delete' ? 'destructive' : 'default'}
        />
      </section>
    );
  }

  if (files.length === 0) {
    return (
      <section className="py-8 px-4 sm:px-6 lg:px-8" id="downloads">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-muted-foreground mb-8">
            <Archive className="w-16 h-16 mx-auto mb-4" />
            <h3 className="text-xl font-gaming font-bold">No Files Found</h3>
            <p className="text-muted-foreground mt-2">
              {searchQuery ? `No files match "${searchQuery}"` : "No files in this category yet"}
            </p>
          </div>
          {selectedFolder && onFolderSelect && (
            <Button
              variant="outline"
              onClick={() => onFolderSelect(null)}
              className="flex items-center gap-2"
              data-testid="button-back-to-dashboard"
            >
              <RotateCcw className="w-4 h-4" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8" id="downloads">
      <div className="max-w-7xl mx-auto">
        {/* Back button when in folder view */}
        {selectedFolder && onFolderSelect && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => onFolderSelect(null)}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Back to Folders
            </Button>
            <h2 className="text-2xl font-gaming font-bold mt-4 text-primary">
              {selectedFolder} Files
            </h2>
          </div>
        )}
        
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max"
          : "flex flex-col gap-4"
        }>
          {files.map((file: any) => {
            const Icon = getCategoryIcon(file.category);
            const colorClass = getCategoryColor(file.category);
            const isDownloading = loadingFiles.has(file.id);
            const progressInfo = downloadProgress[file.id];
            const progress = progressInfo?.progress || 0;
            
            const cardAnimation = cardAnimations[file.id];
            
            // Check if file is already unlocked by current user via localStorage
            const userHasUnlocked = isFileUnlocked(file.id);
            const isEffectivelyLocked = file.isLocked && !userHasUnlocked;
            
            return (
              <div key={file.id} className="relative w-full">
                <motion.div 
                  className={cn(
                    "glass-card group relative overflow-hidden p-6",
                    viewMode === 'grid' ? "flex flex-col w-full" : "flex flex-row items-center space-x-6 w-full"
                  )} 
                  data-testid={`file-card-${file.id}`}
                  initial={isEffectivelyLocked ? { opacity: 1 } : false}
                  animate={
                    cardAnimation === 'lock' ? {
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        'inset 0 0 0 rgba(251, 191, 36, 0)',
                        'inset 0 0 20px rgba(251, 191, 36, 0.6)',
                        'inset 0 0 0 rgba(251, 191, 36, 0)'
                      ]
                    } : cardAnimation === 'unlock' ? {
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        'inset 0 0 0 rgba(34, 197, 94, 0)',
                        'inset 0 0 25px rgba(34, 197, 94, 0.7)',
                        'inset 0 0 0 rgba(34, 197, 94, 0)'
                      ]
                    } : (isEffectivelyLocked ? {
                      boxShadow: 'inset 0 0 8px rgba(251, 191, 36, 0.2)'
                    } : {
                      boxShadow: 'inset 0 0 0px rgba(0, 0, 0, 0)'
                    })
                  }
                  transition={
                    cardAnimation ? {
                      duration: 0.6,
                      ease: 'easeInOut'
                    } : {
                      duration: 0
                    }
                  }
                >
                {/* Full Card Lock Overlay */}
                {isEffectivelyLocked && !cardAnimation && (
                  <motion.div
                    className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center z-30 backdrop-blur-sm cursor-pointer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => {
                      setPinDialog({
                        isOpen: true,
                        fileId: file.id,
                        fileName: file.name,
                        pin: '',
                        error: ''
                      });
                    }}
                  >
                    {/* Animated glow rings */}
                    {[0, 1, 2].map((ring) => (
                      <motion.div
                        key={`lock-ring-${ring}`}
                        className="absolute rounded-full border border-amber-400"
                        initial={{ width: 100, height: 100, opacity: 0 }}
                        animate={{
                          width: [100 + ring * 30, 140 + ring * 30],
                          height: [100 + ring * 30, 140 + ring * 30],
                          opacity: [0.6, 0],
                          left: -50 - ring * 15,
                          top: -50 - ring * 15
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'easeOut',
                          delay: ring * 0.6
                        }}
                      />
                    ))}

                    {/* Main lock icon with elegant pulse */}
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                      className="relative z-10"
                    >
                      <motion.div
                        animate={{
                          filter: [
                            'drop-shadow(0 0 0px rgba(251, 191, 36, 0))',
                            'drop-shadow(0 0 30px rgba(251, 191, 36, 0.8))',
                            'drop-shadow(0 0 0px rgba(251, 191, 36, 0))'
                          ]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut'
                        }}
                      >
                        <Lock className="w-28 h-28 text-amber-400" strokeWidth={1.2} />
                      </motion.div>
                    </motion.div>

                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute w-32 h-32 rounded-full bg-gradient-to-r from-transparent via-amber-200 to-transparent opacity-0"
                      animate={{
                        rotate: 360,
                        opacity: [0, 0.5, 0]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'linear'
                      }}
                    />
                  </motion.div>
                )}

                {/* Lock Breaking Animation */}
                {cardAnimation === 'unlock' && (
                  <motion.div
                    className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                  >
                    {/* Bright flash on unlock */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-green-400/80 to-green-400/0 rounded-lg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />

                    {/* Expanding wave pulses */}
                    {[0, 1, 2, 3].map((wave) => (
                      <motion.div
                        key={`wave-${wave}`}
                        className="absolute rounded-full border-2 border-green-400"
                        initial={{ width: 0, height: 0, opacity: 0.8 }}
                        animate={{
                          width: [0, 200 + wave * 60],
                          height: [0, 200 + wave * 60],
                          opacity: 0,
                          left: -100 - wave * 30,
                          top: -100 - wave * 30
                        }}
                        transition={{
                          duration: 0.7,
                          ease: 'easeOut',
                          delay: wave * 0.12
                        }}
                      />
                    ))}

                    {/* Exploding lock pieces */}
                    {[...Array(20)].map((_, i) => {
                      const angle = (i / 20) * Math.PI * 2;
                      const distance = 150;
                      const x = Math.cos(angle) * distance;
                      const y = Math.sin(angle) * distance;
                      return (
                        <motion.div
                          key={`piece-${i}`}
                          className="absolute w-3 h-3 bg-gradient-to-br from-green-300 to-green-600 rounded-sm"
                          initial={{
                            x: 0,
                            y: 0,
                            opacity: 1,
                            scale: 1
                          }}
                          animate={{
                            x: x + (Math.random() - 0.5) * 60,
                            y: y + (Math.random() - 0.5) * 60,
                            opacity: 0,
                            scale: 0,
                            rotate: Math.random() * 360
                          }}
                          transition={{
                            duration: 0.6,
                            ease: 'easeOut',
                            delay: Math.random() * 0.1
                          }}
                          style={{
                            filter: 'drop-shadow(0 0 4px rgba(74, 222, 128, 0.8))'
                          }}
                        />
                      );
                    })}

                    {/* Center unlock icon with scale animation */}
                    <motion.div
                      initial={{ scale: 0.8, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="relative z-20"
                    >
                      <motion.div
                        animate={{
                          filter: [
                            'drop-shadow(0 0 0px rgba(74, 222, 128, 0))',
                            'drop-shadow(0 0 25px rgba(74, 222, 128, 1))',
                            'drop-shadow(0 0 0px rgba(74, 222, 128, 0))'
                          ]
                        }}
                        transition={{
                          duration: 0.6,
                          ease: 'easeOut'
                        }}
                      >
                        <LockOpen className="w-32 h-32 text-green-400" strokeWidth={1.2} />
                      </motion.div>
                    </motion.div>

                    {/* Dissolving aura */}
                    <motion.div
                      className="absolute w-48 h-48 rounded-full bg-green-400/30 blur-3xl"
                      initial={{ opacity: 0.8, scale: 0.8 }}
                      animate={{
                        opacity: 0,
                        scale: 1.5
                      }}
                      transition={{
                        duration: 0.7,
                        ease: 'easeOut'
                      }}
                    />
                  </motion.div>
                )}

                <div className="relative z-10 w-full flex flex-col"
                     style={{ ...(viewMode === 'list' && { flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }) }}
                >
                
                {viewMode === 'grid' ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1"></div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs px-3 py-1.5 rounded-full font-bold shadow-lg border",
                          file.category === 'apks' && "bg-green-500/90 text-white border-green-400 shadow-green-500/30",
                          file.category === 'softwares' && "bg-blue-500/90 text-white border-blue-400 shadow-blue-500/30",
                          file.category === 'scripts' && "bg-orange-500/90 text-white border-orange-400 shadow-orange-500/30",
                          file.category === 'archives' && "bg-purple-500/90 text-white border-purple-400 shadow-purple-500/30",
                          file.category === 'configs' && "bg-pink-500/90 text-white border-pink-400 shadow-pink-500/30"
                        )}>
                          {getFileExtension(file.originalName)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-gaming font-bold text-foreground group-hover:text-primary truncate" style={{ transition: 'color 0.1s ease' }} data-testid={`file-name-${file.id}`}>
                        {file.originalName}
                      </h4>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-grow font-medium" data-testid={`file-description-${file.id}`}>
                      {file.description || `${file.category} file`}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4 font-medium">
                      <span data-testid={`file-size-${file.id}`}>{file.sizeFormatted}</span>
                      <span data-testid={`file-date-${file.id}`}>{file.uploadedAtFormatted}</span>
                    </div>

                    {/* Download Progress */}
                    {isDownloading && (
                      <div className="mb-4" data-testid={`download-progress-${file.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-foreground font-medium">Downloading...</span>
                          <span className="text-sm text-primary font-bold">{progress}%</span>
                        </div>
                        <Progress value={progress} className="w-full h-2" />
                        {progressInfo?.speedFormatted && (
                          <div className="mt-2 text-xs text-accent font-medium text-center">
                            {progressInfo.speedFormatted}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-auto gap-3">
                      <div className="flex items-center space-x-2 text-sm text-gray-300 font-medium">
                        <Download className="w-4 h-4 text-cyan-400 drop-shadow-sm" />
                        <span data-testid={`file-downloads-${file.id}`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{file.downloadCount.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isPreviewable(file.originalName) && (
                          <Button
                            onClick={() => handlePreview(file)}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg border-0 px-3 py-1.5 h-auto font-semibold text-xs"
                            data-testid={`button-preview-${file.id}`}
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            Preview
                          </Button>
                        )}
                        {renderActionButtons(file)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* List View Layout */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-gaming font-bold text-foreground group-hover:text-primary truncate" style={{ transition: 'color 0.1s ease' }} data-testid={`file-name-${file.id}`}>
                          {file.originalName}
                        </h4>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full font-bold flex-shrink-0 shadow-md border",
                          file.category === 'apks' && "bg-green-500/90 text-white border-green-400 shadow-green-500/30",
                          file.category === 'softwares' && "bg-blue-500/90 text-white border-blue-400 shadow-blue-500/30",
                          file.category === 'scripts' && "bg-orange-500/90 text-white border-orange-400 shadow-orange-500/30",
                          file.category === 'archives' && "bg-purple-500/90 text-white border-purple-400 shadow-purple-500/30",
                          file.category === 'configs' && "bg-pink-500/90 text-white border-pink-400 shadow-pink-500/30"
                        )}>
                          {getFileExtension(file.originalName)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-200 mb-2 line-clamp-1 font-medium" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }} data-testid={`file-description-${file.id}`}>
                        {file.description || `${file.category} file`}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-300 font-medium">
                        <span data-testid={`file-size-${file.id}`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{file.sizeFormatted}</span>
                        <span data-testid={`file-date-${file.id}`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{file.uploadedAtFormatted}</span>
                        <div className="flex items-center space-x-1">
                          <Download className="w-4 h-4 text-cyan-400 drop-shadow-sm" />
                          <span data-testid={`file-downloads-${file.id}`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{file.downloadCount.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Download Progress in List View */}
                      {isDownloading && (
                        <div className="mt-2" data-testid={`download-progress-${file.id}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-foreground font-medium">Downloading...</span>
                            <div className="flex items-center space-x-2">
                              {progressInfo?.speedFormatted && (
                                <span className="text-xs text-accent font-medium">{progressInfo.speedFormatted}</span>
                              )}
                              <span className="text-sm text-primary font-bold">{progress}%</span>
                            </div>
                          </div>
                          <Progress value={progress} className="w-full h-2" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      {renderActionButtons(file)}
                    </div>
                  </>
                )}
                </div>
              </motion.div>
              </div>
            );
          })}
        </div>

        {/* Load More Button */}
        {files.length >= 20 && (
          <div className="text-center mt-12">
            <Button
              className="bg-gradient-to-r from-secondary to-primary text-background px-8 py-3 rounded-lg font-gaming font-semibold hover:shadow-lg hover:shadow-primary/25"
              style={{ transition: 'all 0.15s ease' }}
              data-testid="load-more-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              LOAD MORE FILES
            </Button>
          </div>
        )}

        <CustomPopup
          isOpen={popup.isOpen}
          onClose={() => setPopup(prev => ({ ...prev, isOpen: false }))}
          type={popup.type}
          title={popup.title}
          message={popup.message}
        />

        {/* PIN Verification Dialog for Locked Files */}
        {pinDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setPinDialog({ isOpen: false, fileId: '', fileName: '', pin: '', error: '' })}
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
                      filter: ['drop-shadow(0 0 10px rgba(251, 191, 36, 0))', 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.6))', 'drop-shadow(0 0 10px rgba(251, 191, 36, 0))']
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Lock className="w-6 h-6 text-amber-400" strokeWidth={2} />
                  </motion.div>
                  <h2 className="text-lg font-bold font-display text-gradient">File is Locked</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPinDialog({ isOpen: false, fileId: '', fileName: '', pin: '', error: '' })}
                  className="w-8 h-8 hover:bg-cyan-500/20 transition-colors"
                  data-testid="button-close-pin"
                >
                  <X className="w-4 h-4 text-cyan-400" />
                </Button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-300 font-medium">
                    Enter PIN to unlock
                  </p>
                  <p className="text-xs text-slate-400">
                    {pinDialog.fileName}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={pinDialog.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPinDialog(prev => ({ ...prev, pin: value, error: '' }));
                      
                      // Auto-submit when 4 digits are entered
                      if (value.length === 4) {
                        setTimeout(() => {
                          handlePinVerification(value);
                        }, 50);
                      }
                    }}
                    placeholder="••••"
                    className="w-full text-center text-4xl tracking-[0.5em] bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-cyan-500/30 rounded-xl text-cyan-300 placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all font-mono font-bold"
                    maxLength={4}
                    autoFocus
                    data-testid="input-pin-verify"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pinDialog.pin.length === 4) {
                        handlePinVerification();
                      }
                    }}
                  />
                  <p className="text-xs text-slate-400 text-center">
                    {pinDialog.pin.length}/4 digits
                  </p>
                </div>

                {pinDialog.error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-gradient-to-r from-red-500/20 to-red-600/10 rounded-lg p-4 border border-red-500/30"
                  >
                    <p className="text-sm font-medium text-red-300">{pinDialog.error}</p>
                  </motion.div>
                )}
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setPinDialog({ isOpen: false, fileId: '', fileName: '', pin: '', error: '' })}
                  className="flex-1 border-slate-600 hover:bg-slate-700/50 text-slate-300 transition-colors"
                  data-testid="button-cancel-pin"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* PIN Verification Dialog for Folder Deletion */}
        {folderPinDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' })}
            />
            <motion.div 
              className="relative glass-card max-w-md w-full mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-6 h-6 text-red-500" />
                  <h2 className="text-lg font-semibold text-foreground">Delete Folder</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' })}
                  className="w-8 h-8 hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6">
                <p className="text-muted-foreground mb-4">
                  Enter the 4-digit PIN to delete the folder "{folderPinDialog.folderName}"
                </p>
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Enter PIN
                  </label>
                  <Input
                    type="password"
                    value={folderPinDialog.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setFolderPinDialog(prev => ({ ...prev, pin: value, error: '' }));
                      
                      // Auto-submit when 4 digits are entered
                      if (value.length === 4) {
                        setTimeout(() => {
                          handleFolderPinVerification(value);
                        }, 50);
                      }
                    }}
                    placeholder="4-digit PIN"
                    className="w-full text-center text-2xl tracking-widest"
                    maxLength={4}
                    autoFocus
                    data-testid="input-folder-pin-verify"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && folderPinDialog.pin.length === 4) {
                        handleFolderPinVerification();
                      }
                    }}
                  />
                </div>

                {folderPinDialog.error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-light rounded-lg p-3 border border-destructive/20 bg-destructive/10 mt-4"
                  >
                    <p className="text-sm font-medium text-destructive">{folderPinDialog.error}</p>
                  </motion.div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setFolderPinDialog({ isOpen: false, folderId: '', folderName: '', pin: '', error: '' })}
                  className="min-w-20"
                  data-testid="button-cancel-folder-pin"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Preview Modal for All Previewable File Types */}
        {preview.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setPreview({ isOpen: false, fileId: '', fileName: '', fileUrl: '', fileType: 'image', textContent: '' })}
            />
            <motion.div 
              className="relative glass-card max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground truncate">{preview.fileName}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreview({ isOpen: false, fileId: '', fileName: '', fileUrl: '', fileType: 'image', textContent: '' })}
                  className="hover:bg-muted"
                  data-testid="button-close-preview"
                >
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
                {preview.fileType === 'image' && (
                  <img 
                    src={preview.fileUrl} 
                    alt={preview.fileName}
                    className="max-w-xs max-h-96 object-contain rounded-lg"
                    data-testid="preview-image"
                  />
                )}
                {preview.fileType === 'video' && (
                  <video 
                    src={preview.fileUrl}
                    autoPlay
                    className="max-w-xs max-h-96 rounded-lg"
                    data-testid="preview-video"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {preview.fileType === 'pdf' && (
                  <iframe 
                    src={preview.fileUrl}
                    className="w-96 h-96 rounded-lg"
                    data-testid="preview-pdf"
                  />
                )}
                {preview.fileType === 'text' && (
                  <div className="w-full max-h-96 bg-slate-900 rounded-lg p-4 overflow-auto font-mono text-sm text-slate-100" data-testid="preview-text">
                    <pre className="whitespace-pre-wrap break-words">{preview.textContent}</pre>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-4 pt-0 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setPreview({ isOpen: false, fileId: '', fileName: '', fileUrl: '', fileType: 'image', textContent: '' })}
                  data-testid="button-close-preview-confirm"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}
