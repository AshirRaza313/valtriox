// ============================================================================
// Cloudinary Client - Multi-Tenant Media Storage for Valtriox Clients
// ============================================================================
// Valtriox uses ONE Cloudinary account with folder-based multi-tenancy.
// Each client's files are stored under: /org-{orgId}/{bucket}/
//
// Client-facing storage (product images, logos, chat attachments, marketing
// assets) uses Cloudinary for CDN, auto-optimization, and transformations.
//
// Platform-facing storage (payment proofs, invoices, system documents) stays
// on Supabase Storage for security and privacy.
//
// Admin configures Cloudinary credentials via Platform Settings → Storage.
// Credentials stored in SystemSetting table: key = "storage_cloudinary_config"
// ============================================================================

import { v2 as cloudinary, UploadApiResponse, ResourceApiResponse, DeleteApiResponse } from "cloudinary";
import { db, ensureDb, withRetry } from "@/lib/db";
import logger from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  enabled: boolean;
  folderPrefix?: string; // default: "org"
}

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number; // bytes
  error?: string;
}

export interface CloudinaryUsageInfo {
  totalFiles: number;
  totalBytes: number;
  totalMb: number;
  breakdown: Record<string, { files: number; bytes: number }>;
}

// ─── Bucket Constants ────────────────────────────────────────────────────────
// These map to Cloudinary sub-folders under each org folder.

export const CLOUDINARY_BUCKETS = {
  PRODUCT_IMAGES: "products",
  LOGOS: "logos",
  CHAT_ATTACHMENTS: "chat",
  MARKETING: "marketing",
  DOCUMENTS: "documents",
  BRAND_ASSETS: "brand-assets",
} as const;

export type CloudinaryBucket = (typeof CLOUDINARY_BUCKETS)[keyof typeof CLOUDINARY_BUCKETS];

// File size limits per bucket (in MB)
export const CLOUDINARY_SIZE_LIMITS: Record<CloudinaryBucket, number> = {
  products: 10,
  logos: 5,
  chat: 20,
  marketing: 25,
  documents: 50,
  "brand-assets": 25,
};

// Allowed MIME type groups per bucket
const ALLOWED_TYPES: Record<CloudinaryBucket, string[]> = {
  products: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  logos: ["image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/x-icon"],
  chat: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"],
  marketing: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"],
  documents: ["application/pdf", "image/jpeg", "image/png"],
  "brand-assets": ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "video/mp4"],
};

// ─── Singleton ───────────────────────────────────────────────────────────────

let _configured = false;
let _config: CloudinaryConfig | null = null;

/**
 * Load Cloudinary config from SystemSetting table.
 * Falls back to env vars if no DB setting exists.
 */
async function loadConfig(): Promise<CloudinaryConfig | null> {
  try {
    await ensureDb();

    const setting = await withRetry(async () => {
      return await db.systemSetting.findUnique({
        where: { key: "storage_cloudinary_config" },
      });
    }, 2, 500);

    if (setting) {
      const parsed = JSON.parse(setting.value) as CloudinaryConfig;
      if (parsed.enabled && parsed.cloudName && parsed.apiKey && parsed.apiSecret) {
        return parsed;
      }
    }
  } catch (err) {
    logger.warn("[Cloudinary] Failed to load DB config", { error: String(err) });
  }

  // Fallback to environment variables
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return {
      cloudName,
      apiKey,
      apiSecret,
      enabled: true,
      folderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX || "org",
    };
  }

  return null;
}

/**
 * Ensure Cloudinary SDK is configured. Returns true if ready.
 */
async function ensureConfigured(): Promise<boolean> {
  if (_configured && _config) return true;

  const cfg = await loadConfig();
  if (!cfg) return false;

  try {
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true,
    });
    _config = cfg;
    _configured = true;
    return true;
  } catch (err) {
    logger.error("[Cloudinary] Configuration failed", err);
    return false;
  }
}

// ─── Public Helpers ───────────────────────────────────────────────────────────

/** Check if Cloudinary is available for uploads */
export async function isCloudinaryAvailable(): Promise<boolean> {
  return ensureConfigured();
}

/** Get current config (for admin UI display, keys masked) */
export async function getCloudinaryConfigForAdmin(): Promise<{
  available: boolean;
  cloudName?: string;
  apiKeyMasked?: string;
  apiSecretMasked?: string;
  source: "database" | "env" | "none";
}> {
  try {
    await ensureDb();

    const setting = await withRetry(async () => {
      return await db.systemSetting.findUnique({
        where: { key: "storage_cloudinary_config" },
      });
    }, 2, 500);

    if (setting) {
      const parsed = JSON.parse(setting.value) as CloudinaryConfig;
      return {
        available: parsed.enabled && !!parsed.cloudName,
        cloudName: parsed.cloudName || undefined,
        apiKeyMasked: parsed.apiKey ? `${parsed.apiKey.slice(0, 4)}${"•".repeat(Math.min(parsed.apiKey.length - 4, 12))}` : undefined,
        apiSecretMasked: parsed.apiSecret ? `${"•".repeat(Math.min(parsed.apiSecret.length, 16))}` : undefined,
        source: "database",
      };
    }
  } catch {
    // Ignore
  }

  const envCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  if (envCloud) {
    return {
      available: true,
      cloudName: envCloud,
      apiKeyMasked: process.env.CLOUDINARY_API_KEY ? `${"•".repeat(8)}` : undefined,
      apiSecretMasked: process.env.CLOUDINARY_API_SECRET ? `${"•".repeat(12)}` : undefined,
      source: "env",
    };
  }

  return { available: false, source: "none" };
}

