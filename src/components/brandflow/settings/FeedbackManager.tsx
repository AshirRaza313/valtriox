"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Plus, Star, Check, X, MessageSquare, Video,
  Trophy, Eye, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const typeIcons: Record<string, any> = {
  feedback: MessageSquare,
  testimonial: Trophy,
  review: Star,
  video: Video,
};

const feedbackTabs = [
  { id: "all", label: "All" },
  { id: "feedback", label: "Feedback" },
  { id: "testimonial", label: "Testimonials" },
  { id: "review", label: "Reviews" },
  { id: "video", label: "Videos" },
];

export function FeedbackManager() {
  const { user, appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const isAdmin = user?.role === "platform_owner" || user?.role === "platform_admin";

  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState("feedback");
  const [formRating, setFormRating] = useState(5);
  const [formContent, setFormContent] = useState("");
  const [formAuthorName, setFormAuthorName] = useState("");
  const [formAuthorCompany, setFormAuthorCompany] = useState("");
  const [formVideoUrl, setFormVideoUrl] = useState("");

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== "all" ? `?type=${activeTab}` : "";
      const res = await fetchWithAuth(`/api/feedback${params}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
      }
    } catch {
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  const handleSubmit = async () => {
    if (!formContent.trim()) { toast.error("Content is required"); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          rating: ["review", "testimonial"].includes(formType) ? formRating : null,
          content: formContent.trim(),
          authorName: formAuthorName.trim() || null,
          authorCompany: formAuthorCompany.trim() || null,
          videoUrl: formType === "video" ? formVideoUrl.trim() || null : null,
          status: isAdmin ? "approved" : "pending",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast.success("Feedback added successfully");
      setDialogOpen(false);
      resetForm();
      fetchFeedbacks();
    } catch (err: any) {
      toast.error(err.message || "Failed to add feedback");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormType("feedback");
    setFormRating(5);
    setFormContent("");
    setFormAuthorName("");
    setFormAuthorCompany("");
    setFormVideoUrl("");
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetchWithAuth("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(`Feedback ${status}`);
        fetchFeedbacks();
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      const res = await fetchWithAuth("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isFeatured: !isFeatured }),
      });
      if (res.ok) {
        toast.success(isFeatured ? "Removed from featured" : "Added to featured");
        fetchFeedbacks();
      }
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/feedback?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Feedback deleted");
        fetchFeedbacks();
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3 w-3",
          i < rating ? "text-amber-400 fill-amber-400" : "text-slate-600"
        )}
      />
    ));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
      approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      rejected: { label: "Rejected", className: "bg-red-500/10 text-red-400 border-red-500/20" },
    };
    const entry = map[status] || map.pending;
    return (
      <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5", entry.className)}>
        {entry.label}
      </Badge>
    );
  };

  const cardBg = isGold ? "bg-white/[0.03] border-white/[0.06]" : isDark ? "bg-white/[0.03] border-white/[0.06]" : "";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "")}>Feedback & Testimonials</h3>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-muted-foreground")}>
            Collect and manage customer feedback, testimonials, and reviews
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setDialogOpen(true); }}
          className={cn(isGold ? "btn-gold" : "bg-amber-600 hover:bg-amber-700 text-white")}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Feedback
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {feedbackTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              activeTab === tab.id
                ? isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : isDark ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-50 text-amber-600 border-amber-200"
                : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10 border-white/[0.06]" : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        </div>
      ) : feedbacks.length === 0 ? (
        <Card className={cn("border", cardBg)}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className={cn("h-10 w-10 mb-3", isDark ? "text-slate-600" : "text-slate-300")} />
            <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "")}>No feedback yet</p>
            <p className={cn("text-xs mt-1", isDark ? "text-slate-500" : "text-muted-foreground")}>
              Click &quot;Add Feedback&quot; to start collecting
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {feedbacks.map((fb) => {
              const TypeIcon = typeIcons[fb.type] || MessageSquare;
              return (
                <motion.div
                  key={fb.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className={cn("border transition-all hover:shadow-md", cardBg)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <div className={cn(
                              "h-7 w-7 rounded-md flex items-center justify-center",
                              isGold ? "bg-amber-500/10" : "bg-amber-500/10"
                            )}>
                              <TypeIcon className="h-3.5 w-3.5 text-amber-400" />
                            </div>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-medium capitalize px-2 py-0.5",
                              isDark ? "bg-white/5 border-white/10 text-slate-400" : ""
                            )}>
                              {fb.type}
                            </Badge>
                            {statusBadge(fb.status)}
                            {fb.isFeatured && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-medium px-2 py-0.5">
                                <Eye className="mr-0.5 h-2.5 w-2.5" /> Featured
                              </Badge>
                            )}
                            {fb.rating > 0 && (
                              <div className="flex items-center gap-0.5">
                                {renderStars(fb.rating)}
                              </div>
                            )}
                          </div>
                          <p className={cn("text-sm leading-relaxed mb-2", isDark ? "text-slate-300" : "")}>
                            {fb.content}
                          </p>
                          <div className={cn("flex items-center gap-3 text-xs flex-wrap", isDark ? "text-slate-500" : "text-muted-foreground")}>
                            {fb.authorName && <span>{fb.authorName}</span>}
                            {fb.authorCompany && <span className="text-slate-600">·</span>}
                            {fb.authorCompany && <span>{fb.authorCompany}</span>}
                            <span className="text-slate-600">·</span>
                            <span>{new Date(fb.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {isAdmin && fb.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusUpdate(fb.id, "approved")}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 text-xs px-2"
                              >
                                <Check className="mr-1 h-3 w-3" /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusUpdate(fb.id, "rejected")}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-xs px-2"
                              >
                                <X className="mr-1 h-3 w-3" /> Reject
                              </Button>
                            </>
                          )}
                          {(fb.type === "testimonial" || fb.type === "review") && (
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[10px] text-slate-500">Feature</Label>
                              <Switch
                                checked={fb.isFeatured}
                                onCheckedChange={() => handleToggleFeatured(fb.id, fb.isFeatured)}
                                className="scale-75"
                              />
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(fb.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-xs px-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Feedback Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={cn("sm:max-w-lg", isGold && "bg-[#15151e] border-white/[0.08]")}>
          <DialogHeader>
            <DialogTitle className={cn(isDark && "text-white")}>Add Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={cn("text-sm", isDark ? "text-slate-300" : "")}>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className={cn(isDark && "bg-white/5 border-white/10 text-white")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="testimonial">Testimonial</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="video">Video Testimonial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["review", "testimonial"].includes(formType) && (
                <div className="space-y-1.5">
                  <Label className={cn("text-sm", isDark ? "text-slate-300" : "")}>Rating</Label>
                  <div className="flex items-center gap-1 h-9 px-3 border rounded-md" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : undefined }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4 cursor-pointer transition-colors",
                          i < formRating ? "text-amber-400 fill-amber-400" : "text-slate-600"
                        )}
                        onClick={() => setFormRating(i + 1)}
                      />
                    ))}
                    <span className={cn("ml-2 text-xs", isDark ? "text-slate-400" : "text-muted-foreground")}>
                      {formRating}/5
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={cn("text-sm", isDark ? "text-slate-300" : "")}>Content</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Write the feedback or testimonial..."
                rows={4}
                className={cn(isDark && "bg-white/5 border-white/10 text-white")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={cn("text-sm", isDark ? "text-slate-300" : "")}>Author Name</Label>
                <Input
                  value={formAuthorName}
                  onChange={(e) => setFormAuthorName(e.target.value)}
                  placeholder="John Doe"
                  className={cn(isDark && "bg-white/5 border-white/10 text-white")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-sm", isDark ? "text-slate-300" : "")}>Company</Label>
                <Input
                  value={formAuthorCompany}
                  onChange={(e) => setFormAuthorCompany(e.target.value)}
                  placeholder="Company Inc."
                  className={cn(isDark && "bg-white/5 border-white/10 text-white")}
                />
              </div>
            </div>

            {formType === "video" && (
              <div className="space-y-1.5">
                <Label className={cn("text-sm", isDark ? "text-slate-300" : "")}>Video URL</Label>
                <Input
                  value={formVideoUrl}
                  onChange={(e) => setFormVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={cn(isDark && "bg-white/5 border-white/10 text-white")}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className={cn(isGold && "border-white/10 text-slate-300 hover:bg-white/5")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !formContent.trim()}
              className={cn(isGold ? "btn-gold" : "bg-amber-600 hover:bg-amber-700 text-white")}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
