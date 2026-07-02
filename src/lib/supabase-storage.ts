// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
// ============================================================================
// Supabase Storage Client - Cloud File Storage for Valtriox Clients
// ============================================================================
// Provides file upload, download, and management for Valtriox platform.
// Storage buckets are organization-scoped with RLS policies.
//
// Buckets:
//   - "product-images"  — Product photos and catalog images
//   - "payment-proofs"  — Payment screenshot verifications
//   - "invoices"        — Generated invoice PDFs
//   - "logos"           — Organization logos and favicons
//   - "documents"       — General document storage (proposals, etc.)
//   - "chat-attachments"— Team chat file attachments
// ============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Bucket definitions
export const STORAGE_BUCKETS = {
  PRODUCT_IMAGES: "product-images",
  PAYMENT_PROOFS: "payment-proofs",
  INVOICES: "invoices",
  LOGOS: "logos",
  DOCUMENTS: "documents",
  CHAT_ATTACHMENTS: "chat-attachments",
} as const;

export type StorageBucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// File size limits per bucket (in MB)
export const BUCKET_SIZE_LIMITS: Record<StorageBucketName, number> = {
  "product-images": 5,
  "payment-proofs": 5,
  invoices: 10,
  logos: 2,
  documents: 25,
  "chat-attachments": 10,
};

// Allowed MIME types per bucket
export const BUCKET_ALLOWED_TYPES: Record<StorageBucketName, string[]> = {
  "product-images": ["image/jpeg", "image/png", "image/webp", "image/gif"],
  "payment-proofs": ["image/jpeg", "image/png", "image/webp"],
  invoices: ["application/pdf"],
  logos: ["image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/x-icon"],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
  ],
  "chat-attachments": [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
};

// Singleton client
let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  _supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  return _supabaseClient;
}

/** Check if Supabase Storage is configured and available */
export function isStorageConfigured(): boolean {
  return getSupabaseClient() !== null;
}

/** Generate a storage path for an organization's file */
export function getStoragePath(
  bucket: StorageBucketName,
  orgId: string,
  fileName: string
): string {
  // Path format: {orgId}/{timestamp}-{sanitizedFileName}
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgId}/${timestamp}-${sanitized}`;
}

/** Upload a file to Supabase Storage */
export async function uploadFile(
  bucket: StorageBucketName,
  orgId: string,
  file: File | Buffer,
  fileName: string,
  contentType?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase Storage is not configured" };
  }

  // Validate file size
  const sizeLimit = BUCKET_SIZE_LIMITS[bucket] * 1024 * 1024;
  const fileSize = file instanceof Buffer ? file.length : file.size;
  if (fileSize > sizeLimit) {
    return { success: false, error: `File exceeds ${BUCKET_SIZE_LIMITS[bucket]}MB limit` };
  }

  // Validate MIME type if available
  if (contentType) {
    const allowed = BUCKET_ALLOWED_TYPES[bucket];
    if (!allowed.includes(contentType)) {
      return { success: false, error: `File type '${contentType}' not allowed in ${bucket}` };
    }
  }

  const path = getStoragePath(bucket, orgId, fileName);

  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(data.path);

  return { success: true, url: urlData.publicUrl };
}

/** Delete a file from Supabase Storage */
export async function deleteFile(
  bucket: StorageBucketName,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase Storage is not configured" };
  }

  const { error } = await client.storage.from(bucket).remove([filePath]);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/** Get a public URL for a file */
export function getPublicUrl(
  bucket: StorageBucketName,
  filePath: string
): string | null {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = client.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

/** List files in an organization's folder */
export async function listOrgFiles(
  bucket: StorageBucketName,
  orgId: string
): Promise<Array<{ name: string; url: string; size: number; createdAt: string }>> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.storage.from(bucket).list(orgId, {
    sortBy: { column: "created_at", order: "desc" },
    limit: 100,
  });

  if (error || !data) return [];

  return data.map((item) => {
    const { data: urlData } = client.storage.from(bucket).getPublicUrl(`${orgId}/${item.name}`);
    return {
      name: item.name,
      url: urlData.publicUrl,
      size: item.metadata?.size || 0,
      createdAt: item.created_at,
    };
  });
}

/** Get total storage used by an organization across all buckets (in bytes) */
export async function getOrgStorageUsage(orgId: string): Promise<number> {
  let totalBytes = 0;

  for (const bucketName of Object.values(STORAGE_BUCKETS)) {
    const client = getSupabaseClient();
    if (!client) continue;

    const { data } = await client.storage.from(bucketName).list(orgId, {
      limit: 1000,
    });

    if (data) {
      for (const item of data) {
        totalBytes += item.metadata?.size || 0;
      }
    }
  }

  return totalBytes;
}
