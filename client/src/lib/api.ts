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

// NEW: Direct S3 upload for single files (< 50MB)
export const uploadFileDirectS3 = async (
  file: File,
  onProgress?: (info: ProgressInfo) => void
): Promise<any> => {
  try {
    // Step 1: Get presigned URL
    // Fix: Provide fallback MIME type for files without one (like .xapk)
    const contentType = file.type || 'application/octet-stream';
    
    const presignResponse = await fetch('/api/s3/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: contentType,
        size: file.size
      })
    });

    if (!presignResponse.ok) {
      const error = await presignResponse.json();
      throw new Error(error.message || 'Failed to get presigned URL');
    }

    const { url, headers, key, fileId } = await presignResponse.json();

    // Step 2: Upload directly to S3
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload speed
      let startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;
      let lastProgressUpdate = 0;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const now = Date.now();
          if (now - lastProgressUpdate > 100 || event.loaded === event.total) {
            const progress = (event.loaded / event.total) * 100;
            
            const timeElapsed = (now - lastTime) / 1000;
            const bytesUploaded = event.loaded - lastLoaded;
            let speed = 0;
            
            if (timeElapsed > 0 && bytesUploaded > 0) {
              speed = bytesUploaded / timeElapsed;
            }
            
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

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            
            // Step 3: Finalize file metadata
            const finalizeResponse = await fetch('/api/files/finalize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId,
                key,
                originalName: file.name,
                size: file.size,
                mimetype: contentType // Use the same contentType with fallback
                // No longer sending s3Url - presigned URLs generated on-demand
              })
            });
            
            if (!finalizeResponse.ok) {
              const error = await finalizeResponse.json();
              console.error(`❌ Finalize failed:`, error);
              throw new Error(error.message || 'Failed to finalize file');
            }

            const result = await finalizeResponse.json();
            resolve(result);
          } catch (error) {
            console.error(`❌ Error in finalize step:`, error);
            reject(error);
          }
        } else {
          console.error(`❌ S3 upload failed with status: ${xhr.status}`);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Upload to S3
      xhr.open('PUT', url);
      for (const [header, value] of Object.entries(headers)) {
        xhr.setRequestHeader(header, String(value));
      }
      xhr.send(file);
    });
  } catch (error) {
    throw new Error(`Direct upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// NEW: Optimized multipart upload for large files (>= 50MB) with parallel chunks
export const uploadFileMultipart = async (
  file: File,
  onProgress?: (info: ProgressInfo) => void
): Promise<any> => {
  // Declare variables outside try block for cleanup access
  let key: string | undefined;
  let uploadId: string | undefined;

  try {
    // Step 1: Start multipart upload with larger chunk size (20MB)
    const contentType = file.type || 'application/octet-stream';
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks (2x larger than before)
    const MAX_CONCURRENT_UPLOADS = 5; // Upload 5 chunks simultaneously
    const BATCH_SIZE = 10; // Get 10 presigned URLs at once
    
    const startResponse = await fetch('/api/s3/multipart/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: contentType,
        size: file.size
      })
    });

    if (!startResponse.ok) {
      const error = await startResponse.json();
      throw new Error(error.message || 'Failed to start multipart upload');
    }

    const response = await startResponse.json();
    key = response.key;
    uploadId = response.uploadId;
    const fileId = response.fileId;
    
    // Calculate parts with our optimized chunk size
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    let uploadedBytes = 0;
    const startTime = Date.now();

    // Progress tracking
    const updateProgress = () => {
      if (onProgress) {
        const progress = (uploadedBytes / file.size) * 100;
        const timeElapsed = (Date.now() - startTime) / 1000;
        const speed = timeElapsed > 0 ? uploadedBytes / timeElapsed : 0;
        
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
      }
    };

    // Step 2: Parallel chunk uploads with batched presigned URLs
    const uploadChunk = async (partNumber: number, partUrl: string): Promise<{ ETag: string; PartNumber: number }> => {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, '');
            if (etag) {
              uploadedBytes += chunk.size;
              updateProgress();
              resolve({ ETag: etag, PartNumber: partNumber });
            } else {
              reject(new Error('No ETag received'));
            }
          } else {
            reject(new Error(`Part ${partNumber} upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error(`Network error during part ${partNumber} upload`));
        });

        xhr.open('PUT', partUrl);
        xhr.send(chunk);
      });
    };

    // Step 3: Process uploads in parallel batches
    const urlCache = new Map<number, string>(); // Cache presigned URLs
    
    // Function to get batch of presigned URLs
    const getBatchUrls = async (startPart: number, batchSize: number): Promise<void> => {
      const partNumbers = [];
      for (let i = startPart; i < Math.min(startPart + batchSize, totalParts + 1); i++) {
        if (!urlCache.has(i)) {
          partNumbers.push(i);
        }
      }

      if (partNumbers.length === 0) return;

      const batchResponse = await fetch('/api/s3/multipart/batch-part-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, uploadId, partNumbers })
      });

      if (!batchResponse.ok) {
        throw new Error('Failed to get batch part URLs');
      }

      const { partUrls } = await batchResponse.json();
      
      // Cache the URLs
      for (const partUrlInfo of partUrls) {
        urlCache.set(partUrlInfo.partNumber, partUrlInfo.url);
      }
    };

    // Pre-fetch first batch of URLs
    await getBatchUrls(1, BATCH_SIZE);

    // Process uploads with concurrency control
    const uploadPromises: Promise<{ ETag: string; PartNumber: number }>[] = [];
    let currentPart = 1;

    while (currentPart <= totalParts) {
      // Ensure we have enough cached URLs
      if (currentPart + MAX_CONCURRENT_UPLOADS > urlCache.size) {
        await getBatchUrls(urlCache.size + 1, BATCH_SIZE);
      }

      // Start up to MAX_CONCURRENT_UPLOADS uploads
      const batchPromises = [];
      for (let i = 0; i < MAX_CONCURRENT_UPLOADS && currentPart <= totalParts; i++, currentPart++) {
        const partUrl = urlCache.get(currentPart);
        if (partUrl) {
          batchPromises.push(uploadChunk(currentPart, partUrl));
        }
      }

      // Wait for this batch to complete before starting the next
      const batchResults = await Promise.all(batchPromises);
      parts.push(...batchResults);
    }

    // Sort parts by part number (important for S3)
    parts.sort((a, b) => a.PartNumber - b.PartNumber);

    // Step 3: Complete multipart upload
    const completeResponse = await fetch('/api/s3/multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, uploadId, parts })
    });

    if (!completeResponse.ok) {
      throw new Error('Failed to complete multipart upload');
    }

    const { s3Key } = await completeResponse.json();

    // Step 4: Finalize file metadata
    const finalizeResponse = await fetch('/api/files/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        key: s3Key, // Use the returned s3Key
        originalName: file.name,
        size: file.size,
        mimetype: contentType // Use the same contentType with fallback
        // No longer sending s3Url - presigned URLs generated on-demand
      })
    });

    if (!finalizeResponse.ok) {
      const error = await finalizeResponse.json();
      throw new Error(error.message || 'Failed to finalize file');
    }

    return await finalizeResponse.json();
  } catch (error) {
    // Critical: Clean up orphaned multipart upload on failure to prevent S3 storage costs
    if (key && uploadId) {
      try {
        await fetch('/api/s3/multipart/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, uploadId })
        });
      } catch (abortError) {
        console.warn('Failed to abort multipart upload:', abortError);
      }
    }
    
    throw new Error(`Multipart upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// NEW: Smart upload function that chooses between direct and multipart
export const uploadFileDirect = async (
  file: File,
  onProgress?: (info: ProgressInfo) => void
): Promise<any> => {
  const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB

  if (file.size >= MULTIPART_THRESHOLD) {
    return uploadFileMultipart(file, onProgress);
  } else {
    return uploadFileDirectS3(file, onProgress);
  }
};

// UPDATED: Optimized upload function for multiple files with concurrency control
export const uploadFilesDirect = async (
  files: FileList,
  description?: string,
  onProgress?: (info: ProgressInfo) => void
): Promise<FileUploadResponse> => {
  // Convert FileList to proper array manually to handle custom FileList objects
  const filesArray: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i] || files.item(i);
    if (file) {
      filesArray.push(file);
    }
  }
  
  const MAX_CONCURRENT_FILES = 3; // Upload max 3 files simultaneously
  const results: any[] = [];
  
  // Sort files by size - upload smaller files first for faster initial feedback
  const sortedFiles = filesArray.sort((a, b) => a.size - b.size);
  
  // Progress tracking for all files
  const totalFiles = sortedFiles.length;
  let completedFiles = 0;
  const progressCache = new Map<number, ProgressInfo>();
  
  const updateOverallProgress = () => {
    if (onProgress) {
      // Calculate weighted average progress across all files
      let totalProgress = 0;
      let totalWeight = 0;
      
      for (const [fileIndex, progress] of Array.from(progressCache.entries())) {
        const fileSize = sortedFiles[fileIndex]?.size || 1;
        totalProgress += (progress.progress / 100) * fileSize;
        totalWeight += fileSize;
      }
      
      const overallProgress = totalWeight > 0 ? (totalProgress / totalWeight) * 100 : 0;
      const completedPercent = (completedFiles / totalFiles) * 100;
      const finalProgress = Math.max(overallProgress, completedPercent);
      
      // Calculate combined upload speed
      const totalSpeed = Array.from(progressCache.values())
        .reduce((sum, p) => sum + (p.speed || 0), 0);
      
      const formatSpeed = (bytesPerSec: number): string => {
        if (bytesPerSec === 0) return "0 KB/s";
        if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
        if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
        return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
      };
      
      onProgress({
        progress: Math.round(finalProgress),
        speed: totalSpeed,
        speedFormatted: formatSpeed(totalSpeed)
      });
    }
  };
  
  // Upload files in controlled concurrent batches
  for (let i = 0; i < sortedFiles.length; i += MAX_CONCURRENT_FILES) {
    const batch = sortedFiles.slice(i, i + MAX_CONCURRENT_FILES);
    const batchPromises = batch.map((file, batchIndex) => {
      const fileIndex = i + batchIndex;
      
      return uploadFileDirect(file, (progressInfo) => {
        progressCache.set(fileIndex, progressInfo);
        updateOverallProgress();
      }).then(result => {
        completedFiles++;
        progressCache.delete(fileIndex); // Clean up completed file progress
        updateOverallProgress();
        return result;
      });
    });
    
    // Wait for this batch to complete before starting the next
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  // Normalize results and filter out any undefined entries
  const mappedFiles = results.map(result => result?.file ?? result).filter(Boolean);
  
  return {
    message: "Files uploaded successfully",
    files: mappedFiles
  };
};

// LEGACY: Keep original upload function for fallback
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
    
    
    xhr.upload.addEventListener('loadstart', () => {
    });
    
    xhr.upload.addEventListener('progress', (event) => {
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
    // Use direct upload endpoint
    xhr.open('POST', '/api/upload');
    xhr.timeout = 1800000; // 30 minute timeout for large files (matches server timeout)
    
    // Performance headers
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    
    xhr.send(formData);
  });

  return { response: responsePromise, xhr };
};

export const downloadFile = async (fileId: string, onProgress?: (info: ProgressInfo) => void): Promise<void> => {
  try {
    // Direct download from server endpoint - server proxies from S3 with attachment header
    // This forces download to browser's download page
    window.location.href = `/api/download/${fileId}`;
    
    // For UI feedback, show immediate completion since we've triggered the browser download
    if (onProgress) {
      onProgress({ progress: 100, speed: 0, speedFormatted: "Download started" });
    }
    
    // Resolve immediately since we've triggered the download
    return Promise.resolve();
    
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
