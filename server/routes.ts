import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getS3Service } from "./s3-service";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import https from "https";
import http from "http";
// Removed compression imports for better upload performance
import { insertFileSchema, insertUserSchema, SUPPORTED_EXTENSIONS, FILE_CATEGORIES } from "@shared/schema";
import { z } from "zod";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Files are now stored in database, no permanent uploads directory needed

// Configure multer for temporary file uploads (files are immediately stored in database)
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use OS temp directory for temporary storage
    cb(null, '/tmp');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Removed compression functions for faster uploads

const upload = multer({
  storage: storage_multer,
  limits: {
    // Remove all file size limits for unlimited uploads
    fileSize: Infinity,
    files: 50, // Allow more files at once
    fieldSize: Infinity, // No field size limit
    parts: 1000, // More parts for larger files
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported`));
    }
  }
});

// Helper function to determine category from file extension and filename
function getCategoryFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const lowerFilename = filename.toLowerCase();
  
  
  // PRIORITY 1: Check for emulator-related files by filename (case-insensitive)
  const emulatorKeywords = [
    'bluestack', 'bluestacks', 'app player', 'noxplayer', 'nox', 
    'ldplayer', 'memu', 'gameloop', 'emulator', 'android emulator',
    'droid4x', 'andy', 'remix os', 'phoenix os', 'smartgaga'
  ];
  if (emulatorKeywords.some(keyword => lowerFilename.includes(keyword))) {
    return FILE_CATEGORIES.EMULATORS;
  }
  
  // PRIORITY 2: Registry files (before checking other extensions)
  if (['.reg'].includes(ext)) {
    return FILE_CATEGORIES.REGS;
  }
  
  // PRIORITY 3: APKs and mobile apps
  if (['.apk', '.xapk'].includes(ext)) {
    return FILE_CATEGORIES.APKS;
  }
  
  // PRIORITY 4: Scripts and code files
  if (['.bat', '.sh', '.py', '.js', '.ps1', '.cmd', '.vbs'].includes(ext)) {
    return FILE_CATEGORIES.SCRIPTS;
  }
  
  // PRIORITY 5: Archives and compressed files
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) {
    return FILE_CATEGORIES.ARCHIVES;
  }
  
  // PRIORITY 6: Configuration and text files
  if (['.cfg', '.config', '.ini', '.json', '.xml', '.txt', '.md', '.log', '.html', '.css'].includes(ext)) {
    return FILE_CATEGORIES.CONFIGS;
  }
  
  // PRIORITY 7: Software and executables (after all specific checks)
  if (['.exe', '.msi', '.dmg', '.deb', '.rpm'].includes(ext)) {
    return FILE_CATEGORIES.SOFTWARES;
  }
  
  // DEFAULT: Unknown files go to softwares
  return FILE_CATEGORIES.SOFTWARES;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format time ago
function timeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return date.toLocaleDateString();
}

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Contact form schema
const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  type: z.enum(['general', 'support', 'bug', 'feature', 'abuse', 'business'])
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create user endpoint
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json({ 
        message: "User created successfully", 
        user: {
          ...user,
          // Don't return sensitive info if any
        }
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "User creation failed" 
      });
    }
  });

  // Get current user endpoint (simplified - in real app would use auth middleware)
  app.get("/api/user/current", async (req, res) => {
    try {
      // For now, return the default user (in real app would use auth middleware)
      const user = await storage.getUserByEmail('user@example.com');
      
      if (!user) {
        return res.status(404).json({ message: "No user found" });
      }

      // Get user stats
      const stats = await storage.getUserStats(user.id);
      
      res.json({
        ...user,
        uploadedFiles: stats.uploadedFiles,
        totalDownloads: stats.totalDownloads,
        storageUsed: stats.storageUsed,
        memberSince: user.createdAt,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });


  // Simple, reliable upload endpoint - direct database storage
  app.post("/api/upload", (req, res, next) => {
    upload.array('files')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ message: `File upload error. This shouldn't happen with unlimited size. Error: ${err.message}` });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ message: `Too many files. Maximum is 10 files at a time. Error: ${err.message}` });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ message: `Unexpected field. Error: ${err.message}` });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Get current user
      const currentUser = await storage.getUserByEmail('user@example.com');
      const uploaderId = currentUser?.id;

      // Process files in parallel for much faster uploads
      const uploadPromises = req.files.map(async (file) => {
        try {
          const category = getCategoryFromExtension(file.originalname);
          
          // Read file content directly - NO COMPRESSION for reliability
          const fileContent = await fs.readFile(file.path);

          // Create file metadata (no content in schema anymore)
          const fileData = insertFileSchema.parse({
            filename: file.originalname,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            category,
            description: req.body.description || `${category} file`,
          });

          // Pass content separately for S3 upload
          const savedFile = await storage.createFile(fileData, fileContent, uploaderId);

          // Cleanup temporary file
          await fs.unlink(file.path).catch(() => {});

          // Return file response (S3 version - no content property)
          return {
            ...savedFile,
            sizeFormatted: formatFileSize(savedFile.size),
            uploadedAtFormatted: timeAgo(savedFile.uploadedAt)
          };
          
        } catch (fileError) {
          // Cleanup temp file on error
          await fs.unlink(file.path).catch(() => {});
          throw new Error(`Failed to process file ${file.originalname}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      });

      // Wait for all uploads to complete in parallel
      const uploadedFiles = await Promise.all(uploadPromises);

      res.json({ 
        message: "Files uploaded successfully", 
        files: uploadedFiles
      });

    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Upload failed"
      });
    }
  });

  // NEW: Presigned URL for direct S3 upload (single file)
  app.post("/api/s3/presign", async (req, res) => {
    try {
      const { filename, contentType, size } = req.body;
      
      // Validate input
      if (!filename || !contentType || !size) {
        return res.status(400).json({ 
          message: "Missing required fields: filename, contentType, size" 
        });
      }

      // Check file extension
      const ext = path.extname(filename).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({ 
          message: `File type ${ext} not supported` 
        });
      }

      // Generate unique file ID and S3 key
      const fileId = randomUUID();
      const s3Service = getS3Service();
      const key = s3Service.generateFileKey(fileId, filename);
      
      // Generate presigned URL
      const { url, headers } = await s3Service.getPresignedPutUrl(key, contentType);
      
      res.json({
        key,
        url,
        headers,
        fileId
      });
    } catch (error) {
      console.error('Presign error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate presigned URL" 
      });
    }
  });

  // NEW: Start multipart upload for large files
  app.post("/api/s3/multipart/start", async (req, res) => {
    try {
      const { filename, contentType, size } = req.body;
      
      // Validate input
      if (!filename || !contentType || !size) {
        return res.status(400).json({ 
          message: "Missing required fields: filename, contentType, size" 
        });
      }

      // Check file extension
      const ext = path.extname(filename).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({ 
          message: `File type ${ext} not supported` 
        });
      }

      // Generate unique file ID and S3 key
      const fileId = randomUUID();
      const s3Service = getS3Service();
      const key = s3Service.generateFileKey(fileId, filename);
      
      // Start multipart upload
      const { uploadId } = await s3Service.createMultipartUpload(key, contentType, filename);
      
      // Calculate part size (10MB chunks)
      const partSize = 10 * 1024 * 1024; // 10MB
      const totalParts = Math.ceil(size / partSize);
      
      res.json({
        key,
        uploadId,
        partSize,
        totalParts,
        fileId
      });
    } catch (error) {
      console.error('Multipart start error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to start multipart upload" 
      });
    }
  });

  // NEW: Get presigned URL for multipart upload part
  app.post("/api/s3/multipart/part-url", async (req, res) => {
    try {
      const { key, uploadId, partNumber } = req.body;
      
      if (!key || !uploadId || !partNumber) {
        return res.status(400).json({ 
          message: "Missing required fields: key, uploadId, partNumber" 
        });
      }

      const s3Service = getS3Service();
      const { url, headers } = await s3Service.getPresignedUploadPartUrl(key, uploadId, partNumber);
      
      res.json({ url, headers });
    } catch (error) {
      console.error('Part URL error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate part URL" 
      });
    }
  });

  // NEW: Get presigned URLs for multiple multipart upload parts (batch)
  app.post("/api/s3/multipart/batch-part-urls", async (req, res) => {
    try {
      const { key, uploadId, partNumbers } = req.body;
      
      if (!key || !uploadId || !partNumbers || !Array.isArray(partNumbers)) {
        return res.status(400).json({ 
          message: "Missing required fields: key, uploadId, partNumbers (array)" 
        });
      }

      const s3Service = getS3Service();
      const partUrls = [];

      // Generate presigned URLs for all requested parts
      for (const partNumber of partNumbers) {
        const { url, headers } = await s3Service.getPresignedUploadPartUrl(key, uploadId, partNumber);
        partUrls.push({
          partNumber,
          url,
          headers
        });
      }
      
      res.json({ partUrls });
    } catch (error) {
      console.error('Batch part URLs error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate batch part URLs" 
      });
    }
  });

  // NEW: Complete multipart upload
  app.post("/api/s3/multipart/complete", async (req, res) => {
    try {
      const { key, uploadId, parts } = req.body;
      
      if (!key || !uploadId || !parts || !Array.isArray(parts)) {
        return res.status(400).json({ 
          message: "Missing required fields: key, uploadId, parts (array)" 
        });
      }

      const s3Service = getS3Service();
      const s3Key = await s3Service.completeMultipartUpload(key, uploadId, parts);
      
      // Return only the s3Key - presigned URLs will be generated on-demand for downloads
      res.json({ s3Key });
    } catch (error) {
      console.error('Multipart complete error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to complete multipart upload" 
      });
    }
  });

  // NEW: Abort multipart upload
  app.post("/api/s3/multipart/abort", async (req, res) => {
    try {
      const { key, uploadId } = req.body;
      
      if (!key || !uploadId) {
        return res.status(400).json({ 
          message: "Missing required fields: key, uploadId" 
        });
      }

      const s3Service = getS3Service();
      await s3Service.abortMultipartUpload(key, uploadId);
      
      res.json({ message: "Multipart upload aborted successfully" });
    } catch (error) {
      console.error('Multipart abort error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to abort multipart upload" 
      });
    }
  });

  // NEW: Finalize file metadata after successful S3 upload
  app.post("/api/files/finalize", async (req, res) => {
    try {
      const { fileId, key, originalName, size, mimetype, category, description } = req.body;
      
      // Validate required fields (removed s3Url requirement)
      if (!fileId || !key || !originalName || !size || !mimetype) {
        return res.status(400).json({ 
          message: "Missing required fields: fileId, key, originalName, size, mimetype" 
        });
      }

      // Get current user
      const currentUser = await storage.getUserByEmail('user@example.com');
      const uploaderId = currentUser?.id;

      // Determine category if not provided
      const finalCategory = category || getCategoryFromExtension(originalName);

      // Create file record with metadata only (no file content, no s3Url)
      const fileData = insertFileSchema.parse({
        filename: originalName,
        originalName,
        size: parseInt(size),
        mimetype,
        category: finalCategory,
        description: description || `${finalCategory} file`,
        s3Key: key
      });

      // Save to database using a new method that doesn't require file content
      const savedFile = await storage.createFileFromMetadata(fileData, uploaderId);

      const response = {
        message: "File finalized successfully",
        file: {
          ...savedFile,
          sizeFormatted: formatFileSize(savedFile.size),
          uploadedAtFormatted: timeAgo(savedFile.uploadedAt)
        }
      };
      
      res.json(response);
    } catch (error) {
      console.error('File finalize error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to finalize file" 
      });
    }
  });

  // Get files endpoint with filtering and pagination
  app.get("/api/files", async (req, res) => {
    try {
      const category = req.query.category as string;
      const search = req.query.search as string;
      const sort = req.query.sort as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const files = await storage.getFiles(category, search, sort, limit, offset);
      
      const formattedFiles = files.map(file => {
        return {
          ...file,
          sizeFormatted: formatFileSize(file.size),
          uploadedAtFormatted: timeAgo(file.uploadedAt)
        };
      });

      res.json({ files: formattedFiles });
    } catch (error) {
      console.error(`[API] GET /api/files - Error:`, error);
      console.error(`[API] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Download file endpoint - generate presigned URL for direct S3 download
  app.get("/api/download/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const file = await storage.getFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      if (!file.s3Key) {
        return res.status(500).json({ message: "File S3 key not found" });
      }

      // Increment download count asynchronously (don't wait)
      setImmediate(() => {
        storage.incrementDownloadCount(id).catch(() => {});
      });

      // Generate presigned URL with attachment headers for direct S3 download at full speed
      const s3Service = getS3Service();
      
      try {
        // Create presigned URL with response headers to force download
        const presignedResult = await s3Service.getPresignedDownloadUrl(file.s3Key, {
          'response-content-disposition': `attachment; filename="${file.originalName}"`,
          'response-content-type': file.mimetype || 'application/octet-stream'
        }, 300); // 5 minute expiry

        // Redirect to presigned URL for direct S3 download at full speed
        res.redirect(302, presignedResult.url);
        return;
        
      } catch (presignedError) {
        console.error('Presigned URL generation failed:', presignedError);
        throw new Error(`Failed to generate presigned URL: ${presignedError instanceof Error ? presignedError.message : 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Download failed" });
      }
    }
  });

  // Get file details endpoint
  app.get("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const file = await storage.getFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      res.json({
        ...file,
        sizeFormatted: formatFileSize(file.size),
        uploadedAtFormatted: timeAgo(file.uploadedAt)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  // Update file endpoint
  app.put("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { originalName, description, category } = req.body;
      
      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Update file metadata
      const updatedFile = await storage.updateFile(id, {
        originalName,
        description,
        category
      });

      const fileWithoutContent = updatedFile;
      res.json({
        message: "File updated successfully",
        file: {
          ...fileWithoutContent,
          sizeFormatted: formatFileSize(updatedFile.size),
          uploadedAtFormatted: timeAgo(updatedFile.uploadedAt)
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  // Delete file endpoint
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const file = await storage.getFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Delete from storage (content is in database, no filesystem cleanup needed)
      await storage.deleteFile(id);

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Get folder structure endpoint (now based on categories)
  app.get("/api/folders", async (req, res) => {
    try {
      const categoryStats = await storage.getCategoryStats();
      const folders = [];

      for (const [category, fileCount] of Object.entries(categoryStats)) {
        if (fileCount > 0) {
          // Get total size for this category
          const categoryFiles = await storage.getFiles(category);
          const totalSize = categoryFiles.reduce((sum, file) => sum + file.size, 0);
          
          folders.push({
            name: category.toUpperCase(),
            fileCount,
            totalSize,
            totalSizeFormatted: formatFileSize(totalSize)
          });
        }
      }

      res.json({ folders });
    } catch (error) {
      console.error(`[API] GET /api/folders - Error:`, error);
      console.error(`[API] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  // Get files in specific folder endpoint (now based on categories)
  app.get("/api/folders/:folderName/files", async (req, res) => {
    try {
      const { folderName } = req.params;
      const search = req.query.search as string;
      
      // Convert folder name to category (folderName is uppercase like APK, EXE)
      const category = folderName.toLowerCase();
      
      // Get files from storage for this category
      const categoryFiles = await storage.getFiles(category, search);
      
      const formattedFiles = categoryFiles.map(file => {
        return {
          ...file,
          sizeFormatted: formatFileSize(file.size),
          uploadedAtFormatted: timeAgo(file.uploadedAt)
        };
      });

      res.json({ files: formattedFiles, folderName });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch folder files" });
    }
  });

  // Get statistics endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const [fileCount, totalDownloads, categoryStats, totalStorageBytes, activeUsers] = await Promise.all([
        storage.getFileCount(),
        storage.getTotalDownloads(),
        storage.getCategoryStats(),
        storage.getTotalStorageUsed(),
        storage.getActiveUsersCount()
      ]);

      // Format storage size
      const formatStorage = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };

      const response = {
        totalFiles: fileCount,
        totalDownloads,
        activeUsers,
        totalStorage: formatStorage(totalStorageBytes),
        categoryStats
      };

      res.json(response);
    } catch (error) {
      console.error(`[API] GET /api/stats - Error:`, error);
      console.error(`[API] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // File categorization audit and fix endpoint
  app.post("/api/admin/recategorize-files", async (req, res) => {
    try {
      
      // Get all files for recategorization check
      const allFiles = await storage.getFiles(undefined, undefined, undefined, 1000, 0);
      const updates = [];
      
      for (const file of allFiles) {
        const correctCategory = getCategoryFromExtension(file.originalName);
        
        if (file.category !== correctCategory) {
          
          try {
            await storage.updateFile(file.id, { category: correctCategory });
            updates.push({
              id: file.id,
              filename: file.originalName,
              oldCategory: file.category,
              newCategory: correctCategory
            });
          } catch (updateError) {
          }
        }
      }
      
      
      res.json({
        message: `File categorization audit complete. Updated ${updates.length} files.`,
        updatedFiles: updates,
        totalFilesChecked: allFiles.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to recategorize files" });
    }
  });

  // Admin endpoints for detailed stats optimized for S3 storage
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const recentDownloads = await storage.getRecentDownloads();
      const totalFiles = await storage.getFileCount();
      const totalDownloads = await storage.getTotalDownloads();
      const totalStorage = await storage.getTotalStorageUsed();
      const activeUsers = await storage.getActiveUsersCount();
      const categoryStats = await storage.getCategoryStats();
      
      // S3 storage metrics
      const s3StorageInfo = {
        provider: 'AWS S3',
        region: 'ap-south-2',
        bucket: 'game.thynxai.cloud',
        optimizations: [
          'Multipart uploads for large files',
          'Direct CDN downloads',
          'Unlimited storage capacity',
          'Global content delivery'
        ]
      };
      
      res.json({ 
        recentDownloads,
        overview: {
          totalFiles,
          totalDownloads,
          totalStorage: formatFileSize(totalStorage),
          activeUsers,
          categoryStats,
          s3StorageInfo
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/files", async (req, res) => {
    try {
      const files = await storage.getAllFilesWithStats();
      const formattedFiles = await Promise.all(files.map(async (file: any) => {
        const fileWithoutContent = { ...file };
        delete fileWithoutContent.content;
        
        // Generate signed URL for admin access if S3 key exists
        let adminViewUrl = fileWithoutContent.s3Url;
        if (fileWithoutContent.s3Key) {
          try {
            adminViewUrl = await getS3Service().getSignedDownloadUrl(fileWithoutContent.s3Key, 3600); // 1 hour expiry
          } catch (error) {
            console.warn(`Failed to generate signed URL for ${fileWithoutContent.s3Key}:`, error);
            // Keep original URL as fallback
          }
        }
        
        return {
          ...fileWithoutContent,
          sizeFormatted: formatFileSize(file.size),
          uploadedAtFormatted: timeAgo(file.uploadedAt),
          adminViewUrl // Add signed URL for admin view
        };
      }));

      res.json({ files: formattedFiles });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin files" });
    }
  });

  // Contact form endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const contactData = contactSchema.parse(req.body);
      
      // Email content
      const emailHtml = `
        <h2>New Contact Form Submission</h2>
        <p><strong>Type:</strong> ${contactData.type.charAt(0).toUpperCase() + contactData.type.slice(1)}</p>
        <p><strong>Name:</strong> ${contactData.name}</p>
        <p><strong>Email:</strong> ${contactData.email}</p>
        <p><strong>Subject:</strong> ${contactData.subject}</p>
        <h3>Message:</h3>
        <p>${contactData.message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><small>Sent from H4VX Contact Form</small></p>
      `;

      // Send email
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: 'danavbhai2019@gmail.com',
        subject: `[H4VX ${contactData.type.toUpperCase()}] ${contactData.subject}`,
        html: emailHtml,
        replyTo: contactData.email
      });

      res.json({ 
        message: "Message sent successfully! We'll get back to you soon.",
        success: true
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid form data",
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to send message. Please try again later.",
        success: false
      });
    }
  });

  // Run new.sh script endpoint (secured with token)
  app.post("/api/run-new-sh", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const expectedToken = process.env.SCRIPT_TOKEN || 'MY_SECRET_TOKEN';
      
      if (token !== expectedToken) {
        return res.status(401).json({ 
          message: "Unauthorized: Invalid token" 
        });
      }

      const { stdout, stderr } = await execAsync('./new.sh');
      
      res.json({ 
        success: true,
        output: stdout,
        error: stderr || null
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Failed to execute script",
        error: error instanceof Error && 'stderr' in error ? (error as any).stderr : null
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
