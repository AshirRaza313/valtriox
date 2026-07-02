// ============================================================================
// Platform Document Files API — Upload, List, Delete
// ============================================================================
// Manages uploaded files (PDFs, images, etc.) stored in Cloudinary.
// Text-based documents are in /api/admin/documents (SystemSetting).
// This route handles binary file uploads.
//
// GET    - List all uploaded files with metadata
// POST   - Upload a new file (multipart FormData → Cloudinary)
// PUT    - Update file metadata (title, description)
// DELETE - Delete file from Cloudinary + database
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db, withRetry, safeDbQuery } from "@/lib/db";
import { withAuth, isPlatformRole, AuthContext } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { uploadFile, deleteFile, CLOUDINARY_BUCKETS } from "@/lib/cloudinary";
import { formatFileSize } from "@/lib/utils";

// Allow up to 60 seconds for large file uploads on Vercel
export const maxDuration = 60;

// Allowed MIME types for platform documents
const ALLOWED_MIME_TYPES: Record<string, string> = {
  // PDFs
  "application/pdf": "pdf",
  // Images
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/svg+xml": "image",
  // Documents
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.ms-powerpoint": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  // Text
  "text/plain": "document",
  "text/csv": "spreadsheet",
  // Archives
  "application/zip": "archive",
  "application/x-rar-compressed": "archive",
};

// Phase 6: Magic byte validation — verifies file content matches claimed MIME type
const MAGIC_BYTES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/gif": [0x47, 0x49, 0x46], // GIF
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
  "application/zip": [0x50, 0x4B, 0x03, 0x04], // PK
  "application/x-rar-compressed": [0x52, 0x61, 0x72], // Rar
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return true; // No magic byte check for this type — allow
  if (buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

// Phase 6: Filename sanitization — prevents path traversal and XSS in filenames
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // Remove invalid chars
    .replace(/\.\./g, "")                    // Remove path traversal
    .replace(/^\s+|\s+$/g, "")              // Trim
    .substring(0, 255)                       // Limit length
    || "unnamed-file";                       // Fallback name
}

// Max file size: 50MB for platform documents
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════════════
// GET - List all uploaded platform documents
// ═══════════════════════════════════════════════════════════════════════════

