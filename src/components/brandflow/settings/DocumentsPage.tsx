"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isPlatformRole } from "@/lib/roles";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  FileText,
  Search,
  Edit,
  Eye,
  Send,
  Plus,
  Loader2,
  Check,
  Shield,
  File,
  Scale,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Code2,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Upload,
  Gift,
  Download,
  Trash2,
  FileUp,
  CloudUpload,
  ExternalLink,
  Image,
  FileType2,
  Table as TableIcon,
  Archive,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// Types
// ============================================================================

interface DocumentData {
  key: string;
  title: string;
  type: string;
  content: string;
  updatedAt: string;
}

interface ClientOrg {
  id: string;
  name: string;
  email: string | null;
  plan: string;
}

interface UploadedFile {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  cloudinaryUrl: string | null;
  sizeFormatted: string;
  createdAt: string;
  category: string;
}

// ============================================================================
// Tab Config
// ============================================================================

const TABS = [
  { id: "text-docs", label: "Text Documents", icon: FileText },
  { id: "uploaded-files", label: "Uploaded Files", icon: Upload },
  { id: "lead-magnet", label: "Lead Magnet", icon: Gift },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ============================================================================
// Type badges and icons
// ============================================================================

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  overview: { label: "Overview", color: "bg-amber-100 text-amber-700", icon: FileText },
  legal: { label: "Legal", color: "bg-red-100 text-red-700", icon: Scale },
  template: { label: "Template", color: "bg-emerald-100 text-emerald-700", icon: BookOpen },
  report: { label: "Report", color: "bg-cyan-100 text-cyan-700", icon: BarChart3 },
  checklist: { label: "Checklist", color: "bg-violet-100 text-violet-700", icon: ClipboardCheck },
  general: { label: "General", color: "bg-slate-100 text-slate-700", icon: File },
};

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pdf: { label: "PDF", color: "bg-red-100 text-red-700", icon: FileText },
  image: { label: "Image", color: "bg-emerald-100 text-emerald-700", icon: Image },
  document: { label: "Document", color: "bg-blue-100 text-blue-700", icon: FileType2 },
  spreadsheet: { label: "Spreadsheet", color: "bg-purple-100 text-purple-700", icon: TableIcon },
  archive: { label: "Archive", color: "bg-orange-100 text-orange-700", icon: Archive },
};

const ACCEPTED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
  ".txt", ".csv",
].join(",");

const ACCEPTED_EXTENSIONS_DISPLAY = "PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, GIF, SVG, WEBP, TXT, CSV";

// ============================================================================
// Markdown ↔ HTML Conversion
// ============================================================================

function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "";
  // If content already contains HTML block-level tags, return as-is
  if (/<(?:p|div|h[1-6]|br|ul|ol|li|blockquote|pre|code|strong|b|em)\b[^>]*>/i.test(md)) {
    return md;
  }

  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Headings (before other line-level transforms)
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^>\s?(.*)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Checkboxes
  html = html.replace(/^- \[ \] (.*)$/gm, '<div><input type="checkbox" disabled style="margin-right:8px;pointer-events:none">$1</div>');
  html = html.replace(/^- \[x\] (.*)$/gm, '<div><input type="checkbox" checked disabled style="margin-right:8px;pointer-events:none">$1</div>');

  // Unordered list items
  html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered list items
  html = html.replace(/^\d+\.\s(.*)$/gm, "<oli>$1</oli>");
  html = html.replace(/<oli>/g, "<li>").replace(/<\/oli>/g, "</li>");
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, (match) => {
    if (match.includes("<ul>")) return match;
    return "<ol>" + match + "</ol>";
  });

  // Inline formatting
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.*?)~~/g, "<s>$1</s>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Table rows → simple monospace display
  html = html.replace(/^\|(.*)$/gm, '<div class="table-row">$1</div>');

  // Remaining non-tag lines → paragraphs
  html = html.replace(/^(?!<[a-z\/\!])([^\n]+)$/gm, "<p>$1</p>");

  // Newlines → breaks
  html = html.replace(/\n{2,}/g, "<br>");
  html = html.replace(/\n/g, "<br>");

  return html;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*\S+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function isHtmlEmpty(html: string): boolean {
  if (!html || !html.trim()) return true;
  const text = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<hr\s*\/?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length === 0;
}

// ============================================================================
// Rich Text Content Styles (shared between editor and preview)
// ============================================================================

