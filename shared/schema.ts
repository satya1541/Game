import { z } from "zod";

// Type definitions for MySQL schema
export interface UserRecord {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  role: 'user' | 'premium' | 'admin';
  createdAt: Date;
}

export interface FileRecord {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  category: string;
  description: string | null;
  downloadCount: number;
  uploadedAt: Date;
  uploadedBy: string | null;
  s3Url: string; // Always required for S3 storage
  s3Key: string; // Always required for S3 storage
}

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1).max(255),
  email: z.string().email().max(255),
  avatar: z.string().optional(),
  role: z.enum(['user', 'premium', 'admin']).default('user'),
});

export const insertFileSchema = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  size: z.number().int().positive(),
  mimetype: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  // Content is handled separately for S3 upload, not in schema
  s3Url: z.string().optional(),
  s3Key: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;

// File categories enum
export const FILE_CATEGORIES = {
  APKS: 'apks',
  SOFTWARES: 'softwares', 
  SCRIPTS: 'scripts',
  ARCHIVES: 'archives',
  CONFIGS: 'configs',
  REGS: 'regs',
  EMULATORS: 'emulators'
} as const;

export type FileCategory = typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES];

// Supported file extensions
export const SUPPORTED_EXTENSIONS = [
  '.apk', '.xapk', '.exe', '.bat', '.zip', '.rar', '.7z', 
  '.cfg', '.config', '.ini', '.json', '.xml', '.txt',
  '.md', '.log', '.sh', '.py', '.js', '.html', '.css', '.reg'
];