/** Generate the org folder path */
export function getOrgFolder(orgId: string): string {
  const prefix = _config?.folderPrefix || "org";
  return `${prefix}-${orgId}`;
}

/** Generate full public path for a file */
export function getPublicPath(orgId: string, bucket: CloudinaryBucket, fileName?: string): string {
  const orgFolder = getOrgFolder(orgId);
  if (fileName) {
    return `${orgFolder}/${bucket}/${fileName}`;
  }
  return `${orgFolder}/${bucket}`;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

/**
 * Upload a file to Cloudinary.
 * @param orgId - Organization ID (tenant)
 * @param bucket - Cloudinary bucket (sub-folder)
 * @param fileBuffer - File buffer (from FormData)
 * @param originalName - Original file name
 * @param mimeType - MIME type
 * @param options - Additional upload options
 */
export async function uploadFile(
  orgId: string,
  bucket: CloudinaryBucket,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  options?: {
    transformation?: object;
    publicId?: string;
    overwrite?: boolean;
  }
): Promise<UploadResult> {
  const configured = await ensureConfigured();
  if (!configured) {
    return { success: false, error: "Cloudinary is not configured. Contact platform admin." };
  }

  // Validate file size
  const sizeLimit = CLOUDINARY_SIZE_LIMITS[bucket] * 1024 * 1024;
  if (fileBuffer.length > sizeLimit) {
    return { success: false, error: `File exceeds ${CLOUDINARY_SIZE_LIMITS[bucket]}MB limit for ${bucket}` };
  }

  // Validate MIME type
  const allowed = ALLOWED_TYPES[bucket];
  if (!allowed.includes(mimeType)) {
    return { success: false, error: `File type '${mimeType}' not allowed in ${bucket}` };
  }

  // Sanitize file name
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const publicId = options?.publicId || `${getOrgFolder(orgId)}/${bucket}/${timestamp}-${sanitized.split(".")[0]}`;

  try {
    const uploadOptions: any = {
      public_id: publicId,
      resource_type: "auto",
      overwrite: options?.overwrite ?? false,
      folder: `${getOrgFolder(orgId)}/${bucket}`,
      use_filename: true,
      unique_filename: true,
    };

    // Image-specific optimizations
    if (mimeType.startsWith("image/")) {
      uploadOptions.quality = "auto";
      uploadOptions.fetch_format = "auto"; // Auto-convert to WebP when browser supports
    }

    if (options?.transformation) {
      uploadOptions.transformation = options.transformation;
    }

    const result: UploadApiResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  } catch (err: any) {
    logger.error("[Cloudinary] Upload failed", err);
    return { success: false, error: err?.message || "Upload failed" };
  }
}

/**
 * Upload a base64 data URL to Cloudinary.
 * Useful when the client sends base64-encoded images.
 */
export async function uploadBase64(
  orgId: string,
  bucket: CloudinaryBucket,
  base64DataUrl: string,
  fileName?: string,
  options?: { transformation?: object; publicId?: string }
): Promise<UploadResult> {
  const configured = await ensureConfigured();
  if (!configured) {
    return { success: false, error: "Cloudinary is not configured" };
  }

  // Extract MIME type and data from data URL
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return { success: false, error: "Invalid base64 data URL format" };
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  return uploadFile(orgId, bucket, buffer, fileName || `upload.${mimeType.split("/")[1] || "bin"}`, mimeType, options);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a file from Cloudinary by public ID.
 */
export async function deleteFile(publicId: string): Promise<{ success: boolean; error?: string }> {
  const configured = await ensureConfigured();
  if (!configured) {
    return { success: false, error: "Cloudinary is not configured" };
  }

  try {
    const result: DeleteApiResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    if (result.result === "ok" || result.result === "not found") {
      return { success: true };
    }

    return { success: false, error: `Delete failed: ${result.result}` };
  } catch (err: any) {
    logger.error("[Cloudinary] Delete failed", err);
    return { success: false, error: err?.message || "Delete failed" };
  }
}

/**
 * Delete all files in an org's specific bucket folder.
 */
export async function deleteOrgFolder(orgId: string, bucket: CloudinaryBucket): Promise<{ deleted: number; error?: string }> {
  const configured = await ensureConfigured();
  if (!configured) {
    return { deleted: 0, error: "Cloudinary is not configured" };
  }

  try {
    const prefix = `${getOrgFolder(orgId)}/${bucket}/`;

    // List all resources with prefix
    const resources = await new Promise<ResourceApiResponse>((resolve, reject) => {
      cloudinary.api.resources_by_prefix(prefix, {
        type: "upload",
        max_results: 500,
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result as ResourceApiResponse);
      });
    });

    if (!resources.resources || resources.resources.length === 0) {
      return { deleted: 0 };
    }

    // Delete all found resources
    const publicIds = resources.resources.map(r => r.public_id);
    const deleteResult = await new Promise<DeleteApiResponse>((resolve, reject) => {
      cloudinary.api.delete_resources(publicIds, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    return { deleted: publicIds.length };
  } catch (err: any) {
    logger.error("[Cloudinary] Folder delete failed", err);
    return { deleted: 0, error: err?.message || "Delete failed" };
  }
}

// ─── Usage Tracking ─────────────────────────────────────────────────────────

/**
 * Get storage usage for a specific organization from Cloudinary.
 * Lists all resources under the org folder and sums their sizes.
 */
export async function getOrgCloudinaryUsage(orgId: string): Promise<CloudinaryUsageInfo> {
  const configured = await ensureConfigured();
  if (!configured) {
    return { totalFiles: 0, totalBytes: 0, totalMb: 0, breakdown: {} };
  }

  const prefix = getOrgFolder(orgId);
  let totalFiles = 0;
  let totalBytes = 0;
  const breakdown: Record<string, { files: number; bytes: number }> = {};

  // Initialize breakdown for all buckets
  for (const bucket of Object.values(CLOUDINARY_BUCKETS)) {
    breakdown[bucket] = { files: 0, bytes: 0 };
  }

  try {
    // Paginate through all resources (max 500 per request)
    let nextCursor: string | undefined;
    let fetchedAll = false;

    while (!fetchedAll) {
      const resources = await new Promise<ResourceApiResponse>((resolve, reject) => {
        const params: any = {
          type: "upload",
          prefix,
          max_results: 500,
          direction: "desc",
        };
        if (nextCursor) params.next_cursor = nextCursor;

        cloudinary.api.resources(params, (error, result) => {
          if (error) reject(error);
          else resolve(result as ResourceApiResponse);
        });
      });

      if (!resources.resources || resources.resources.length === 0) {
        fetchedAll = true;
        break;
      }

      for (const resource of resources.resources) {
        const bytes = resource.bytes || 0;
        totalFiles++;
        totalBytes += bytes;

        // Determine which bucket this belongs to
        for (const bucketName of Object.values(CLOUDINARY_BUCKETS)) {
          if (resource.public_id.includes(`/${bucketName}/`)) {
            breakdown[bucketName].files++;
            breakdown[bucketName].bytes += bytes;
            break;
          }
        }
      }

      // Check for more pages
      if (resources.next_cursor) {
        nextCursor = resources.next_cursor;
      } else {
        fetchedAll = true;
      }
    }
  } catch (err: any) {
    logger.warn("[Cloudinary] Usage fetch failed", { error: err?.message || String(err) });
  }

  return {
    totalFiles,
    totalBytes,
    totalMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    breakdown,
  };
}

// ─── Transformations ────────────────────────────────────────────────────────

/**
 * Generate a transformed URL (resize, crop, etc.) without re-uploading.
 * Useful for thumbnails, different sizes from the same source.
 */
export function getTransformedUrl(publicIdOrUrl: string, options: {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string;
  format?: string;
  gravity?: string;
}): string {
  try {
    // If it's already a Cloudinary URL, extract public_id
    let publicId: string;

    if (publicIdOrUrl.includes("res.cloudinary.com")) {
      // Extract from URL: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{public_id}.{format}
      const urlObj = new URL(publicIdOrUrl);
      const pathParts = urlObj.pathname.split("/");
      // path: /{cloud}/image/upload/{...parts...}/filename.ext
      const uploadIndex = pathParts.findIndex(p => p === "upload");
      if (uploadIndex === -1) return publicIdOrUrl;

      publicId = pathParts.slice(uploadIndex + 1).join("/").replace(/\.[^.]+$/, "");
    } else {
      publicId = publicIdOrUrl;
    }

    const chain: any[] = [];

    if (options.width || options.height) {
      chain.push({
        width: options.width,
        height: options.height,
        crop: options.crop || "limit",
        ...(options.gravity ? { gravity: options.gravity } : {}),
      });
    }

    if (options.quality) {
      chain.push({ quality: options.quality });
    }

    if (options.format) {
      chain.push({ fetch_format: options.format });
    }

    if (chain.length > 0) {
      return cloudinary.url(publicId, {
        type: "upload",
        transformation: chain.length === 1 ? chain[0] : chain,
        secure: true,
      });
    }

    return cloudinary.url(publicId, { type: "upload", secure: true });
  } catch {
    return publicIdOrUrl;
  }
}

/**
 * Get a thumbnail URL from a Cloudinary URL or public ID.
 */
export function getThumbnail(url: string, size: number = 200): string {
  return getTransformedUrl(url, { width: size, height: size, crop: "thumb", gravity: "face", quality: "auto", format: "auto" });
}
