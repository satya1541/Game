import { type FileRecord, type InsertFile, type UserRecord, type InsertUser, type FolderRecord, type InsertFolder } from "@shared/schema";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getS3Service } from './s3-service';

export interface IStorage {
  // File operations
  createFile(file: InsertFile, fileContent: Buffer, uploadedBy?: string): Promise<FileRecord>;
  createFileFromMetadata(file: InsertFile, uploadedBy?: string): Promise<FileRecord>;
  getFile(id: string): Promise<FileRecord | undefined>;
  getFiles(category?: string, search?: string, sort?: string, limit?: number, offset?: number): Promise<FileRecord[]>;
  getFilesByFolderId(folderId: string, search?: string, sort?: string, limit?: number, offset?: number): Promise<FileRecord[]>;
  incrementDownloadCount(id: string): Promise<FileRecord | undefined>;
  updateFile(id: string, updates: { originalName?: string; description?: string; category?: string; folderId?: string | null }): Promise<FileRecord>;
  deleteFile(id: string): Promise<boolean>;
  
  // File lock operations
  lockFile(id: string, hashedPin: string): Promise<FileRecord | undefined>;
  unlockFile(id: string, hashedPin: string): Promise<{ success: boolean; file?: FileRecord }>;
  verifyFilePin(id: string, hashedPin: string): Promise<boolean>;
  
  // Folder operations
  createFolder(folder: InsertFolder, createdBy?: string): Promise<FolderRecord>;
  getFolder(id: string): Promise<FolderRecord | undefined>;
  getFolders(): Promise<FolderRecord[]>;
  deleteFolder(id: string): Promise<boolean>;
  
  // User operations
  createUser(user: InsertUser): Promise<UserRecord>;
  getUser(id: string): Promise<UserRecord | undefined>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  getUserStats(userId: string): Promise<{uploadedFiles: number, totalDownloads: number, storageUsed: string}>;
  
  // Statistics
  getFileCount(): Promise<number>;
  getTotalDownloads(): Promise<number>;
  getCategoryStats(): Promise<Record<string, number>>;
  getTotalStorageUsed(): Promise<number>;
  getActiveUsersCount(): Promise<number>;
  
  // Admin specific methods
  getRecentDownloads(): Promise<any[]>;
  getAllFilesWithStats(): Promise<FileRecord[]>;
  
  // Page settings operations
  setPagePin(pageName: string, pinHash: string): Promise<void>;
  verifyPagePin(pageName: string, pinHash: string): Promise<boolean>;
  hasPagePin(pageName: string): Promise<boolean>;
}

export class MySQLStorage implements IStorage {
  private pool: mysql.Pool;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    this.pool = mysql.createPool({
      host: "15.206.156.197",
      port: 3306,
      user: "satya",
      password: "satya123",
      database: "game_db",
      waitForConnections: true,
      connectionLimit: 100, // Increased significantly for concurrent downloads
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // MySQL performance optimizations for high concurrency
      charset: 'utf8mb4',
    });

    // Initialize in the background - don't block server startup
    this.initPromise = this.initializeDatabase();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      
      // Create users table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          avatar TEXT,
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      

