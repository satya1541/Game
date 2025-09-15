import { type FileRecord, type InsertFile, type UserRecord, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getS3Service } from './s3-service';

export interface IStorage {
  // File operations
  createFile(file: InsertFile, fileContent: Buffer, uploadedBy?: string): Promise<FileRecord>;
  createFileFromMetadata(file: InsertFile, uploadedBy?: string): Promise<FileRecord>;
  getFile(id: string): Promise<FileRecord | undefined>;
  getFiles(category?: string, search?: string, sort?: string, limit?: number, offset?: number): Promise<FileRecord[]>;
  incrementDownloadCount(id: string): Promise<FileRecord | undefined>;
  updateFile(id: string, updates: { originalName?: string; description?: string; category?: string }): Promise<FileRecord>;
  deleteFile(id: string): Promise<boolean>;
  
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
}

export class MySQLStorage implements IStorage {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: "40.192.74.89",
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

    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    console.log(`[DB] Starting database initialization...`);
    try {
      console.log(`[DB] Attempting to get connection from pool...`);
      const connection = await this.pool.getConnection();
      console.log(`[DB] Database connection successful!`);
      
      console.log(`[DB] Creating users table if it doesn't exist...`);
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
      console.log(`[DB] Users table created/verified successfully`);
      

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
          is_compressed BOOLEAN DEFAULT FALSE
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

      // Create indexes for better query performance
      try {
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_category ON files(category)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)`);
        await connection.execute(`CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename(255))`);
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

      console.log(`[DB] All database initialization completed successfully!`);
      connection.release();
    } catch (error) {
      console.error(`[DB] Database initialization failed:`, error);
      console.error(`[DB] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  }

  async createFile(insertFile: InsertFile, fileContent: Buffer, uploadedBy?: string): Promise<FileRecord> {
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
      `INSERT INTO files (id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?)`,
      [id, insertFile.filename, insertFile.originalName, insertFile.size, insertFile.mimetype, insertFile.category, insertFile.description || null, uploadedAt, uploadedBy || null, s3Key]
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
      s3Key
    };
  }

  async createFileFromMetadata(insertFile: InsertFile, uploadedBy?: string): Promise<FileRecord> {
    const id = randomUUID();
    const uploadedAt = new Date();
    
    // Ensure s3Key is provided (required for presigned URL generation)
    if (!insertFile.s3Key) {
      throw new Error('S3 key is required for file metadata creation');
    }
    
    // Store metadata in database (file is already uploaded to S3)
    // Store only s3Key, not s3Url as we use presigned URLs on-demand
    await this.pool.execute(
      `INSERT INTO files (id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?)`,
      [id, insertFile.filename, insertFile.originalName, insertFile.size, insertFile.mimetype, insertFile.category, insertFile.description || null, uploadedAt, uploadedBy || null, insertFile.s3Key]
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
      s3Key: insertFile.s3Key
    };
  }

  async getFile(id: string): Promise<FileRecord | undefined> {
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
    };
  }

  async getFiles(category?: string, search?: string, sort?: string, limit = 20, offset = 0): Promise<FileRecord[]> {
    console.log(`[STORAGE] getFiles - Starting query with params:`, { category, search, sort, limit, offset });
    try {
      let query = 'SELECT id, filename, original_name, size, mimetype, category, description, download_count, uploaded_at, uploaded_by, s3_url, s3_key FROM files WHERE 1=1';
      const params: any[] = [];

      // Filter by category
      if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
        console.log(`[STORAGE] getFiles - Added category filter: ${category}`);
      }

      // Filter by search term
      if (search) {
        query += ' AND (original_name LIKE ? OR description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
        console.log(`[STORAGE] getFiles - Added search filter: ${search}`);
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
      console.log(`[STORAGE] getFiles - Added ordering: ${orderBy}`);

      // Apply pagination - use string interpolation for LIMIT to avoid parameter binding issues
      const limitNum = Math.max(1, Number(limit) || 20);
      const offsetNum = Math.max(0, Number(offset) || 0);
      
      if (offsetNum > 0) {
        query += ` LIMIT ${offsetNum}, ${limitNum}`;
      } else {
        query += ` LIMIT ${limitNum}`;
      }

      console.log(`[STORAGE] getFiles - Final query:`, query);
      console.log(`[STORAGE] getFiles - Query params:`, params);

      const [rows] = await this.pool.execute(query, params) as [any[], any];

      console.log(`[STORAGE] getFiles - Query successful, ${rows.length} files returned`);
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
        filePath: row.file_path,
        isCompressed: Boolean(row.is_compressed),
      }));
    } catch (error) {
      console.error(`[STORAGE] getFiles - Database error:`, error);
      throw error;
    }
  }

  async incrementDownloadCount(id: string): Promise<FileRecord | undefined> {
    await this.pool.execute(
      'UPDATE files SET download_count = download_count + 1 WHERE id = ?',
      [id]
    );

    return this.getFile(id);
  }

  async updateFile(id: string, updates: { originalName?: string; description?: string; category?: string }): Promise<FileRecord> {
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

  async getFileCount(): Promise<number> {
    console.log(`[STORAGE] getFileCount - Starting query`);
    try {
      const [rows] = await this.pool.execute(
        'SELECT COUNT(*) as count FROM files'
      ) as [any[], any];

      console.log(`[STORAGE] getFileCount - Query successful, count: ${rows[0].count}`);
      return rows[0].count;
    } catch (error) {
      console.error(`[STORAGE] getFileCount - Database error:`, error);
      throw error;
    }
  }

  async getTotalDownloads(): Promise<number> {
    console.log(`[STORAGE] getTotalDownloads - Starting query`);
    try {
      const [rows] = await this.pool.execute(
        'SELECT SUM(download_count) as total FROM files'
      ) as [any[], any];

      console.log(`[STORAGE] getTotalDownloads - Query successful, total: ${rows[0].total || 0}`);
      return rows[0].total || 0;
    } catch (error) {
      console.error(`[STORAGE] getTotalDownloads - Database error:`, error);
      throw error;
    }
  }

  async getCategoryStats(): Promise<Record<string, number>> {
    console.log(`[STORAGE] getCategoryStats - Starting query`);
    try {
      const [rows] = await this.pool.execute(
        'SELECT category, COUNT(*) as count FROM files GROUP BY category'
      ) as [any[], any];

      console.log(`[STORAGE] getCategoryStats - Query successful, ${rows.length} categories found`);
      const stats: Record<string, number> = {};
      for (const row of rows) {
        console.log(`[STORAGE] getCategoryStats - Category: ${row.category}, Count: ${row.count}`);
        stats[row.category] = row.count;
      }
      console.log(`[STORAGE] getCategoryStats - Final stats:`, stats);
      return stats;
    } catch (error) {
      console.error(`[STORAGE] getCategoryStats - Database error:`, error);
      throw error;
    }
  }

  async getTotalStorageUsed(): Promise<number> {
    console.log(`[STORAGE] getTotalStorageUsed - Starting query`);
    try {
      const [rows] = await this.pool.execute(
        'SELECT SUM(size) as total FROM files'
      ) as [any[], any];

      console.log(`[STORAGE] getTotalStorageUsed - Query successful, total: ${rows[0].total || 0}`);
      return rows[0].total || 0;
    } catch (error) {
      console.error(`[STORAGE] getTotalStorageUsed - Database error:`, error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<UserRecord> {
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
    console.log(`[STORAGE] getActiveUsersCount - Starting query`);
    try {
      // Get count of unique uploaders in the last 30 days
      const [rows] = await this.pool.execute(
        'SELECT COUNT(DISTINCT uploaded_by) as active FROM files WHERE uploaded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND uploaded_by IS NOT NULL'
      ) as [any[], any];

      const activeCount = Math.max(1, rows[0].active || 0);
      console.log(`[STORAGE] getActiveUsersCount - Query successful, active users: ${activeCount}`);
      return activeCount;
    } catch (error) {
      console.error(`[STORAGE] getActiveUsersCount - Database error:`, error);
      throw error;
    }
  }

  async getRecentDownloads(): Promise<any[]> {
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
    const [rows] = await this.pool.execute(
      `SELECT id, filename, original_name, size, mimetype, category, description, 
       download_count, uploaded_at, uploaded_by, s3_url, s3_key 
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
}

export const storage = new MySQLStorage();