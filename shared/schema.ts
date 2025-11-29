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

export interface FolderRecord {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  createdBy: string | null;
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
  isLocked: boolean;
  lockPin: string | null;
  folderId: string | null; // Reference to folder
}

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1).max(255),
  email: z.string().email().max(255),
  avatar: z.string().optional(),
  role: z.enum(['user', 'premium', 'admin']).default('user'),
});

export const insertFolderSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
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
  folderId: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

// File categories enum
export const FILE_CATEGORIES = {
  APKS: 'apks',
  SOFTWARES: 'softwares', 
  SCRIPTS: 'scripts',
  ARCHIVES: 'archives',
  CONFIGS: 'configs',
  REGS: 'regs',
  EMULATORS: 'emulators',
  IMAGES: 'images',
  VIDEOS: 'videos'
} as const;

export type FileCategory = typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES];