      // Create folders table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS folders (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(36)
        )
      `);

      // Create files table if it doesn't exist (S3 version)
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS files (
          id VARCHAR(36) PRIMARY KEY,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          size INT NOT NULL,
          mimetype TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          download_count INT NOT NULL DEFAULT 0,
          uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          uploaded_by VARCHAR(36),
          s3_url TEXT,
          s3_key TEXT,
          file_path TEXT,
          is_compressed BOOLEAN DEFAULT FALSE,
          folder_id VARCHAR(36)
        )
      `);

      // Add uploaded_by column if it doesn't exist (for existing tables)
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN uploaded_by VARCHAR(36)
        `);
      } catch (error: any) {
        // Column might already exist, ignore the error
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      // Add S3 columns if they don't exist (for migration from LONGBLOB)
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN s3_url TEXT
        `);
      } catch (error: any) {
        // Column might already exist, ignore the error
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }
      
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN s3_key TEXT
        `);
      } catch (error: any) {
        // Column might already exist, ignore the error
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      // Add compression flag column if it doesn't exist
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN is_compressed BOOLEAN DEFAULT FALSE
        `);
      } catch (error: any) {
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      // Add file_path column for filesystem storage of large files
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN file_path TEXT
        `);
      } catch (error: any) {
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      // Add lock fields for file locking with PIN
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN is_locked BOOLEAN DEFAULT FALSE
        `);
      } catch (error: any) {
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN lock_pin VARCHAR(255)
        `);
      } catch (error: any) {
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      // Add folder_id column if it doesn't exist
      try {
        await connection.execute(`
          ALTER TABLE files ADD COLUMN folder_id VARCHAR(36)
        `);
      } catch (error: any) {
        if (!error.message.includes('column name is specified more than once') && 
            !error.message.includes('duplicate column') &&
            !error.message.includes('Duplicate column name')) {
        }
      }

      // Create page_settings table for storing page-level settings like /404 PIN
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS page_settings (
          id VARCHAR(36) PRIMARY KEY,
          page_name VARCHAR(255) NOT NULL UNIQUE,
          pin_hash VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better query performance
      try {
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_category ON files(category)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename(255))`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by)`);
      } catch (error: any) {
      }

      // Create a default user if none exists
      const [userRows] = await connection.execute('SELECT COUNT(*) as count FROM users') as [any[], any];
      if (userRows[0].count === 0) {
        const defaultUserId = randomUUID();
        await connection.execute(`
          INSERT INTO users (id, username, email, role, created_at) 
          VALUES (?, 'DefaultUser', 'user@example.com', 'premium', NOW())
        `, [defaultUserId]);
      }

      connection.release();
      this.isInitialized = true;
      console.log('[DB] Database initialized successfully');
    } catch (error) {
      console.error(`[DB] Database initialization failed:`, error);
      console.error(`[DB] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      // Do NOT mark as initialized on error - let it surface
      throw error;
    }
  }

  async createFile(insertFile: InsertFile, fileContent: Buffer, uploadedBy?: string): Promise<FileRecord> {
    await this.ensureInitialized();
    
    const id = randomUUID();
    const uploadedAt = new Date();
    
    // Generate S3 key and upload to S3
    const s3Key = getS3Service().generateFileKey(id, insertFile.originalName);
    const uploadedKey = await getS3Service().uploadFile(
      s3Key,
      fileContent,
      insertFile.mimetype,
      insertFile.originalName
    );
    
    // Verify the uploaded key matches our generated key
    if (uploadedKey !== s3Key) {
      throw new Error('S3 key mismatch after upload');
    }
    
    // Store only metadata in database (no file content, no s3_url as we use presigned URLs)
    await this.pool.execute(
      `INSERT INTO files (id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key, folder_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)`,
      [id, insertFile.filename, insertFile.originalName, insertFile.size, insertFile.mimetype, insertFile.category, insertFile.description || null, uploadedAt, uploadedBy || null, s3Key, insertFile.folderId || null]
    );

    return {
      id,
      filename: insertFile.filename,
      originalName: insertFile.originalName,
      size: insertFile.size,
      mimetype: insertFile.mimetype,
      category: insertFile.category,
      description: insertFile.description || null,
      downloadCount: 0,
      uploadedAt,
      uploadedBy: uploadedBy || null,
      s3Url: '', // No longer storing static URLs - use presigned URLs on-demand
      s3Key,
      isLocked: false,
      lockPin: null,
      folderId: insertFile.folderId || null
    };
  }

  async createFileFromMetadata(insertFile: InsertFile, uploadedBy?: string): Promise<FileRecord> {
    await this.ensureInitialized();
    
    const id = randomUUID();
    const uploadedAt = new Date();
    
    // Ensure s3Key is provided (required for presigned URL generation)
    if (!insertFile.s3Key) {
      throw new Error('S3 key is required for file metadata creation');
    }
    
    // Store metadata in database (file is already uploaded to S3)
    // Store only s3Key, not s3Url as we use presigned URLs on-demand
    await this.pool.execute(
      `INSERT INTO files (id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key, is_locked, lock_pin, folder_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, FALSE, NULL, ?)`,
      [id, insertFile.filename, insertFile.originalName, insertFile.size, insertFile.mimetype, insertFile.category, insertFile.description || null, uploadedAt, uploadedBy || null, insertFile.s3Key, insertFile.folderId || null]
    );

    return {
      id,
      filename: insertFile.filename,
      originalName: insertFile.originalName,
      size: insertFile.size,
      mimetype: insertFile.mimetype,
      category: insertFile.category,
      description: insertFile.description || null,
      downloadCount: 0,
      uploadedAt,
      uploadedBy: uploadedBy || null,
      s3Url: '', // No longer storing static URLs - use presigned URLs on-demand
      s3Key: insertFile.s3Key,
      isLocked: false,
      lockPin: null,
      folderId: insertFile.folderId || null
    };
  }

  async getFile(id: string): Promise<FileRecord | undefined> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      'SELECT * FROM files WHERE id = ?',
      [id]
    ) as [any[], any];

    if (rows.length === 0) return undefined;

    const row = rows[0];
    
    return {
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      size: row.size,
      mimetype: row.mimetype,
      category: row.category,
      description: row.description,
      downloadCount: row.download_count,
      uploadedAt: new Date(row.uploaded_at),
      uploadedBy: row.uploaded_by,
      s3Url: row.s3_url,
      s3Key: row.s3_key,
      isLocked: row.is_locked || false,
      folderId: row.folder_id || null,
      lockPin: row.lock_pin || null,
    };
  }

  async getFiles(category?: string, search?: string, sort?: string, limit = 20, offset = 0): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    try {
      let query = 'SELECT id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key, is_locked, lock_pin, folder_id FROM files WHERE 1=1';
      const params: any[] = [];

      // Filter by category
      if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
      }

      // Filter by search term
      if (search) {
        query += ' AND (original_name LIKE ? OR description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Add sorting logic
      let orderBy = 'uploaded_at DESC'; // default to newest first
      if (sort) {
        switch (sort) {
          case 'recent':
            orderBy = 'uploaded_at DESC';
            break;
          case 'downloads':
            orderBy = 'download_count DESC';
            break;
          case 'name':
            orderBy = 'original_name ASC';
            break;
          case 'size':
            orderBy = 'size DESC';
            break;
          default:
            orderBy = 'uploaded_at DESC';
        }
      }
      query += ` ORDER BY ${orderBy}`;

      // Apply pagination - use string interpolation for LIMIT to avoid parameter binding issues
      const limitNum = Math.max(1, Number(limit) || 20);
      const offsetNum = Math.max(0, Number(offset) || 0);
      
      if (offsetNum > 0) {
        query += ` LIMIT ${offsetNum}, ${limitNum}`;
      } else {
        query += ` LIMIT ${limitNum}`;
      }


      const [rows] = await this.pool.execute(query, params) as [any[], any];

      return rows.map((row: any) => ({
        id: row.id,
        filename: row.filename,
        originalName: row.original_name,
        size: row.size,
        mimetype: row.mimetype,
        category: row.category,
        description: row.description,
        downloadCount: row.download_count,
        uploadedAt: new Date(row.uploaded_at),
        uploadedBy: row.uploaded_by,
        s3Url: row.s3_url,
        s3Key: row.s3_key,
        isLocked: row.is_locked || false,
        lockPin: row.lock_pin || null,
        folderId: row.folder_id || null,
      }));
    } catch (error) {
      console.error(`[STORAGE] getFiles - Database error:`, error);
      throw error;
    }
  }

  async getFilesByFolderId(folderId: string, search?: string, sort?: string, limit = 20, offset = 0): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    try {
      let query = 'SELECT id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key, is_locked, lock_pin, folder_id FROM files WHERE folder_id = ?';
      const params: any[] = [folderId];

      // Filter by search term
      if (search) {
        query += ' AND (original_name LIKE ? OR description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Add sorting logic
      let orderBy = 'uploaded_at DESC'; // default to newest first
      if (sort) {
        switch (sort) {
          case 'recent':
            orderBy = 'uploaded_at DESC';
            break;
          case 'downloads':
            orderBy = 'download_count DESC';
            break;
          case 'name':
            orderBy = 'original_name ASC';
            break;
          case 'size':
            orderBy = 'size DESC';
            break;
          default:
            orderBy = 'uploaded_at DESC';
        }
      }
      query += ` ORDER BY ${orderBy}`;

      // Apply pagination
      const limitNum = Math.max(1, Number(limit) || 20);
      const offsetNum = Math.max(0, Number(offset) || 0);
      
      if (offsetNum > 0) {
        query += ` LIMIT ${offsetNum}, ${limitNum}`;
      } else {
        query += ` LIMIT ${limitNum}`;
      }

      const [rows] = await this.pool.execute(query, params) as [any[], any];

      return rows.map((row: any) => ({
        id: row.id,
        filename: row.filename,
        originalName: row.original_name,
        size: row.size,
        mimetype: row.mimetype,
        category: row.category,
        description: row.description,
        downloadCount: row.download_count,
        uploadedAt: new Date(row.uploaded_at),
        uploadedBy: row.uploaded_by,
        s3Url: row.s3_url,
        s3Key: row.s3_key,
        isLocked: row.is_locked || false,
        lockPin: row.lock_pin || null,
        folderId: row.folder_id || null,
      }));
    } catch (error) {
      console.error(`[STORAGE] getFilesByFolderId - Database error:`, error);
      throw error;
    }
  }

  async incrementDownloadCount(id: string): Promise<FileRecord | undefined> {
    await this.ensureInitialized();
    
    await this.pool.execute(
      'UPDATE files SET download_count = download_count + 1 WHERE id = ?',
      [id]
    );

    return this.getFile(id);
  }

  async updateFile(id: string, updates: { originalName?: string; description?: string; category?: string; folderId?: string | null }): Promise<FileRecord> {
    await this.ensureInitialized();
    
    const setParts: string[] = [];
    const params: any[] = [];

    if (updates.originalName !== undefined) {
      setParts.push('original_name = ?');
      params.push(updates.originalName);
    }
    if (updates.description !== undefined) {
      setParts.push('description = ?');
      params.push(updates.description);
    }
    if (updates.category !== undefined) {
      setParts.push('category = ?');
      params.push(updates.category);
    }
    if (updates.folderId !== undefined) {
      setParts.push('folder_id = ?');
      params.push(updates.folderId);
    }

    if (setParts.length === 0) {
      throw new Error('No updates provided');
    }

    params.push(id);

    await this.pool.execute(
      `UPDATE files SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );

    const updatedFile = await this.getFile(id);
    if (!updatedFile) {
      throw new Error('File not found after update');
    }

    return updatedFile;
  }

  async deleteFile(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // First get the file to get its S3 key
    const file = await this.getFile(id);
    
    if (!file) {
      throw new Error('File not found');
    }
    
    if (file.s3Key) {
      // Delete from S3 first - this must succeed
      const s3DeleteSuccess = await getS3Service().deleteFile(file.s3Key);
      
      if (!s3DeleteSuccess) {
        console.error(`Failed to delete file from S3: ${file.s3Key}`);
        throw new Error('Failed to delete file from S3 storage');
      }
    }
    
    // Only delete from database if S3 deletion succeeded (or no S3 key)
    const [result] = await this.pool.execute(
      'DELETE FROM files WHERE id = ?',
      [id]
    ) as [any, any];

    const dbDeleteSuccess = result.affectedRows > 0;
    
    if (!dbDeleteSuccess) {
      console.error(`Failed to delete file from database: ${id}`);
    }

    return dbDeleteSuccess;
  }

  async lockFile(id: string, hashedPin: string): Promise<FileRecord | undefined> {
    await this.ensureInitialized();
    
    await this.pool.execute(
      'UPDATE files SET is_locked = TRUE, lock_pin = ? WHERE id = ?',
      [hashedPin, id]
    );

    return this.getFile(id);
  }

  async unlockFile(id: string, hashedPin: string): Promise<{ success: boolean; file?: FileRecord }> {
    await this.ensureInitialized();
    
    const file = await this.getFile(id);
    
    if (!file) {
      return { success: false };
    }
    
    // Verify the PIN matches
    if (file.lockPin !== hashedPin) {
      return { success: false };
    }
    
    // Remove lock
    await this.pool.execute(
      'UPDATE files SET is_locked = FALSE, lock_pin = NULL WHERE id = ?',
      [id]
    );

    const unlockedFile = await this.getFile(id);
    return { success: true, file: unlockedFile };
  }

  async verifyFilePin(id: string, hashedPin: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const file = await this.getFile(id);
    
    if (!file || !file.isLocked) {
      return false;
    }
    
    return file.lockPin === hashedPin;
  }

  async getFileCount(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      const [rows] = await this.pool.execute(
        'SELECT COUNT(*) as count FROM files'
      ) as [any[], any];

      return rows[0].count;
    } catch (error) {
      console.error(`[STORAGE] getFileCount - Database error:`, error);
      throw error;
    }
  }

  async getTotalDownloads(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      const [rows] = await this.pool.execute(
        'SELECT SUM(download_count) as total FROM files'
      ) as [any[], any];

      return rows[0].total || 0;
    } catch (error) {
      console.error(`[STORAGE] getTotalDownloads - Database error:`, error);
      throw error;
    }
  }

  async getCategoryStats(): Promise<Record<string, number>> {
    await this.ensureInitialized();
    
    try {
      const [rows] = await this.pool.execute(
        'SELECT category, COUNT(*) as count FROM files GROUP BY category'
      ) as [any[], any];

      const stats: Record<string, number> = {};
      for (const row of rows) {
        stats[row.category] = row.count;
      }
      return stats;
    } catch (error) {
      console.error(`[STORAGE] getCategoryStats - Database error:`, error);
      throw error;
    }
  }

  async getTotalStorageUsed(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      const [rows] = await this.pool.execute(
        'SELECT SUM(size) as total FROM files'
      ) as [any[], any];

      return rows[0].total || 0;
    } catch (error) {
      console.error(`[STORAGE] getTotalStorageUsed - Database error:`, error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<UserRecord> {
    await this.ensureInitialized();
    
    const id = randomUUID();
    const createdAt = new Date();
    
    await this.pool.execute(
      `INSERT INTO users (id, username, email, avatar, role, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, insertUser.username, insertUser.email, insertUser.avatar || null, insertUser.role || 'user', createdAt]
    );

    return {
      id,
      ...insertUser,
      avatar: insertUser.avatar || null,
      role: insertUser.role || 'user',
      createdAt,
    };
  }

  async getUser(id: string): Promise<UserRecord | undefined> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    ) as [any[], any];

    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      avatar: row.avatar,
      role: row.role,
      createdAt: new Date(row.created_at),
    };
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    ) as [any[], any];
    
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      avatar: row.avatar,
      role: row.role,
      createdAt: new Date(row.created_at),
    };
  }

  async getUserStats(userId: string): Promise<{uploadedFiles: number, totalDownloads: number, storageUsed: string}> {
    await this.ensureInitialized();
    
    // Get uploaded files count
    const [uploadCountRows] = await this.pool.execute(
      'SELECT COUNT(*) as count FROM files WHERE uploaded_by = ?',
      [userId]
    ) as [any[], any];

    // Get total downloads for user's files
    const [downloadRows] = await this.pool.execute(
      'SELECT SUM(download_count) as total FROM files WHERE uploaded_by = ?',
      [userId]
    ) as [any[], any];

    // Get storage used by user
    const [storageRows] = await this.pool.execute(
      'SELECT SUM(size) as total FROM files WHERE uploaded_by = ?',
      [userId]
    ) as [any[], any];

    const storageBytes = storageRows[0].total || 0;
    const formatStorage = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return {
      uploadedFiles: uploadCountRows[0].count || 0,
      totalDownloads: downloadRows[0].total || 0,
      storageUsed: formatStorage(storageBytes),
    };
  }

  async getActiveUsersCount(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      // Get count of unique uploaders in the last 30 days
      const [rows] = await this.pool.execute(
        'SELECT COUNT(DISTINCT uploaded_by) as active FROM files WHERE uploaded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND uploaded_by IS NOT NULL'
      ) as [any[], any];

      const activeCount = Math.max(1, rows[0].active || 0);
      return activeCount;
    } catch (error) {
      console.error(`[STORAGE] getActiveUsersCount - Database error:`, error);
      throw error;
    }
  }

  async getRecentDownloads(): Promise<any[]> {
    await this.ensureInitialized();
    
    // Since we don't have a downloads table, we'll return files sorted by recent activity
    // In a real implementation, you'd track individual download events
    const [rows] = await this.pool.execute(
      `SELECT original_name as fileName, category, size, uploaded_at as downloadTime
       FROM files 
       WHERE download_count > 0 
       ORDER BY uploaded_at DESC 
       LIMIT 20`
    ) as [any[], any];

    return rows.map((row: any) => ({
      fileName: row.fileName,
      category: row.category,
      fileSize: this.formatFileSize(row.size),
      downloadTime: this.timeAgo(new Date(row.downloadTime)),
      ipAddress: 'Unknown' // Would need download tracking table for this
    }));
  }

  async getAllFilesWithStats(): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      `SELECT id, filename, original_name, size, mimetype, category, description, 
       download_count, uploaded_at, uploaded_by, s3_url, s3_key, is_locked, lock_pin, folder_id 
       FROM files 
       ORDER BY download_count DESC, uploaded_at DESC`
    ) as [any[], any];

    return rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      size: row.size,
      mimetype: row.mimetype,
      category: row.category,
      description: row.description,
      downloadCount: row.download_count,
      uploadedAt: new Date(row.uploaded_at),
      uploadedBy: row.uploaded_by,
      s3Url: row.s3_url,
      s3Key: row.s3_key,
      isLocked: row.is_locked || false,
      lockPin: row.lock_pin || null,
      folderId: row.folder_id || null,
    }));
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private timeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  }

  // Folder operations
  async createFolder(folder: InsertFolder, createdBy?: string): Promise<FolderRecord> {
    await this.ensureInitialized();
    
    const id = randomUUID();
    const createdAt = new Date();
    
    await this.pool.execute(
      `INSERT INTO folders (id, name, description, created_at, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, folder.name, folder.description || null, createdAt, createdBy || null]
    );

    return {
      id,
      name: folder.name,
      description: folder.description || null,
      createdAt,
      createdBy: createdBy || null
    };
  }

  async getFolder(id: string): Promise<FolderRecord | undefined> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      `SELECT id, name, description, created_at, created_by FROM folders WHERE id = ?`,
      [id]
    ) as [any[], any];

    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }

  async getFolders(): Promise<FolderRecord[]> {
    await this.ensureInitialized();
    
    // Predefined folders
    const predefinedFolders: FolderRecord[] = [
      { id: 'Software', name: 'Software', description: 'Software files', createdAt: new Date(), createdBy: null },
      { id: 'Video', name: 'Video', description: 'Video files', createdAt: new Date(), createdBy: null },
      { id: 'Image', name: 'Image', description: 'Image files', createdAt: new Date(), createdBy: null },
      { id: 'APK', name: 'APK', description: 'APK files', createdAt: new Date(), createdBy: null },
      { id: 'Script', name: 'Script', description: 'Script files', createdAt: new Date(), createdBy: null },
      { id: 'Archive', name: 'Archive', description: 'Archive files', createdAt: new Date(), createdBy: null },
      { id: 'Config', name: 'Config', description: 'Config files', createdAt: new Date(), createdBy: null }
    ];
    
    const [rows] = await this.pool.execute(
      `SELECT id, name, description, created_at, created_by FROM folders ORDER BY name ASC`
    ) as [any[], any];

    const customFolders = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    }));

    // Combine predefined and custom folders, avoiding duplicates
    const allFolders = [...predefinedFolders];
    for (const customFolder of customFolders) {
      if (!allFolders.find(f => f.id === customFolder.id)) {
        allFolders.push(customFolder);
      }
    }

    return allFolders;
  }

  async deleteFolder(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // First, move all files in this folder to no folder (NULL folderId)
    await this.pool.execute(
      `UPDATE files SET folder_id = NULL WHERE folder_id = ?`,
      [id]
    );

    // Then delete the folder
    const [result] = await this.pool.execute(
      `DELETE FROM folders WHERE id = ?`,
      [id]
    ) as [any, any];

    return (result as any).affectedRows > 0;
  }

  async setPagePin(pageName: string, pinHash: string): Promise<void> {
    await this.ensureInitialized();
    
    const id = randomUUID();
    await this.pool.execute(
      `INSERT INTO page_settings (id, page_name, pin_hash) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE pin_hash = ?, updated_at = NOW()`,
      [id, pageName, pinHash, pinHash]
    );
  }

  async verifyPagePin(pageName: string, pinHash: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      `SELECT pin_hash FROM page_settings WHERE page_name = ?`,
      [pageName]
    ) as [any[], any];

    if (rows.length === 0) return true; // No PIN set, allow access
    return rows[0].pin_hash === pinHash;
  }

  async hasPagePin(pageName: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const [rows] = await this.pool.execute(
      `SELECT pin_hash FROM page_settings WHERE page_name = ? AND pin_hash IS NOT NULL`,
      [pageName]
    ) as [any[], any];

    return rows.length > 0;
  }
}


export const storage = new MySQLStorage();
