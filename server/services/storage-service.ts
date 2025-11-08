/**
 * Storage Service - Abstraction for file storage
 * Supports local filesystem, S3, Azure Blob, NFS
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export interface StorageConfig {
  type: 'local' | 's3' | 'azure' | 'nfs';
  // Local storage
  localPath?: string;
  // S3
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  // Azure Blob
  azureAccountName?: string;
  azureAccountKey?: string;
  azureContainer?: string;
  // NFS
  nfsMountPoint?: string;
}

export class StorageService {
  private config: StorageConfig;
  private s3Client: S3Client | null = null;

  constructor(config: StorageConfig) {
    this.config = config;

    // Initialize S3 client if configured
    if (config.type === 's3' && config.s3AccessKeyId && config.s3SecretAccessKey) {
      this.s3Client = new S3Client({
        region: config.s3Region || 'eu-central-1', // Default: Frankfurt (Deutschland/Europa)
        credentials: {
          accessKeyId: config.s3AccessKeyId,
          secretAccessKey: config.s3SecretAccessKey,
        },
      });
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(filePath: string, data: Buffer | string, contentType?: string): Promise<string> {
    const fileName = path.basename(filePath);

    switch (this.config.type) {
      case 'local':
        return this.uploadLocal(filePath, data);
      
      case 's3':
        return this.uploadS3(filePath, data, contentType);
      
      case 'azure':
        return this.uploadAzure(filePath, data, contentType);
      
      case 'nfs':
        return this.uploadNFS(filePath, data);
      
      default:
        throw new Error(`Unsupported storage type: ${this.config.type}`);
    }
  }

  /**
   * Download a file
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    switch (this.config.type) {
      case 'local':
        return this.downloadLocal(filePath);
      
      case 's3':
        return this.downloadS3(filePath);
      
      case 'azure':
        return this.downloadAzure(filePath);
      
      case 'nfs':
        return this.downloadNFS(filePath);
      
      default:
        throw new Error(`Unsupported storage type: ${this.config.type}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    switch (this.config.type) {
      case 'local':
        return this.deleteLocal(filePath);
      
      case 's3':
        return this.deleteS3(filePath);
      
      case 'azure':
        return this.deleteAzure(filePath);
      
      case 'nfs':
        return this.deleteNFS(filePath);
      
      default:
        throw new Error(`Unsupported storage type: ${this.config.type}`);
    }
  }

  // Local storage implementation
  private async uploadLocal(filePath: string, data: Buffer | string): Promise<string> {
    const fullPath = path.join(this.config.localPath || './uploads', filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return fullPath;
  }

  private async downloadLocal(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.config.localPath || './uploads', filePath);
    return await fs.readFile(fullPath);
  }

  private async deleteLocal(filePath: string): Promise<void> {
    const fullPath = path.join(this.config.localPath || './uploads', filePath);
    await fs.unlink(fullPath);
  }

  // S3 storage implementation
  private async uploadS3(filePath: string, data: Buffer | string, contentType?: string): Promise<string> {
    if (!this.s3Client || !this.config.s3Bucket) {
      throw new Error('S3 not configured');
    }

    const buffer = typeof data === 'string' ? Buffer.from(data) : data;

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: filePath,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    }));

    return `s3://${this.config.s3Bucket}/${filePath}`;
  }

  private async downloadS3(filePath: string): Promise<Buffer> {
    if (!this.s3Client || !this.config.s3Bucket) {
      throw new Error('S3 not configured');
    }

    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: filePath,
    }));

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  private async deleteS3(filePath: string): Promise<void> {
    if (!this.s3Client || !this.config.s3Bucket) {
      throw new Error('S3 not configured');
    }

    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: filePath,
    }));
  }

  // Azure Blob storage implementation (placeholder)
  private async uploadAzure(filePath: string, data: Buffer | string, contentType?: string): Promise<string> {
    // TODO: Implement Azure Blob Storage
    throw new Error('Azure Blob Storage not yet implemented');
  }

  private async downloadAzure(filePath: string): Promise<Buffer> {
    throw new Error('Azure Blob Storage not yet implemented');
  }

  private async deleteAzure(filePath: string): Promise<void> {
    throw new Error('Azure Blob Storage not yet implemented');
  }

  // NFS storage implementation
  private async uploadNFS(filePath: string, data: Buffer | string): Promise<string> {
    if (!this.config.nfsMountPoint) {
      throw new Error('NFS mount point not configured');
    }

    const fullPath = path.join(this.config.nfsMountPoint, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return fullPath;
  }

  private async downloadNFS(filePath: string): Promise<Buffer> {
    if (!this.config.nfsMountPoint) {
      throw new Error('NFS mount point not configured');
    }

    const fullPath = path.join(this.config.nfsMountPoint, filePath);
    return await fs.readFile(fullPath);
  }

  private async deleteNFS(filePath: string): Promise<void> {
    if (!this.config.nfsMountPoint) {
      throw new Error('NFS mount point not configured');
    }

    const fullPath = path.join(this.config.nfsMountPoint, filePath);
    await fs.unlink(fullPath);
  }
}

// Initialize storage service from environment variables
export function createStorageService(): StorageService {
  const storageType = (process.env.STORAGE_TYPE || 'local') as 'local' | 's3' | 'azure' | 'nfs';

  const config: StorageConfig = {
    type: storageType,
    localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION || 'eu-central-1', // Default: Frankfurt (Deutschland/Europa)
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    azureAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    azureAccountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    azureContainer: process.env.AZURE_STORAGE_CONTAINER,
    nfsMountPoint: process.env.NFS_MOUNT_POINT,
  };

  return new StorageService(config);
}

export const storageService = createStorageService();