function generateRteStyles(isDark: boolean): string {
  if (isDark) {
    return `
.rte-content{word-break:break-word;overflow-wrap:break-word;max-width:100%}
.rte-content h1{font-size:1.5em;font-weight:700;margin:0.5em 0 0.3em;color:#D3A638}
.rte-content h2{font-size:1.3em;font-weight:600;margin:0.5em 0 0.3em;color:#e2e8f0}
.rte-content h3{font-size:1.15em;font-weight:600;margin:0.5em 0 0.3em;color:#cbd5e1}
.rte-content p{margin:0.35em 0;word-break:break-word;overflow-wrap:break-word;max-width:100%}
.rte-content ul,.rte-content ol{padding-left:1.5em;margin:0.4em 0}
.rte-content li{margin:0.15em 0}
.rte-content li::marker{color:#D3A638}
.rte-content blockquote{border-left:3px solid #D3A638;padding-left:1em;margin:0.5em 0;color:#94a3b8;font-style:italic}
.rte-content pre{background:rgba(0,0,0,0.35);padding:0.75em;border-radius:0.375em;font-family:monospace;font-size:0.85em;margin:0.5em 0;overflow-x:auto;white-space:pre-wrap;max-width:100%;word-break:break-word}
.rte-content code{background:rgba(255,255,255,0.06);padding:0.15em 0.4em;border-radius:0.25em;font-family:monospace;font-size:0.85em}
.rte-content pre code{background:none;padding:0}
.rte-content hr{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:1em 0}
.rte-content a{color:#D3A638;text-decoration:underline;word-break:break-all}
.rte-content strong{font-weight:600;color:#f1f5f9}
.rte-content s{text-decoration:line-through;opacity:0.6}
.rte-content .table-row{font-family:monospace;font-size:0.8em;padding:2px 0;color:#64748b}
.rte-content input[type="checkbox"]{margin-right:8px;pointer-events:none;accent-color:#D3A638}
`;
  }
  return `
.rte-content{word-break:break-word;overflow-wrap:break-word;max-width:100%}
.rte-content h1{font-size:1.5em;font-weight:700;margin:0.5em 0 0.3em;color:#1a1a2e}
.rte-content h2{font-size:1.3em;font-weight:600;margin:0.5em 0 0.3em;color:#334155}
.rte-content h3{font-size:1.15em;font-weight:600;margin:0.5em 0 0.3em;color:#475569}
.rte-content p{margin:0.35em 0;word-break:break-word;overflow-wrap:break-word;max-width:100%}
.rte-content ul,.rte-content ol{padding-left:1.5em;margin:0.4em 0}
.rte-content li{margin:0.15em 0}
.rte-content li::marker{color:#d97706}
.rte-content blockquote{border-left:3px solid #d97706;padding-left:1em;margin:0.5em 0;color:#64748b;font-style:italic}
.rte-content pre{background:#f8fafc;padding:0.75em;border-radius:0.375em;font-family:monospace;font-size:0.85em;margin:0.5em 0;overflow-x:auto;white-space:pre-wrap;border:1px solid #e2e8f0;max-width:100%;word-break:break-word}
.rte-content code{background:#f1f5f9;padding:0.15em 0.4em;border-radius:0.25em;font-family:monospace;font-size:0.85em}
.rte-content pre code{background:none;padding:0}
.rte-content hr{border:none;border-top:1px solid #e2e8f0;margin:1em 0}
.rte-content a{color:#d97706;text-decoration:underline;word-break:break-all}
.rte-content strong{font-weight:600}
.rte-content s{text-decoration:line-through;opacity:0.6}
.rte-content .table-row{font-family:monospace;font-size:0.8em;padding:2px 0;color:#64748b}
.rte-content input[type="checkbox"]{margin-right:8px;pointer-events:none;accent-color:#d97706}
`;
}

// ============================================================================
// Rich Text Editor Sub-Components
// ============================================================================

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  isDark?: boolean;
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  isActive = false,
  title,
  isDark: dark,
}: {
  label?: string;
  icon?: React.ElementType;
  onClick: () => void;
  isActive?: boolean;
  title: string;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        "h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded transition-colors",
        dark
          ? "hover:bg-white/[0.08] text-slate-400 hover:text-slate-200"
          : "hover:bg-slate-100 text-slate-500 hover:text-slate-800",
        isActive &&
          "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300"
      )}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5" />
      ) : (
        <span className="text-[11px] font-bold leading-none">{label}</span>
      )}
    </button>
  );
}

