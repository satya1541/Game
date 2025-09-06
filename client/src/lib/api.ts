import { apiRequest } from "./queryClient";

export interface FileUploadResponse {
  message: string;
  files: any[];
}

export interface FileResponse {
  files: any[];
}

export interface StatsResponse {
  totalFiles: number;
  totalDownloads: number;
  activeUsers: number;
  totalStorage: string;
  categoryStats: Record<string, number>;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'user' | 'premium' | 'admin';
  uploadedFiles: number;
  totalDownloads: number;
  storageUsed: string;
  memberSince: Date;
}

export interface ProgressInfo {
  progress: number;
  speed: number; // bytes per second
  speedFormatted: string; // formatted speed string
}

export const uploadFiles = async (
  files: FileList, 
  description?: string,
  onProgress?: (info: ProgressInfo) => void
): Promise<{ response: Promise<FileUploadResponse>, xhr: XMLHttpRequest }> => {
  const formData = new FormData();
  
  // Add files to form data with optimized order (smaller files first)
  const sortedFiles = Array.from(files).sort((a, b) => a.size - b.size);
  sortedFiles.forEach(file => {
    formData.append('files', file);
  });
  
  if (description) {
    formData.append('description', description);
  }

  const xhr = new XMLHttpRequest();

  const responsePromise = new Promise<FileUploadResponse>((resolve, reject) => {
    // Track upload speed
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    let lastProgressUpdate = 0;
    
    console.log('Upload started, total size:', Array.from(files).reduce((sum, f) => sum + f.size, 0));
    
    xhr.upload.addEventListener('loadstart', () => {
      console.log('Upload loadstart event');
    });
    
    xhr.upload.addEventListener('progress', (event) => {
      console.log('Upload progress:', event.loaded, '/', event.total, 'computable:', event.lengthComputable);
      if (event.lengthComputable && onProgress) {
        const now = Date.now();
        // Throttle progress updates to every 100ms for smoother UI
        if (now - lastProgressUpdate > 100 || event.loaded === event.total) {
          const progress = (event.loaded / event.total) * 100;
          
          // Calculate upload speed (bytes per second)
          const timeElapsed = (now - lastTime) / 1000; // seconds
          const bytesUploaded = event.loaded - lastLoaded;
          let speed = 0;
          
          if (timeElapsed > 0 && bytesUploaded > 0) {
            speed = bytesUploaded / timeElapsed;
          }
          
          // Format speed for display
          const formatSpeed = (bytesPerSec: number): string => {
            if (bytesPerSec === 0) return "0 KB/s";
            if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
            if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
            return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          };
          
          onProgress({
            progress: Math.round(progress),
            speed,
            speedFormatted: formatSpeed(speed)
          });
          
          lastProgressUpdate = now;
          lastLoaded = event.loaded;
          lastTime = now;
        }
      }
    });

    xhr.addEventListener('load', () => {
      console.log('Upload complete, status:', xhr.status, 'response:', xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid response format'));
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          reject(new Error(errorResponse.message || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      console.log('Upload error event');
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    // Timeout handling for large uploads
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out'));
    });

    // Optimized XHR settings for performance
    // Use direct upload domain to bypass Cloudflare limits
    const uploadUrl = window.location.hostname === 'game.thynxai.cloud' 
      ? 'http://upload-game.thynxai.cloud/api/upload'
      : '/api/upload'; // Fallback for local development
    xhr.open('POST', uploadUrl);
    xhr.timeout = 1800000; // 30 minute timeout for large files (matches server timeout)
    
    // Performance headers
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    
    xhr.send(formData);
  });

  return { response: responsePromise, xhr };
};

export const downloadFile = async (fileId: string, onProgress?: (info: ProgressInfo) => void): Promise<void> => {
  try {
    // Get download URL from API
    const response = await fetch(`/api/download/${fileId}`);
    
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.downloadUrl) {
      throw new Error('Download URL not found');
    }
    
    // Download with progress tracking using XMLHttpRequest
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      
      // Track download speed
      let startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;
      let lastProgressUpdate = 0;
      
      xhr.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const now = Date.now();
          // Throttle progress updates to every 100ms for smoother UI
          if (now - lastProgressUpdate > 100 || event.loaded === event.total) {
            const progress = (event.loaded / event.total) * 100;
            
            // Calculate download speed (bytes per second)
            const timeElapsed = (now - lastTime) / 1000; // seconds
            const bytesDownloaded = event.loaded - lastLoaded;
            let speed = 0;
            
            if (timeElapsed > 0 && bytesDownloaded > 0) {
              speed = bytesDownloaded / timeElapsed;
            }
            
            // Format speed for display
            const formatSpeed = (bytesPerSec: number): string => {
              if (bytesPerSec === 0) return "0 KB/s";
              if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
              if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
              return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            };
            
            onProgress({
              progress: Math.round(progress),
              speed,
              speedFormatted: formatSpeed(speed)
            });
            
            lastProgressUpdate = now;
            lastLoaded = event.loaded;
            lastTime = now;
          }
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Create blob URL and download with original filename
            const blob = xhr.response;
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = data.filename || `file-${fileId}`;
            a.style.display = 'none';
            
            // Trigger download
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            
            // Clean up blob URL after a short delay
            setTimeout(() => {
              window.URL.revokeObjectURL(blobUrl);
            }, 100);
            
            resolve();
          } catch (error) {
            reject(new Error(`Download processing failed: ${error}`));
          }
        } else {
          reject(new Error(`Download failed with status ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during download'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Download cancelled'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('Download timed out'));
      });
      
      // Start the download
      xhr.open('GET', data.downloadUrl);
      xhr.timeout = 600000; // 10 minute timeout for large files
      xhr.send();
    });
    
  } catch (error) {
    throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getCurrentUser = async (): Promise<UserResponse> => {
  const response = await fetch('/api/user/current');
  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }
  return response.json();
};

export const deleteFile = async (fileId: string): Promise<{ message: string }> => {
  const response = await fetch(`/api/files/${fileId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete file');
  }
  
  return response.json();
};

export const updateFile = async (
  fileId: string, 
  updates: { originalName?: string; description?: string; category?: string }
): Promise<{ message: string; file: any }> => {
  const response = await fetch(`/api/files/${fileId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update file');
  }
  
  return response.json();
};
