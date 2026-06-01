/**
 * Converts a stored file reference into a browser-usable URL.
 *
 * Stored references come in two shapes depending on the storage driver that
 * created them (see lib/storage.ts):
 *   - local driver  -> "/uploads/<file>"   (served by Next.js from /public)
 *   - s3 driver      -> "<prefix>/<uuid>.<ext>"  (a bare S3 object key)
 *
 * S3 keys are served same-origin through the /api/files proxy so the bucket
 * stays fully private and next/image keeps working without remotePatterns.
 *
 * This module is intentionally dependency-free (no node/aws imports) so it can
 * be imported from both Server and Client Components.
 */
export function resolveFileUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  // Local path or an already-absolute URL: use as-is.
  if (stored.startsWith("/") || stored.startsWith("http://") || stored.startsWith("https://")) {
    return stored;
  }
  // Bare S3 key: route through the same-origin proxy.
  return `/api/files/${stored}`;
}
