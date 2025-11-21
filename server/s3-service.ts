import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private s3Client: S3Client | null = null;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.AWS_BUCKET_NAME || 'workbucket1541';
  }

  /**
   * Initialize S3 client with credentials from environment variables
   */
  private initialize(): void {
    if (this.s3Client) return; // Already initialized

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not found in environment variables. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file');
    }

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-2',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Performance optimizations
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 30000,
        socketTimeout: 300000,
      },
    });
  }

  /**
   * Upload a file to S3 with automatic multipart for large files (optimized for speed)
   */
  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    originalName: string
  ): Promise<string> {
    this.initialize();
    const fileSizeThreshold = 25 * 1024 * 1024; // 25MB threshold for multipart (lower for better performance)
    
    if (fileBuffer.length > fileSizeThreshold) {
      // Use multipart upload for large files (much faster)
      return await this.uploadFileMultipart(key, fileBuffer, contentType, originalName);
    } else {
      // Use regular upload for smaller files
      return await this.uploadFileRegular(key, fileBuffer, contentType, originalName);
    }
  }

  /**
   * Regular S3 upload for smaller files
   */
  private async uploadFileRegular(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    originalName: string
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        originalName: originalName,
      },
    });

    await this.s3Client!.send(command);
    
    // Return only the S3 key - presigned URLs will be generated on-demand for downloads
    return key;
  }

  /**
   * Multipart upload for large files (much faster for large files)
   */
  private async uploadFileMultipart(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    originalName: string
  ): Promise<string> {
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks for faster parallel uploads
    const chunks = [];
    
    // Split file into chunks
    for (let i = 0; i < fileBuffer.length; i += chunkSize) {
      chunks.push(fileBuffer.slice(i, i + chunkSize));
    }

    // Initialize multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: {
        originalName: originalName,
      },
    });

    const createResponse = await this.s3Client!.send(createCommand);
    const uploadId = createResponse.UploadId!;

    try {
      // Upload chunks in parallel for maximum speed
      const uploadPromises = chunks.map(async (chunk, index) => {
        const partNumber = index + 1;
        const uploadCommand = new UploadPartCommand({
          Bucket: this.bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: chunk,
        });

        const response = await this.s3Client!.send(uploadCommand);
        return {
          ETag: response.ETag!,
          PartNumber: partNumber,
        };
      });

      // Wait for all uploads to complete
      const uploadedParts = await Promise.all(uploadPromises);

      // Complete the multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: uploadedParts,
        },
      });

      await this.s3Client!.send(completeCommand);

      // Return only the S3 key - presigned URLs will be generated on-demand for downloads
      return key;

    } catch (error) {
      // Abort the multipart upload on error
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client!.send(abortCommand);
      throw error;
    }
  }

  /**
   * Get a file from S3
   */
  async getFile(key: string): Promise<Buffer> {
    this.initialize();
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client!.send(command);
    
    if (!response.Body) {
      throw new Error('File not found in S3');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      this.initialize();
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client!.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      this.initialize();
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client!.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a signed URL for temporary access (optional, for private files)
   */
  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    this.initialize();
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client!, command, { expiresIn });
  }

  /**
   * Generate a presigned download URL with response header overrides to force browser download
   */
  async getPresignedDownloadUrl(
    key: string, 
    responseHeaders: Record<string, string> = {}, 
    expiresIn = 3600
  ): Promise<{ url: string; headers: Record<string, string> }> {
    this.initialize();
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: responseHeaders['response-content-disposition'],
      ResponseContentType: responseHeaders['response-content-type'],
    });

    const url = await getSignedUrl(this.s3Client!, command, { expiresIn });
    
    return {
      url,
      headers: responseHeaders
    };
  }

  /**
   * Generate S3 key for a file
   */
  generateFileKey(fileId: string, originalName: string): string {
    // Create a path structure like: files/{year}/{month}/{fileId}-{originalName}
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Clean the filename to be S3-safe
    const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `files/${year}/${month}/${fileId}-${cleanName}`;
  }

  /**
   * Generate a presigned URL for uploading files directly to S3
   */
  async getPresignedPutUrl(
    key: string, 
    contentType: string, 
    expiresIn = 600
  ): Promise<{ url: string; headers: Record<string, string> }> {
    this.initialize();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client!, command, { expiresIn });
    
    return {
      url,
      headers: {
        'Content-Type': contentType
      }
    };
  }

  /**
   * Start a multipart upload for large files
   */
  async createMultipartUpload(
    key: string,
    contentType: string,
    originalName: string
  ): Promise<{ uploadId: string; key: string }> {
    this.initialize();
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: {
        originalName: originalName,
      },
    });

    const response = await this.s3Client!.send(command);
    
    if (!response.UploadId) {
      throw new Error('Failed to create multipart upload');
    }

    return {
      uploadId: response.UploadId,
      key
    };
  }

  /**
   * Get presigned URL for uploading a part in multipart upload
   */
  async getPresignedUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 600
  ): Promise<{ url: string; headers: Record<string, string> }> {
    this.initialize();
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(this.s3Client!, command, { expiresIn });
    
    return {
      url,
      headers: {}
    };
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>
  ): Promise<string> {
    this.initialize();
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    await this.s3Client!.send(command);
    
    // Return only the S3 key - presigned URLs will be generated on-demand for downloads
    return key;
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.initialize();
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    });

    await this.s3Client!.send(command);
  }

  /**
   * Get public URL for uploaded file
   */
  getPublicUrl(key: string): string {
    return `https://s3.ap-south-2.amazonaws.com/${this.bucketName}/${key}`;
  }
}

let s3ServiceInstance: S3Service | null = null;

export function getS3Service(): S3Service {
  if (!s3ServiceInstance) {
    s3ServiceInstance = new S3Service();
  }
  return s3ServiceInstance;
}
