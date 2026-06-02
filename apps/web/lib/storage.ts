/**
 * Storage abstraction for uploaded files (Nequi QR images, payment proofs).
 *
 * Two drivers, selected by the STORAGE_DRIVER env var:
 *   - "local" (default): writes to apps/web/public/uploads, served statically.
 *                        Used for local development.
 *   - "s3":              uploads to a private S3 bucket. Used in staging/prod.
 *                        Objects are read back through the /api/files proxy.
 *
 * Security: saveUpload() validates both the declared MIME type AND the file's
 * magic bytes (first bytes of the file content) to prevent disguised uploads
 * (e.g. a .php script renamed to .jpg). S3 buckets don't execute uploaded files,
 * but magic-byte validation is still good practice.
 *
 * This module is server-only (node + aws-sdk imports). Do not import it from
 * Client Components — import lib/file-url.ts instead.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, { ext: string; magic: number[][] }> = {
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/png":  { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF
  "application/pdf": { ext: "pdf", magic: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
};

export function storageDriver(): "s3" | "local" {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

function validateFile(body: Buffer, mimeType: string): string {
  const spec = ALLOWED_TYPES[mimeType];
  if (!spec) throw new Error("Sube una imagen JPG, PNG, WEBP o un archivo PDF.");

  // Magic-bytes check: verify file content matches the declared MIME type.
  const matches = spec.magic.some((sig) =>
    sig.every((byte, i) => body[i] === byte),
  );
  if (!matches) {
    throw new Error("El archivo no es válido o está dañado. Intenta con otra imagen o PDF.");
  }

  // WebP extra: the RIFF header is shared with other formats; confirm "WEBP" at offset 8.
  if (mimeType === "image/webp") {
    const marker = body.slice(8, 12).toString("ascii");
    if (marker !== "WEBP") {
      throw new Error("El archivo no es una imagen WEBP válida.");
    }
  }

  return spec.ext;
}

// Lazily-initialised S3 client so the local driver never loads AWS config.
let cachedClient: S3Client | null = null;
async function s3() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET no está configurado.");
  if (!cachedClient) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    // Custom-named credentials because AWS Amplify forbids env vars starting
    // with "AWS". Falls back to the SDK default provider chain when not set.
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
 * Validates MIME type and magic bytes before saving.
 */
export async function saveUpload(file: File, prefix: string): Promise<string | null> {
  if (!file.size) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo no puede superar 12 MB.");

  const body = Buffer.from(await file.arrayBuffer());
  const extension = validateFile(body, file.type); // throws if invalid

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
