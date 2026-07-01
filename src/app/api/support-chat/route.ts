import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth, isPlatformRole } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

// ============================================================================
// GET /api/support-chat
// ============================================================================
// For ADMIN (platform_owner/platform_admin/owner):
//   ?mode=conversations  → list all client conversations
//   ?conversationId=xxx  → get messages for a specific conversation
//
// For CLIENT (brand_owner, etc.):
//   ?mode=messages       → get messages for their own org's conversation
// ============================================================================

export const GET = withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "messages";
    const conversationId = searchParams.get("conversationId");
    const platformAdmin = isPlatformRole(authCtx.role);

    // ── ADMIN: List all conversations ──
    if (platformAdmin && mode === "conversations") {
      const conversations = await withRetry(async () => {
        return await db.supportConversation.findMany({
        orderBy: { lastMessageAt: "desc" },
        take: 100,
        select: {
          id: true,
          organizationId: true,
          orgName: true,
          lastMessage: true,
          lastMessageAt: true,
          unreadAdmin: true,
        },
      })
      }, 2, 500);

      return NextResponse.json({
        conversations: conversations.map((c) => ({
          id: c.id,
          orgId: c.organizationId,
          orgName: c.orgName,
          lastMessage: c.lastMessage,
          lastMessageTime: c.lastMessageAt.getTime(),
          unreadCount: c.unreadAdmin,
        })),
      });
    }

    // ── ADMIN: Get messages for a specific conversation ──
    if (platformAdmin && conversationId) {
      const messages = await withRetry(async () => {
        return await db.supportMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      take: 200,
    })
    }, 2, 500);

      // Mark admin messages as read
      await withRetry(async () => {
        return await db.supportConversation.update({
        where: { id: conversationId },
        data: { unreadAdmin: 0 },
      })
      }, 2, 500);

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderName: m.senderName,
          senderAvatar: m.senderAvatar || undefined,
          senderRole: m.senderRole,
          content: m.content,
          timestamp: m.createdAt.getTime(),
          type: m.messageType,
          attachment: m.attachmentData ? JSON.parse(m.attachmentData) : undefined,
          voiceNote: m.voiceNoteData ? JSON.parse(m.voiceNoteData) : undefined,
          callInfo: m.callInfoData ? JSON.parse(m.callInfoData) : undefined,
        })),
      });
    }

    // ── CLIENT: Get their own org's conversation messages ──
    const orgId = authCtx.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    let conversation = await db.supportConversation.findUnique({
      where: { organizationId: orgId },
    });

    if (!conversation) {
      // No conversation yet - return empty
      return NextResponse.json({ messages: [] });
    }

    const messages = await withRetry(async () => {
      return await db.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    take: 200,
  })
  }, 2, 500);

    // Mark client messages as read
    await withRetry(async () => {
      return await db.supportConversation.update({
      where: { id: conversation.id },
      data: { unreadClient: 0 },
    })
    }, 2, 500);

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar || undefined,
        senderRole: m.senderRole,
        content: m.content,
        timestamp: m.createdAt.getTime(),
        type: m.messageType,
        attachment: m.attachmentData ? JSON.parse(m.attachmentData) : undefined,
        voiceNote: m.voiceNoteData ? JSON.parse(m.voiceNoteData) : undefined,
        callInfo: m.callInfoData ? JSON.parse(m.callInfoData) : undefined,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Support chat GET error", message);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch support messages" }, { status: 500 });
  }
});

// ============================================================================
// POST /api/support-chat
// ============================================================================
// Body: {
//   conversationId?: string   // Admin sends this to target a specific conversation
//   content: string
//   messageType: "text" | "system" | "attachment" | "voice" | "call"
//   attachment?: { id, name, type, size, url }
//   voiceNote?: { id, url, duration }
//   callInfo?: { duration, type }
// }
// ============================================================================

