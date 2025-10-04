import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Smartphone, Monitor, Terminal, Archive, Settings, Plus, Loader2, Eye, Edit, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { downloadFile, deleteFile, updateFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import CustomPopup from "./custom-popup";
import CustomConfirmationDialog from "./custom-confirmation-dialog";
import { useNotifications } from "./notifications";

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

  const downloadMutation = useMutation({
    mutationFn: ({ fileId }: { fileId: string }) => 
      downloadFile(fileId, (progressInfo) => {
        setDownloadProgress(prev => ({ ...prev, [fileId]: progressInfo }));
      }),
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

  const renderActionButtons = (file: any) => {
    const isDownloading = loadingFiles.has(file.id);

    if (showActions === 'download') {
      return (
        <Button
          onClick={() => handleDownload(file.id)}
          disabled={isDownloading}
          className="bg-[#de5c5c] hover:bg-[#c54848] text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#de5c5c]/25 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="file-card rounded-xl p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-muted rounded-lg"></div>
                  <div className="w-16 h-6 bg-muted rounded-full"></div>
                </div>
                <div className="w-3/4 h-5 bg-muted rounded mb-2"></div>
                <div className="w-full h-4 bg-muted rounded mb-4"></div>
                <div className="flex justify-between mb-4">
                  <div className="w-16 h-4 bg-muted rounded"></div>
                  <div className="w-20 h-4 bg-muted rounded"></div>
                </div>
                <div className="flex justify-between">
                  <div className="w-12 h-4 bg-muted rounded"></div>
                  <div className="w-24 h-8 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-destructive mb-4">
            <Terminal className="w-16 h-16 mx-auto mb-4" />
            <h3 className="text-xl font-gaming font-bold">Error Loading Files</h3>
            <p className="text-muted-foreground mt-2">Please try again later</p>
          </div>
        </div>
      </section>
    );
  }

  const files = (filesData as any)?.files || [];
  const folders = (foldersData as any)?.folders || [];

  // Show folders if no folder is selected and no search query
  if (!selectedFolder && !searchQuery && folders.length > 0) {
    return (
      <section className="pt-4 pb-8 px-4 sm:px-6 lg:px-8" id="folders">
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folders.map((folder: any) => (
              <div
                key={folder.name}
                className="glass-card cursor-pointer group relative overflow-hidden hover:scale-105 p-6"
                onClick={() => onFolderSelect && onFolderSelect(folder.name)}
                data-testid={`folder-${folder.name}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/40 flex items-center justify-center">
                    <img 
                      src={getCategoryFolderIcon(folder.name)} 
                      alt={`${folder.name} icon`}
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium glass-light text-primary">
                    {folder.name}
                  </span>
                </div>
                
                <h3 className="text-lg font-gaming font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {folder.name} Files
                </h3>
                
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  Contains {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                </p>
                
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{folder.fileCount} items</span>
                  <span>{folder.totalSizeFormatted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          : "flex flex-col gap-4"
        }>
          {files.map((file: any) => {
            const Icon = getCategoryIcon(file.category);
            const colorClass = getCategoryColor(file.category);
            const isDownloading = loadingFiles.has(file.id);
            const progressInfo = downloadProgress[file.id];
            const progress = progressInfo?.progress || 0;
            
            return (
              <div 
                key={file.id} 
                className={cn(
                  "glass-card group relative overflow-hidden p-6",
                  viewMode === 'grid' ? "flex flex-col h-full" : "flex flex-row items-center space-x-6"
                )} 
                data-testid={`file-card-${file.id}`}
              >
                <div className="relative z-10 w-full h-full flex flex-col"
                     style={{ ...(viewMode === 'list' && { flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }) }}
                >
                
                {viewMode === 'grid' ? (
                  <>
                    <div className="flex items-center justify-end mb-4">
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
                    
                    <h4 className="font-gaming font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-200 truncate" data-testid={`file-name-${file.id}`}>
                      {file.originalName}
                    </h4>
                    
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
                    
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center space-x-2 text-sm text-gray-300 font-medium">
                        <Download className="w-4 h-4 text-cyan-400 drop-shadow-sm" />
                        <span data-testid={`file-downloads-${file.id}`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{file.downloadCount.toLocaleString()}</span>
                      </div>
                      
                      {renderActionButtons(file)}
                    </div>
                  </>
                ) : (
                  <>
                    {/* List View Layout */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-gaming font-bold text-foreground group-hover:text-primary transition-colors duration-200 truncate" data-testid={`file-name-${file.id}`}>
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
              </div>
            );
          })}
        </div>

        {/* Load More Button */}
        {files.length >= 20 && (
          <div className="text-center mt-12">
            <Button
              className="bg-gradient-to-r from-secondary to-primary text-background px-8 py-3 rounded-lg font-gaming font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-200 transform hover:scale-105"
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
        
        <CustomConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          type={confirmDialog.type}
          title={confirmDialog.title}
          message={confirmDialog.message}
          fileName={confirmDialog.fileName}
        />
      </div>
    </section>
  );
}
