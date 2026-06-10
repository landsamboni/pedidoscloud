import type { NextRequest } from "next/server";
import { getObject, storageDriver } from "@/lib/storage";

// Prefixes saveUpload() writes under. The proxy only serves keys in this set so
// it can never be used to probe arbitrary objects, even though the bucket is
// already private and keys are UUID-based.
const ALLOWED_PREFIXES = new Set([
  "logo",
  "nequi-qr",
  "menu-template",
  "payment-qr",
  "menu-item",
  "payment-proof",
]);

// Same-origin proxy for files stored in the private S3 bucket.
// Object keys are UUID-based and therefore unguessable; the bucket itself
// blocks all public access. When the local driver is active, files are served
// directly from /public/uploads and this route returns 404.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  if (storageDriver() !== "s3") {
    return new Response("Not found", { status: 404 });
  }

  const { key } = await params;
  const objectKey = key.join("/");

  // Reject path traversal and anything outside the known upload prefixes.
  if (objectKey.includes("..") || !ALLOWED_PREFIXES.has(key[0] ?? "")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { bytes, contentType } = await getObject(objectKey);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
