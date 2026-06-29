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
import { withAuth } from "@/lib/auth-middleware";
import logger from "@/lib/logger";
import { uploadFile, deleteFile, CLOUDINARY_BUCKETS } from "@/lib/cloudinary";

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

// Max file size: 50MB for platform documents
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════════════
// GET - List all uploaded platform documents
// ═══════════════════════════════════════════════════════════════════════════

export const GET = withAuth(async (_req: NextRequest, authCtx) => {
  try {
    const { data: files, error } = await safeDbQuery(async () => {
      return await db.platformDocument.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
    }, 3, 500);

    if (error) {
      logger.error("[DocumentFiles] GET error:", error);
      return NextResponse.json({ files: [], fallback: true });
    }

    // Add human-readable size
    const formatted = files.map((f) => ({
      ...f,
      sizeFormatted: formatFileSize(f.fileSize),
    }));

    return NextResponse.json({ files: formatted });
  } catch (error: any) {
    logger.error("[DocumentFiles] GET error:", error);
    return NextResponse.json({ files: [] });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// ═══════════════════════════════════════════════════════════════════════════
// POST - Upload a new file
// ═══════════════════════════════════════════════════════════════════════════

export const POST = withAuth(async (req: NextRequest, authCtx) => {
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
        publicId: `platform-docs/${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}`,
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
          title: title || file.name.replace(/\.[^.]+$/, ""),
          description: description || null,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileType,
          cloudinaryUrl: uploadResult.url || null,
          cloudinaryPublicId: uploadResult.publicId || null,
          category,
          uploadedBy: authCtx.userId,
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
  } catch (error: any) {
    logger.error("[DocumentFiles] POST error:", error?.message || error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// ═══════════════════════════════════════════════════════════════════════════
// PUT - Update file metadata
// ═══════════════════════════════════════════════════════════════════════════

export const PUT = withAuth(async (req: NextRequest, authCtx) => {
  try {
    const body = await req.json();
    const { id, title, description, category } = body;

    if (!id) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
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

    if (error) {
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
  } catch (error: any) {
    logger.error("[DocumentFiles] PUT error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// ═══════════════════════════════════════════════════════════════════════════
// DELETE - Delete a file from Cloudinary + database
// ═══════════════════════════════════════════════════════════════════════════

export const DELETE = withAuth(async (req: NextRequest, authCtx) => {
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
  } catch (error: any) {
    logger.error("[DocumentFiles] DELETE error:", error?.message || error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });

// ─── Helper ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
