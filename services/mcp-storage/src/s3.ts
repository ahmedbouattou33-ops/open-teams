import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppEnv } from "./env.js";

/** Presigned URL lifetime — 15 minutes, per the storage contract. */
export const PRESIGN_EXPIRES_SECONDS = 900;

export interface StorageBackend {
  readonly bucketName: string;
  /** Idempotently creates the bucket if it does not exist (MinIO/dev convenience). */
  ensureBucket(): Promise<void>;
  presignPut(key: string, mimeType: string): Promise<string>;
  presignGet(key: string): Promise<string>;
  objectExists(key: string): Promise<{ exists: boolean; size: number | null }>;
}

export function createStorageBackend(env: AppEnv): StorageBackend {
  // forcePathStyle is required for MinIO/localstack-style endpoints.
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });

  return {
    bucketName: env.S3_BUCKET_NAME,

    async ensureBucket(): Promise<void> {
      try {
        await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET_NAME }));
        return;
      } catch {
        // Missing (or inaccessible) — attempt creation; surfaces real errors.
      }
      await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET_NAME }));
    },

    async presignPut(key, mimeType): Promise<string> {
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
        ContentType: mimeType,
      });
      return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SECONDS });
    },

    async presignGet(key): Promise<string> {
      const command = new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key });
      return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SECONDS });
    },

    async objectExists(key): Promise<{ exists: boolean; size: number | null }> {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key }));
        return { exists: true, size: head.ContentLength ?? null };
      } catch {
        return { exists: false, size: null };
      }
    },
  };
}