export const GET = withRateLimit(withAuth(async (_req: NextRequest, authCtx: AuthContext) => {
  try {
    const { data: files, error } = await safeDbQuery(async () => {
      // ── Scope to caller's org unless they are a platform admin ──
      const where: any = { isActive: true };
      if (!isPlatformRole(authCtx.role) && authCtx.organizationId) {
        where.organizationId = authCtx.organizationId;
      }
      return await db.platformDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }, 3, 500);

    if (error) {
      logger.error("[DocumentFiles] GET error:", error);
      return NextResponse.json({ files: [], fallback: true });
    }

    // Add human-readable size
    const formatted = (files || []).map((f) => ({
      ...f,
      sizeFormatted: formatFileSize(f.fileSize),
    }));

    return NextResponse.json({ files: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[DocumentFiles] GET error:", message);
    return NextResponse.json({ files: [] });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════════
// POST - Upload a new file
// ═══════════════════════════════════════════════════════════════════════════

export const POST = withRateLimit(withAuth(async (req: NextRequest, authCtx: AuthContext) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";
    const category = (formData.get("category") as string) || "uploaded";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`,
      }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Validate MIME type
    const fileType = ALLOWED_MIME_TYPES[file.type];
    if (!fileType) {
      return NextResponse.json({
        error: `File type '${file.type}' is not supported. Supported types: PDF, images, Word, Excel, PowerPoint, text, CSV.`,
      }, { status: 400 });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Phase 6: Validate magic bytes to detect spoofed MIME types
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json({
        error: `File content does not match the claimed type '${file.type}'. Upload rejected for security.`,
      }, { status: 400 });
    }

    // Phase 6: Sanitize filename
    const safeFileName = sanitizeFileName(file.name);

    // Upload to Cloudinary
    // Use "documents" bucket with a platform-specific org ID
    const platformOrgId = "valtriox-platform";
    const uploadResult = await uploadFile(
      platformOrgId,
      CLOUDINARY_BUCKETS.DOCUMENTS,
      buffer,
      file.name,
      file.type,
      {
        publicId: `platform-docs/${Date.now()}-${safeFileName.replace(/\.[^.]+$/, "")}`,
      }
    );

    if (!uploadResult.success) {
      logger.error("[DocumentFiles] Upload to Cloudinary failed:", uploadResult.error);
      return NextResponse.json({
        error: `Upload failed: ${uploadResult.error}`,
      }, { status: 500 });
    }

    // Save metadata to database
    const { data: saved, error: dbError } = await safeDbQuery(async () => {
      return await db.platformDocument.create({
        data: {
          title: title || safeFileName.replace(/\.[^.]+$/, ""),
          description: description || null,
          fileName: safeFileName,
          fileSize: file.size,
          mimeType: file.type,
          fileType,
          cloudinaryUrl: uploadResult.url || null,
          cloudinaryPublicId: uploadResult.publicId || null,
          category,
          uploadedBy: authCtx.userId,
          organizationId: authCtx.organizationId || null,
        },
      });
    }, 2, 500);

    if (dbError) {
      logger.error("[DocumentFiles] DB save failed:", dbError);
      // Try to clean up Cloudinary upload
      if (uploadResult.publicId) {
        await deleteFile(uploadResult.publicId).catch(() => {});
      }
      return NextResponse.json({ error: "Failed to save file metadata" }, { status: 503 });
    }

    if (!saved) {
      return NextResponse.json({ error: "Failed to save file metadata" }, { status: 503 });
    }

    logger.info("[DocumentFiles] File uploaded successfully", {
      id: saved.id,
      title: saved.title,
      fileType: saved.fileType,
      fileName: saved.fileName,
      fileSize: saved.fileSize,
      userId: authCtx.userId,
    });

    return NextResponse.json({
      success: true,
      file: {
        ...saved,
        sizeFormatted: formatFileSize(saved.fileSize),
      },
      message: "File uploaded successfully!",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[DocumentFiles] POST error:", message);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════════
// PUT - Update file metadata
// ═══════════════════════════════════════════════════════════════════════════

export const PUT = withRateLimit(withAuth(async (req: NextRequest, authCtx: AuthContext) => {
  try {
    const body = await req.json();
    const { id, title, description, category } = body;

    if (!id) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    // ── Verify the file exists and the user has access ──
    const { data: existing, error: fetchError } = await safeDbQuery(async () => {
      return await db.platformDocument.findUnique({ where: { id } });
    }, 2, 500);

    if (fetchError || !existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ── Org ownership check ──
    if (!isPlatformRole(authCtx.role) && existing.organizationId && existing.organizationId !== authCtx.organizationId) {
      logger.warn("[DocumentFiles] PUT cross-org access denied", {
        userId: authCtx.userId,
        fileOrgId: existing.organizationId,
        callerOrgId: authCtx.organizationId,
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: updated, error } = await safeDbQuery(async () => {
      return await db.platformDocument.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category ? { category } : {}),
        },
      });
    }, 2, 500);

    if (error || !updated) {
      logger.error("[DocumentFiles] PUT error:", error);
      return NextResponse.json({ error: "Failed to update file metadata" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      file: {
        ...updated,
        sizeFormatted: formatFileSize(updated.fileSize),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[DocumentFiles] PUT error:", message);
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// ═══════════════════════════════════════════════════════════════════════════
// DELETE - Delete a file from Cloudinary + database
// ═══════════════════════════════════════════════════════════════════════════

export const DELETE = withRateLimit(withAuth(async (req: NextRequest, authCtx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }
    const { data: file, error: fetchError } = await safeDbQuery(async () => {
      return await db.platformDocument.findUnique({ where: { id: fileId } });
    }, 2, 500);

    if (fetchError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // ── Org ownership check ──
    if (!isPlatformRole(authCtx.role) && file.organizationId && file.organizationId !== authCtx.organizationId) {
      logger.warn("[DocumentFiles] DELETE cross-org access denied", {
        userId: authCtx.userId,
        fileOrgId: file.organizationId,
        callerOrgId: authCtx.organizationId,
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete from Cloudinary
    if (file.cloudinaryPublicId) {
      await deleteFile(file.cloudinaryPublicId).catch((err) => {
        logger.warn("[DocumentFiles] Cloudinary delete failed:", err);
      });
    }

    // Soft delete from database
    const { error: deleteError } = await safeDbQuery(async () => {
      return await db.platformDocument.update({
        where: { id: fileId },
        data: { isActive: false },
      });
    }, 2, 500);

    if (deleteError) {
      logger.error("[DocumentFiles] DELETE error:", deleteError);
      return NextResponse.json({ error: "Failed to delete file" }, { status: 503 });
    }

    logger.info("[DocumentFiles] File deleted", { id: fileId, title: file.title, userId: authCtx.userId });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[DocumentFiles] DELETE error:", message);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// ─── Helper ────────────────────────────────────────────────────────────────

// formatFileSize moved to src/lib/utils.ts (Phase 8)
