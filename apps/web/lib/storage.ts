/**
 * Storage abstraction for uploaded files (Nequi QR images, payment proofs).
 *
 * Two drivers, selected by the STORAGE_DRIVER env var:
 *   - "local" (default): writes to apps/web/public/uploads, served statically.
 *                        Used for local development.
 *   - "s3":              uploads to a private S3 bucket. Used in staging/prod.
 *                        Objects are read back through the /api/files proxy.
 *
 * The value returned by saveUpload() is what gets stored in the database. Use
 * resolveFileUrl() (lib/file-url.ts) to turn it into a browser URL at render
 * time. Mixed values are supported, so switching drivers does not break rows
 * created under the other driver.
 *
 * This module is server-only (node + aws-sdk imports). Do not import it from
 * Client Components — import lib/file-url.ts instead.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function storageDriver(): "s3" | "local" {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

function extensionFor(type: string) {
  const extension = EXTENSIONS[type];
  if (!extension) throw new Error("Sube una imagen JPG, PNG, WEBP o un archivo PDF.");
  return extension;
}

// Lazily-initialised S3 client so the local driver never loads AWS config.
let cachedClient: S3Client | null = null;
async function s3() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET no está configurado.");
  if (!cachedClient) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    // Custom-named credentials are used because AWS Amplify forbids env vars
    // that start with "AWS". When they are not set (e.g. local dev or when
    // running on an IAM role), we fall back to the SDK default provider chain.
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    cachedClient = new S3Client({
      region: process.env.S3_REGION || process.env.AWS_REGION,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }
  return { client: cachedClient, bucket };
}

/**
 * Persists an uploaded file and returns the reference to store in the database.
 * Returns null when no file was provided (empty input).
 */
export async function saveUpload(file: File, prefix: string): Promise<string | null> {
  if (!file.size) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo no puede superar 12 MB.");
  const extension = extensionFor(file.type);
  const body = Buffer.from(await file.arrayBuffer());

  if (storageDriver() === "s3") {
    const { client, bucket } = await s3();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = `${prefix}/${randomUUID()}.${extension}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type,
      }),
    );
    return key;
  }

  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const fileName = `${prefix}-${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, fileName), body);
  return `/uploads/${fileName}`;
}

/**
 * Reads an object back from S3 for the /api/files proxy route.
 * Only valid when the s3 driver is active.
 */
export async function getObject(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const { client, bucket } = await s3();
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = result.Body as { transformToByteArray(): Promise<Uint8Array> } | undefined;
  if (!body) throw new Error("Objeto vacío.");
  return {
    bytes: await body.transformToByteArray(),
    contentType: result.ContentType ?? "application/octet-stream",
  };
}