export const POST = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const body = await req.json();
    const sanitizedBody = sanitizeObject(body);
    const {
      conversationId: targetConversationId,
      content = "",
      messageType = "text",
      attachment,
      voiceNote,
      callInfo,
    } = sanitizedBody;

    const platformAdmin = isPlatformRole(authCtx.role);

    // ── Determine conversation ──
    let conversation;

    if (platformAdmin && targetConversationId) {
      // Admin replying to a specific conversation
      conversation = await db.supportConversation.findUnique({
        where: { id: targetConversationId },
      });
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    } else {
      // Client sending a message (or admin creating new)
      const orgId = authCtx.organizationId;
      if (!orgId) {
        return NextResponse.json({ error: "Organization context required" }, { status: 400 });
      }

      // Upsert conversation
      conversation = await db.supportConversation.upsert({
        where: { organizationId: orgId },
        update: {},
        create: {
          organizationId: orgId,
          orgName: body.orgName || "Unknown Brand",
          lastMessage: content.slice(0, 200),
        },
      });
    }

    // ── Determine sender info ──
    let senderId: string;
    let senderName: string;
    let senderAvatar: string | undefined;
    let senderRole: string;

    if (platformAdmin) {
      senderId = "admin-valtriox";
      senderName = body.senderName || "Platform Admin";
      senderAvatar = undefined;
      senderRole = "platform_admin";
    } else {
      senderId = authCtx.userId;
      senderName = body.senderName || authCtx.email || "Client";
      senderAvatar = body.senderAvatar;
      senderRole = authCtx.role || "brand_owner";
    }

    // ── Create message ──
    const message = await withRetry(async () => {
      return await db.supportMessage.create({
      data: {
        conversationId: conversation.id,
        senderId,
        senderName,
        senderAvatar,
        senderRole,
        content,
        messageType,
        attachmentData: attachment ? JSON.stringify(attachment) : null,
        voiceNoteData: voiceNote ? JSON.stringify(voiceNote) : null,
        callInfoData: callInfo ? JSON.stringify(callInfo) : null,
      },
    })
    }, 2, 500);

    // ── Update conversation metadata ──
    const lastMsgText = content || (messageType === "attachment" ? "Sent a file" : messageType === "voice" ? "Sent a voice note" : messageType === "call" ? "Voice call" : "");

    await withRetry(async () => {
      return await db.supportConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: lastMsgText.slice(0, 200),
        lastMessageAt: new Date(),
        // Increment unread count for the OTHER party
        unreadAdmin: platformAdmin ? undefined : { increment: 1 },
        unreadClient: platformAdmin ? { increment: 1 } : undefined,
      },
    })
    }, 2, 500);

    return NextResponse.json({
      message: {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        senderAvatar: message.senderAvatar || undefined,
        senderRole: message.senderRole,
        content: message.content,
        timestamp: message.createdAt.getTime(),
        type: message.messageType,
        attachment: message.attachmentData ? JSON.parse(message.attachmentData) : undefined,
        voiceNote: message.voiceNoteData ? JSON.parse(message.voiceNoteData) : undefined,
        callInfo: message.callInfoData ? JSON.parse(message.callInfoData) : undefined,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Support chat POST error", message);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

// ============================================================================
// DELETE /api/support-chat?messageId=xxx&conversationId=xxx
// ============================================================================
// Delete a message and insert a system message in its place.
// ============================================================================

export const DELETE = withAuth(async (req, authCtx) => {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const conversationId = searchParams.get("conversationId");

    if (!messageId || !conversationId) {
      return NextResponse.json({ error: "messageId and conversationId required" }, { status: 400 });
    }

    // Verify the message belongs to the conversation
    const message = await withRetry(async () => {
      return await db.supportMessage.findFirst({
      where: { id: messageId, conversationId },
    })
    }, 2, 500);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only allow deleting own messages (or platform admin can delete any)
    const platformAdmin = isPlatformRole(authCtx.role);
    if (!platformAdmin && message.senderId !== authCtx.userId) {
      return NextResponse.json({ error: "Cannot delete others' messages" }, { status: 403 });
    }

    await withRetry(async () => {
      return await db.supportMessage.delete({ where: { id: messageId } })
    }, 2, 500);

    // Insert system message
    await withRetry(async () => {
      return await db.supportMessage.create({
      data: {
        conversationId,
        senderId: "system",
        senderName: "System",
        senderRole: "system",
        content: "A message was deleted",
        messageType: "system",
      },
    })
    }, 2, 500);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Support chat DELETE error", message);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
});
