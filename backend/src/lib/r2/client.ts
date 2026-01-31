import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 configuration from environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'flashread-documents';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn('R2 credentials not configured. Document upload/download will not work.');
}

// R2 is S3-compatible, so we use the S3 SDK
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned URL for uploading a file to R2
 * @param key - The storage key (path) for the object in R2
 * @param contentType - The MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned upload URL
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading a file from R2
 * @param key - The storage key (path) for the object in R2
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned download URL
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Delete an object from R2
 * @param key - The storage key (path) for the object in R2
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Generate a unique storage key for a document
 * @param userId - The user ID
 * @param filename - The original filename
 * @returns Storage key in format: userId/timestamp-randomId-filename
 */
export function generateStorageKey(userId: string, filename: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${timestamp}-${randomId}-${sanitizedFilename}`;
}