function ToolbarSep({ isDark: dark }: { isDark: boolean }) {
  return (
    <div
      className={cn(
        "w-px h-5 mx-1.5 shrink-0",
        dark ? "bg-white/[0.08]" : "bg-slate-200"
      )}
    />
  );
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
  isDark = true,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef<string>("");
  const placeholderRef = useRef<HTMLDivElement>(null);

  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    formatBlock: "p",
  });

  // Sync external value into editor only when it comes from outside (not from user edits)
  useEffect(() => {
    if (editorRef.current && value !== lastEmittedValue.current) {
      editorRef.current.innerHTML = value;
      lastEmittedValue.current = value;
      if (placeholderRef.current) {
        placeholderRef.current.style.display = isHtmlEmpty(value) ? "" : "none";
      }
    }
  }, [value]);

  // Track active formatting states on selection change
  useEffect(() => {
    const updateStates = () => {
      try {
        const fb = (document.queryCommandValue("formatBlock") || "")
          .toLowerCase()
          .replace(/[<>]/g, "");
        setActiveStates({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikethrough: document.queryCommandState("strikeThrough"),
          formatBlock: fb,
        });
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("selectionchange", updateStates);
    return () => document.removeEventListener("selectionchange", updateStates);
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.textContent || "";
    lastEmittedValue.current = html;
    if (placeholderRef.current) {
      placeholderRef.current.style.display = text.trim() ? "none" : "";
    }
    onChange(html);
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    }
  }, []);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  }, []);

  const toggleFormatBlock = useCallback((tag: string) => {
    const current = (
      document.queryCommandValue("formatBlock") || ""
    )
      .toLowerCase()
      .replace(/[<>]/g, "");
    if (current === tag.toLowerCase()) {
      document.execCommand("formatBlock", false, "<p>");
    } else {
      document.execCommand("formatBlock", false, `<${tag}>`);
    }
    if (editorRef.current) {
      editorRef.current.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  }, []);

  const handleLink = useCallback(() => {
    const url = window.prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
      if (editorRef.current) {
        editorRef.current.dispatchEvent(
          new Event("input", { bubbles: true })
        );
      }
    }
  }, []);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        isDark ? "border-white/[0.08]" : "border-slate-200"
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap",
          isDark
            ? "bg-white/[0.03] border-white/[0.06]"
            : "bg-slate-50 border-slate-200"
        )}
      >
        {/* Undo / Redo */}
        <ToolbarButton icon={Undo2} onClick={() => exec("undo")} title="Undo (Ctrl+Z)" isDark={isDark} />
        <ToolbarButton icon={Redo2} onClick={() => exec("redo")} title="Redo (Ctrl+Y)" isDark={isDark} />
        <ToolbarSep isDark={isDark} />
        {/* Text formatting */}
        <ToolbarButton icon={Bold} onClick={() => exec("bold")} isActive={activeStates.bold} title="Bold (Ctrl+B)" isDark={isDark} />
        <ToolbarButton icon={Italic} onClick={() => exec("italic")} isActive={activeStates.italic} title="Italic (Ctrl+I)" isDark={isDark} />
        <ToolbarButton icon={Underline} onClick={() => exec("underline")} isActive={activeStates.underline} title="Underline (Ctrl+U)" isDark={isDark} />
        <ToolbarButton icon={Strikethrough} onClick={() => exec("strikeThrough")} isActive={activeStates.strikethrough} title="Strikethrough" isDark={isDark} />
        <ToolbarSep isDark={isDark} />
        {/* Headings */}
        <ToolbarButton label="H1" onClick={() => toggleFormatBlock("h1")} isActive={activeStates.formatBlock === "h1"} title="Heading 1" isDark={isDark} />
        <ToolbarButton label="H2" onClick={() => toggleFormatBlock("h2")} isActive={activeStates.formatBlock === "h2"} title="Heading 2" isDark={isDark} />
        <ToolbarButton label="H3" onClick={() => toggleFormatBlock("h3")} isActive={activeStates.formatBlock === "h3"} title="Heading 3" isDark={isDark} />
        <ToolbarSep isDark={isDark} />
        {/* Lists */}
        <ToolbarButton icon={List} onClick={() => exec("insertUnorderedList")} isActive={activeStates.formatBlock === "ul"} title="Bullet List" isDark={isDark} />
        <ToolbarButton icon={ListOrdered} onClick={() => exec("insertOrderedList")} isActive={activeStates.formatBlock === "ol"} title="Numbered List" isDark={isDark} />
        <ToolbarSep isDark={isDark} />
        {/* Insert */}
        <ToolbarButton icon={Link2} onClick={handleLink} title="Insert Link" isDark={isDark} />
        <ToolbarButton icon={Code2} onClick={() => toggleFormatBlock("pre")} isActive={activeStates.formatBlock === "pre"} title="Code Block" isDark={isDark} />
        <ToolbarButton icon={Quote} onClick={() => toggleFormatBlock("blockquote")} isActive={activeStates.formatBlock === "blockquote"} title="Blockquote" isDark={isDark} />
        <ToolbarButton icon={Minus} onClick={() => exec("insertHorizontalRule")} title="Horizontal Rule" isDark={isDark} />
      </div>

      {/* Editor area */}
      <div className="relative">
        <div
          ref={placeholderRef}
          className={cn(
            "absolute top-4 left-4 text-sm pointer-events-none select-none",
            isDark ? "text-slate-500" : "text-slate-400"
          )}
          style={{ display: isHtmlEmpty(value) ? "" : "none" }}
        >
          {placeholder}
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          className={cn(
            "rte-content min-h-[400px] max-h-[60vh] overflow-y-auto p-4 outline-none text-sm leading-relaxed",
            isDark
              ? "text-gray-200 bg-[#12121a]"
              : "text-slate-800 bg-white"
          )}
          style={{ caretColor: isDark ? "#D3A638" : undefined }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Access Denied
// ============================================================================

function AccessDenied() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className={cn("max-w-md w-full", isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200")}>
        <CardContent className="flex flex-col items-center text-center p-8">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>
            Access Denied
          </h2>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
            Document management is restricted to platform administrators only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentsPage() {
  const { user, appTheme, organization } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  // ─── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("text-docs");

  // ─── Text Documents state ───────────────────────────────────────────────
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Edit dialog
  const [editingDoc, setEditingDoc] = useState<DocumentData | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [saving, setSaving] = useState(false);

  // Preview dialog
  const [previewDoc, setPreviewDoc] = useState<DocumentData | null>(null);

  // New document dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("general");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // ─── Uploaded Files state ───────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileSearch, setFileSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ─── Lead Magnet state ──────────────────────────────────────────────────
  const [regeneratingLeadMagnet, setRegeneratingLeadMagnet] = useState(false);
  const [leadMagnetInfo, setLeadMagnetInfo] = useState<{
    lastRegenerated: string | null;
    size: number | null;
    pages: number | null;
  }>({ lastRegenerated: null, size: null, pages: null });

  // ─── Enhanced Send Dialog state ─────────────────────────────────────────
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDoc, setSendDoc] = useState<DocumentData | null>(null);
  const [sendMode, setSendMode] = useState<"text" | "file">("text");
  const [sendFileId, setSendFileId] = useState<string | null>(null);
  const [sendFileName, setSendFileName] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  // ─── Theme helpers ──────────────────────────────────────────────────────
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ─── Fetch text documents ───────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch clients for send dialog ─────────────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(
          (data.clients || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email || c.owner?.email || null,
            plan: c.plan,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  }, []);

  // ─── Fetch uploaded files ───────────────────────────────────────────────
  const fetchUploadedFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/documents/files");
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch uploaded files:", err);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchClients();
  }, [fetchDocuments, fetchClients]);

  const rteStyles = useMemo(() => generateRteStyles(isDark), [isDark]);

  // Access check (moved after hooks to satisfy rules of hooks)
  const hasAccess = Boolean(user?.role && isPlatformRole(user.role));
  if (!hasAccess) {
    return <AccessDenied />;
  }

  // ─── Filter text documents ──────────────────────────────────────────────
  const filteredDocs = documents.filter((doc) => {
    if (typeFilter !== "all" && doc.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.type.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Filter uploaded files ─────────────────────────────────────────────
  const filteredFiles = uploadedFiles.filter((f) => {
    if (!fileSearch) return true;
    const q = fileSearch.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.fileName.toLowerCase().includes(q) ||
      f.fileType.toLowerCase().includes(q)
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEXT DOCUMENT ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const openEdit = (doc: DocumentData) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditType(doc.type);
    setEditContent(markdownToHtml(doc.content));
  };

  const saveDocument = async () => {
    if (!editingDoc) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editingDoc.key,
          title: editTitle,
          type: editType,
          content: editContent,
        }),
      });
      if (res.ok) {
        toast.success("Document saved successfully");
        setEditingDoc(null);
        fetchDocuments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save document");
      }
    } catch {
      toast.error("Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const createDocument = async () => {
    if (!newTitle.trim() || isHtmlEmpty(newContent)) {
      toast.error("Title and content are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          type: newType,
          content: newContent,
        }),
      });
      if (res.ok) {
        toast.success("Document created successfully");
        setNewDialogOpen(false);
        setNewTitle("");
        setNewType("general");
        setNewContent("");
        fetchDocuments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create document");
      }
    } catch {
      toast.error("Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOADED FILES ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    setUploadProgress(10);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 50MB limit`);
        continue;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));
      formData.append("category", "uploaded");

      setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));

      try {
        const res = await fetchWithAuth("/api/admin/documents/files", {
          method: "POST",
          body: formData,
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));

        if (res.ok) {
          const data = await res.json();
          toast.success(`"${data.file?.title}" uploaded!`);
        } else {
          const err = await res.json();
          toast.error(err.error || `Failed to upload "${file.name}"`);
        }
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
      }
    }
    setUploading(false);
    setUploadProgress(0);
    fetchUploadedFiles();
  };

  const deleteFile = async (fileId: string, fileName: string) => {
    try {
      const res = await fetchWithAuth(`/api/admin/documents/files?id=${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`"${fileName}" deleted`);
        fetchUploadedFiles();
      } else {
        toast.error("Failed to delete file");
      }
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const downloadFile = (file: UploadedFile) => {
    if (file.cloudinaryUrl) {
      window.open(file.cloudinaryUrl, "_blank");
    }
  };

  // ─── Drag & Drop handlers ──────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
      e.target.value = "";
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LEAD MAGNET ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const regenerateLeadMagnet = async () => {
    setRegeneratingLeadMagnet(true);
    try {
      const res = await fetchWithAuth("/api/lead-magnet", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Lead Magnet regenerated! (${(data.size / 1024).toFixed(0)}KB, ${data.pages} pages)`
        );
        setLeadMagnetInfo({
          lastRegenerated: new Date().toISOString(),
          size: data.size,
          pages: data.pages,
        });
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to regenerate");
      }
    } catch {
      toast.error("Failed to regenerate lead magnet");
    } finally {
      setRegeneratingLeadMagnet(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ENHANCED SEND DIALOG ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const openSendDialogForDoc = (doc: DocumentData) => {
    setSendMode("text");
    setSendDoc(doc);
    setSendFileId(null);
    setSendFileName("");
    setSendMessage("");
    setSelectedClient("");
    setSendDialogOpen(true);
  };

  const openSendDialogForFile = (file: UploadedFile) => {
    setSendMode("file");
    setSendDoc(null);
    setSendFileId(file.id);
    setSendFileName(file.title);
    setSendMessage("");
    setSelectedClient("");
    setSendDialogOpen(true);
  };

  const sendDocumentOrFile = async () => {
    if (!selectedClient) {
      toast.error("Select a client");
      return;
    }
    const client = clients.find((c) => c.id === selectedClient);
    if (!client?.email) {
      toast.error("Client has no email");
      return;
    }

    setSending(true);
    try {
      const body: any = { clientOrgId: selectedClient };

      if (sendMode === "text" && sendDoc) {
        body.documentKey = sendDoc.key;
        body.placeholders = {
          client_name: client.name,
          company_name: client.name,
          client_email: client.email,
        };
      } else {
        body.fileId = sendFileId;
        body.message = sendMessage || `Please find the document attached.`;
      }

      const res = await fetchWithAuth("/api/admin/documents/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.emailSent) {
          toast.success(`Sent to ${client.email}`);
        } else {
          toast.warning(data.warning || "Prepared but email provider not configured");
        }
        setSendDialogOpen(false);
        setSendDoc(null);
        setSendFileId(null);
        setSelectedClient("");
        setSendMessage("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  const renderPreview = (content: string) => {
    if (!content) return "";
    if (/<(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|hr|table)\b[^>]*>/i.test(content)) {
      return sanitizeHtml(content);
    }
    return markdownToHtml(content);
  };

  const formatDate = (dateStr: string) => {
    try {
      const tz = organization?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });
    } catch {
      return dateStr;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: rteStyles }} />

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Document Management</h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Manage templates, legal documents, uploaded files, and client communications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              fetchDocuments();
              fetchUploadedFiles();
            }}
            disabled={loading || filesLoading}
            className="gap-2"
          >
            {(loading || filesLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
          {activeTab === "text-docs" && (
            <Button
              onClick={() => setNewDialogOpen(true)}
              className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
            >
              <Plus className="h-4 w-4" />
              New Document
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Tab Navigation ═══ */}
      <div
        className={cn(
          "flex gap-1 p-1 rounded-lg",
          isDark ? "bg-white/[0.04]" : "bg-slate-100"
        )}
      >
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive
                  ? isGold
                    ? "bg-amber-500/20 text-amber-400 shadow-sm"
                    : "bg-white shadow-sm text-amber-600"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
              )}
            >
              <TabIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ Tab Content ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: TEXT DOCUMENTS                                            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "text-docs" && (
            <>
              {/* Search & Filter */}
              <Card className={cn(cardBg)}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search documents..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="overview">Overview</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                        <SelectItem value="report">Report</SelectItem>
                        <SelectItem value="checklist">Checklist</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Documents Table */}
              <Card className={cn(cardBg)}>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    </div>
                  ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <FileText className="h-10 w-10 text-slate-300 mb-3" />
                      <p className={cn("text-sm font-medium", textPrimary)}>No documents found</p>
                      <p className={cn("text-xs mt-1", textSecondary)}>
                        {search || typeFilter !== "all"
                          ? "Try adjusting your search or filter"
                          : "Create your first document to get started"}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className={cn(isDark ? "border-white/[0.06]" : "border-slate-200")}>
                          <TableHead className={cn("w-[40%]", textSecondary)}>Document</TableHead>
                          <TableHead className={textSecondary}>Type</TableHead>
                          <TableHead className={cn("hidden sm:table-cell", textSecondary)}>Last Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocs.map((doc) => {
                          const typeConf = TYPE_CONFIG[doc.type] || TYPE_CONFIG.general;
                          const TypeIcon = typeConf.icon;
                          return (
                            <tr
                              key={doc.key}
                              className={cn(
                                "group cursor-default transition-colors",
                                isDark
                                  ? "hover:bg-white/[0.03] border-white/[0.04]"
                                  : "hover:bg-slate-50 border-slate-100"
                              )}
                            >
                              <TableCell className="py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                                      isGold ? "bg-amber-500/10" : "bg-amber-100"
                                    )}
                                  >
                                    <TypeIcon
                                      className={cn(
                                        "h-4 w-4",
                                        isGold ? "text-amber-400" : "text-amber-600"
                                      )}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className={cn("text-sm font-medium truncate", textPrimary)}>
                                      {doc.title}
                                    </p>
                                    <p
                                      className={cn(
                                        "text-xs truncate max-w-[240px]",
                                        textSecondary
                                      )}
                                    >
                                      {doc.content.replace(/<[^>]*>/g, "").substring(0, 80)}
                                      {doc.content.replace(/<[^>]*>/g, "").length > 80 ? "..." : ""}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={cn("text-[10px] font-medium", typeConf.color)}
                                >
                                  {typeConf.label}
                                </Badge>
                              </TableCell>
                              <TableCell className={cn("hidden sm:table-cell", textSecondary, "text-xs")}>
                                {formatDate(doc.updatedAt)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setPreviewDoc(doc)}
                                    title="Preview"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => openEdit(doc)}
                                    title="Edit"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => openSendDialogForDoc(doc)}
                                    title="Send to Client"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </tr>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className={cn(cardBg)}>
                  <CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", isGold ? "text-amber-400" : "text-amber-600")}>
                      {documents.length}
                    </p>
                    <p className={cn("text-[11px]", textSecondary)}>Total Documents</p>
                  </CardContent>
                </Card>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", isGold ? "text-amber-400" : "text-amber-600")}>
                      {documents.filter((d) => d.type === "legal").length}
                    </p>
                    <p className={cn("text-[11px]", textSecondary)}>Legal Docs</p>
                  </CardContent>
                </Card>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", isGold ? "text-amber-400" : "text-amber-600")}>
                      {documents.filter((d) => d.type === "template").length}
                    </p>
                    <p className={cn("text-[11px]", textSecondary)}>Templates</p>
                  </CardContent>
                </Card>
                <Card className={cn(cardBg)}>
                  <CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", isGold ? "text-amber-400" : "text-amber-600")}>
                      {clients.length}
                    </p>
                    <p className={cn("text-[11px]", textSecondary)}>Clients</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: UPLOADED FILES                                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "uploaded-files" && (
            <>
              {/* Upload Area */}
              <Card className={cn(cardBg)}>
                <CardContent className="p-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={cn(
                      "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
                      dragOver
                        ? isGold
                          ? "border-amber-400 bg-amber-500/10"
                          : "border-amber-500 bg-amber-50"
                        : isDark
                          ? "border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.02]"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      uploading && "pointer-events-none opacity-60"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                      {uploading ? (
                        <>
                          <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-3" />
                          <p className={cn("text-sm font-medium", textPrimary)}>Uploading files...</p>
                          <div className="w-48 h-2 rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 rounded-full"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className={cn("text-xs mt-2", textSecondary)}>
                            {uploadProgress}% complete
                          </p>
                        </>
                      ) : (
                        <>
                          <div
                            className={cn(
                              "h-14 w-14 rounded-full flex items-center justify-center mb-4",
                              isGold ? "bg-amber-500/10" : "bg-amber-100"
                            )}
                          >
                            <CloudUpload
                              className={cn("h-7 w-7", isGold ? "text-amber-400" : "text-amber-600")}
                            />
                          </div>
                          <p className={cn("text-sm font-medium", textPrimary)}>
                            Drop files here or click to upload
                          </p>
                          <p className={cn("text-xs mt-1.5", textSecondary)}>
                            {ACCEPTED_EXTENSIONS_DISPLAY} &bull; Max 50MB per file
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* File Search */}
              <Card className={cn(cardBg)}>
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search uploaded files..."
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Files Grid / List */}
              <Card className={cn(cardBg)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={cn("text-base", textPrimary)}>Uploaded Files</CardTitle>
                      <CardDescription className={textSecondary}>
                        {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
                        {uploadedFiles.length !== filteredFiles.length ? ` (filtered from ${uploadedFiles.length})` : ""}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filesLoading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <FileUp className="h-10 w-10 text-slate-300 mb-3" />
                      <p className={cn("text-sm font-medium", textPrimary)}>No files uploaded</p>
                      <p className={cn("text-xs mt-1", textSecondary)}>
                        {fileSearch
                          ? "No files match your search"
                          : "Upload your first file to get started"}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className={cn(isDark ? "border-white/[0.06]" : "border-slate-200")}>
                          <TableHead className={cn("w-[35%]", textSecondary)}>File</TableHead>
                          <TableHead className={cn("hidden sm:table-cell", textSecondary)}>Size</TableHead>
                          <TableHead className={textSecondary}>Type</TableHead>
                          <TableHead className={cn("hidden md:table-cell", textSecondary)}>Uploaded</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFiles.map((file) => {
                          const ftConf = FILE_TYPE_CONFIG[file.fileType] || FILE_TYPE_CONFIG.document;
                          const FtIcon = ftConf.icon;
                          return (
                            <tr
                              key={file.id}
                              className={cn(
                                "group cursor-default transition-colors",
                                isDark
                                  ? "hover:bg-white/[0.03] border-white/[0.04]"
                                  : "hover:bg-slate-50 border-slate-100"
                              )}
                            >
                              <TableCell className="py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                                      ftConf.color
                                    )}
                                  >
                                    <FtIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className={cn("text-sm font-medium truncate", textPrimary)}>
                                      {file.title}
                                    </p>
                                    <p className={cn("text-xs truncate max-w-[200px]", textSecondary)}>
                                      {file.fileName}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className={cn("hidden sm:table-cell", textSecondary, "text-xs")}>
                                {file.sizeFormatted}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={cn("text-[10px] font-medium", ftConf.color)}
                                >
                                  {ftConf.label}
                                </Badge>
                              </TableCell>
                              <TableCell className={cn("hidden md:table-cell", textSecondary, "text-xs")}>
                                {formatDate(file.createdAt)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => downloadFile(file)}
                                    title="Download"
                                    disabled={!file.cloudinaryUrl}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => openSendDialogForFile(file)}
                                    title="Send to Client"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                    onClick={() => deleteFile(file.id, file.title)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </tr>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 3: LEAD MAGNET                                               */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "lead-magnet" && (
            <div className="space-y-6">
              {/* Main Lead Magnet Card */}
              <Card className={cn(cardBg)}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Icon & Info */}
                    <div
                      className={cn(
                        "h-20 w-20 rounded-2xl flex items-center justify-center shrink-0",
                        isGold ? "bg-amber-500/10" : "bg-amber-100"
                      )}
                    >
                      <Gift className={cn("h-10 w-10", isGold ? "text-amber-400" : "text-amber-600")} />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className={cn("text-lg font-bold", textPrimary)}>Valtriox Lead Magnet</h3>
                        <p className={cn("text-sm mt-1", textSecondary)}>
                          The Valtriox lead magnet is a professional PDF document designed to attract and
                          convert potential clients. It showcases the platform&apos;s capabilities, value
                          propositions, and benefits. Regenerate to update with the latest branding and content.
                        </p>
                      </div>

                      {/* Status */}
                      {leadMagnetInfo.lastRegenerated && (
                        <div
                          className={cn(
                            "flex flex-wrap gap-4 text-xs",
                            textSecondary
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span>
                              Last regenerated:{" "}
                              {formatDate(leadMagnetInfo.lastRegenerated)}
                            </span>
                          </div>
                          {leadMagnetInfo.size && (
                            <span>
                              Size: {(leadMagnetInfo.size / 1024).toFixed(0)} KB
                            </span>
                          )}
                          {leadMagnetInfo.pages && (
                            <span>Pages: {leadMagnetInfo.pages}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Regenerate */}
                <Card className={cn(cardBg)}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                          isGold ? "bg-amber-500/10" : "bg-amber-100"
                        )}
                      >
                        <RefreshCw className={cn("h-5 w-5", isGold ? "text-amber-400" : "text-amber-600")} />
                      </div>
                      <div className="flex-1">
                        <h4 className={cn("text-sm font-semibold", textPrimary)}>Regenerate Lead Magnet</h4>
                        <p className={cn("text-xs mt-1", textSecondary)}>
                          Generate a fresh PDF with the latest branding, platform features, and content.
                          This may take a few seconds.
                        </p>
                        <Button
                          onClick={regenerateLeadMagnet}
                          disabled={regeneratingLeadMagnet}
                          className="mt-3 gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
                          size="sm"
                        >
                          {regeneratingLeadMagnet ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          {regeneratingLeadMagnet ? "Regenerating..." : "Regenerate Now"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview */}
                <Card className={cn(cardBg)}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                          isGold ? "bg-amber-500/10" : "bg-amber-100"
                        )}
                      >
                        <ExternalLink className={cn("h-5 w-5", isGold ? "text-amber-400" : "text-amber-600")} />
                      </div>
                      <div className="flex-1">
                        <h4 className={cn("text-sm font-semibold", textPrimary)}>Preview Lead Magnet</h4>
                        <p className={cn("text-xs mt-1", textSecondary)}>
                          Open the current lead magnet PDF in a new tab to review the content, layout, and
                          branding before sharing with potential leads.
                        </p>
                        <Button
                          onClick={() => window.open("/api/lead-magnet", "_blank")}
                          className="mt-3 gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Preview PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info Card */}
              <Card className={cn(cardBg)}>
                <CardContent className="p-6">
                  <h4 className={cn("text-sm font-semibold mb-3", textPrimary)}>
                    About the Lead Magnet
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className={cn("space-y-2", textSecondary)}>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-amber-500")} />
                        <span>Professionally designed PDF format</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-amber-500")} />
                        <span>Valtriox branding and color scheme</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-amber-500")} />
                        <span>Platform feature highlights</span>
                      </div>
                    </div>
                    <div className={cn("space-y-2", textSecondary)}>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-amber-500")} />
                        <span>Pricing plan information</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-amber-500")} />
                        <span>Client onboarding call CTA</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-amber-500")} />
                        <span>Optimized for email sharing</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DIALOGS                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent className={cn("max-w-4xl max-h-[90vh]", isDark ? "bg-[#1a1a2e] border-white/[0.08]" : "")}>
          <DialogHeader>
            <DialogTitle className={cn(textPrimary)}>Edit Document</DialogTitle>
            <DialogDescription className={textSecondary}>
              Modify the document content. Changes are saved immediately.
            </DialogDescription>
          </DialogHeader>
          {editingDoc && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>Title</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={cn(isDark && "bg-white/[0.05] border-white/[0.08]")}
                  />
                </div>
                <div className="w-[160px]">
                  <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>Type</label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger className={cn(isDark && "bg-white/[0.05] border-white/[0.08]")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overview">Overview</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="template">Template</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="checklist">Checklist</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>Content</label>
                <RichTextEditor
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Write document content..."
                  isDark={isDark}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancel</Button>
            <Button
              onClick={saveDocument}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className={cn("max-w-3xl max-h-[90vh]", isDark ? "bg-[#1a1a2e] border-white/[0.08]" : "")}>
          <DialogHeader>
            <DialogTitle className={cn(textPrimary)}>{previewDoc?.title || "Preview"}</DialogTitle>
            <DialogDescription className={textSecondary}>
              Read-only preview of the document content
            </DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <ScrollArea className="h-[60vh] pr-4">
              <div
                className={cn(
                  "rte-content max-w-none rounded-lg p-6 text-sm leading-relaxed",
                  isDark
                    ? "bg-white/[0.03] border border-white/[0.06] text-slate-300"
                    : "bg-slate-50 border border-slate-200 text-slate-700"
                )}
                dangerouslySetInnerHTML={{ __html: renderPreview(previewDoc.content) }}
              />
            </ScrollArea>
          )}
          <DialogFooter>
            <div className="flex gap-2 w-full justify-between">
              <p className={cn("text-xs self-center", textSecondary)}>
                Last updated: {previewDoc ? formatDate(previewDoc.updatedAt) : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreviewDoc(null)}>Close</Button>
                {previewDoc && (
                  <Button
                    onClick={() => {
                      setPreviewDoc(null);
                      openEdit(previewDoc);
                    }}
                    className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => !open && setSendDialogOpen(false)}>
        <DialogContent className={cn("max-w-lg", isDark ? "bg-[#1a1a2e] border-white/[0.08]" : "")}>
          <DialogHeader>
            <DialogTitle className={cn(textPrimary)}>
              {sendMode === "text" ? "Send Document to Client" : "Send File to Client"}
            </DialogTitle>
            <DialogDescription className={textSecondary}>
              {sendMode === "text"
                ? `Send "${sendDoc?.title}" via email with placeholders filled`
                : `Send "${sendFileName}" via email with a download link`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Sending mode indicator */}
            <div
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-xs",
                isDark ? "bg-white/[0.04]" : "bg-slate-50"
              )}
            >
              {sendMode === "text" ? (
                <>
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span className={textSecondary}>
                    Text document | content will be embedded in the email body
                  </span>
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 text-amber-500" />
                  <span className={textSecondary}>
                    Uploaded file | a download link will be included in the email
                  </span>
                </>
              )}
            </div>

            {/* Client selection */}
            <div>
              <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>
                Client Organization
              </label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className={cn(isDark && "bg-white/[0.05] border-white/[0.08]")}>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter((c) => c.email)
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({client.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional message for file sends */}
            {sendMode === "file" && (
              <div>
                <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>
                  Message (optional)
                </label>
                <Textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Add a custom message for the client..."
                  rows={3}
                  className={cn(isDark && "bg-white/[0.05] border-white/[0.08]")}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={sendDocumentOrFile}
              disabled={sending || !selectedClient}
              className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Document Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={(open) => !open && setNewDialogOpen(false)}>
        <DialogContent className={cn("max-w-4xl max-h-[90vh]", isDark ? "bg-[#1a1a2e] border-white/[0.08]" : "")}>
          <DialogHeader>
            <DialogTitle className={cn(textPrimary)}>Create New Document</DialogTitle>
            <DialogDescription className={textSecondary}>
              Add a new document template to the library
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>Title</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Document title..."
                  className={cn(isDark && "bg-white/[0.05] border-white/[0.08]")}
                />
              </div>
              <div className="w-[160px]">
                <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>Type</label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className={cn(isDark && "bg-white/[0.05] border-white/[0.08]")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="checklist">Checklist</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className={cn("text-xs font-medium mb-1.5 block", textSecondary)}>Content</label>
              <RichTextEditor
                value={newContent}
                onChange={setNewContent}
                placeholder={'Write document content...\n\nUse {{client_name}}, {{company_name}}, {{client_email}}, {{date}}, {{consultant_name}} as placeholders.'}
                isDark={isDark}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={createDocument}
              disabled={creating}
              className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
