"use client";

import { useState, useRef, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Mail, KeyRound, Shield, CheckCircle2,
  RefreshCw, Lock, Eye, EyeOff, ArrowRight,
} from "lucide-react";

interface ForgotPasswordFlowProps {
  onBack: () => void;
  onSuccess?: () => void;
  isModal?: boolean;
  onAutoLogin?: (email: string, password: string) => Promise<void>;
}

type Step = "email" | "otp" | "new-password" | "success";

export function ForgotPasswordFlow({ onBack, onSuccess, isModal = false, onAutoLogin }: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);

  const otpRef = useRef<HTMLInputElement>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const maskEmail = (e: string) => {
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const visible = local.slice(0, 2);
    const hidden = "*".repeat(Math.min(local.length - 2, 4));
    return `${visible}${hidden}@${domain}`;
  };

  // ── Step 1: Send OTP ──
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
        return;
      }

      setMaskedEmail(maskEmail(email.toLowerCase()));
      setStep("otp");
      setResendCooldown(60);
      toast.success("Verification code sent to your email");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      if (res.ok) {
        setResendCooldown(60);
        toast.success("New code sent to your email");
      } else {
        toast.error("Failed to resend. Please try again.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Invalid code");
        setOtp("");
        return;
      }

      setResetToken(data.resetToken);
      setStep("new-password");
      toast.success("Code verified! Create your new password.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error("Password must contain at least one number");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          resetToken,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to reset password");
        return;
      }

      setStep("success");
      toast.success("Password reset successful! You can now sign in.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Password strength indicator ──
  const getPasswordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: "Weak", color: "#ef4444", width: "33%" };
    if (score <= 4) return { label: "Medium", color: "#f59e0b", width: "66%" };
    return { label: "Strong", color: "#22c55e", width: "100%" };
  };

  const strength = getPasswordStrength(newPassword);

  // ── Auto-login after password reset ──
  const handleAutoLogin = async () => {
    if (!onAutoLogin || !email || !newPassword) return;
    setAutoLoggingIn(true);
    try {
      await onAutoLogin(email.toLowerCase(), newPassword);
      toast.success("Password reset successful! Logged in automatically.");
    } catch {
      // If auto-login fails, just go back to sign in
      toast.info("Password reset successful! Please sign in with your new password.");
      onBack();
    }
  };

  // Trigger auto-login when reaching success step
  useEffect(() => {
    if (step === "success" && onAutoLogin) {
      const timer = setTimeout(handleAutoLogin, 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const slideVariants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <div className="w-full">
      {/* Back button */}
      <motion.button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-amber-400 transition-colors mb-5 text-xs group"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Sign In</span>
      </motion.button>

      <AnimatePresence mode="wait">
        {/* ════════════ STEP 1: EMAIL ════════════ */}
        {step === "email" && (
          <motion.div
            key="email"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                Forgot Password?
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                No worries! Enter your email and we&apos;ll send you a verification code to reset your password.
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Email Address
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="premium-input h-11 rounded-xl"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="submit"
                  className="btn-gold w-full h-11 rounded-xl text-sm shadow-[0_0_30px_rgba(212,160,23,0.25)] flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Send Verification Code
                </Button>
              </motion.div>
            </form>
          </motion.div>
        )}

        {/* ════════════ STEP 2: OTP ════════════ */}
        {step === "otp" && (
          <motion.div
            key="otp"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                Enter Verification Code
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                A 6-digit OTP has been sent to <span className="text-amber-400 font-medium">{maskedEmail}</span> by <span className="text-amber-400 font-semibold">Valtriox</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(val) => setOtp(val)}
                  disabled={loading}
                  onComplete={() => {
                    // Auto-submit when all 6 digits entered
                    const form = document.getElementById("otp-form") as HTMLFormElement;
                    if (form) form.requestSubmit();
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-12 w-11 sm:w-13 rounded-lg border-white/10 bg-white/[0.03] text-lg text-white font-mono font-bold data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                    <InputOTPSlot index={1} className="h-12 w-11 sm:w-13 rounded-lg border-white/10 bg-white/[0.03] text-lg text-white font-mono font-bold data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                    <InputOTPSlot index={2} className="h-12 w-11 sm:w-13 rounded-lg border-white/10 bg-white/[0.03] text-lg text-white font-mono font-bold data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                  </InputOTPGroup>
                  <InputOTPSeparator className="text-slate-600" />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="h-12 w-11 sm:w-13 rounded-lg border-white/10 bg-white/[0.03] text-lg text-white font-mono font-bold data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                    <InputOTPSlot index={4} className="h-12 w-11 sm:w-13 rounded-lg border-white/10 bg-white/[0.03] text-lg text-white font-mono font-bold data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                    <InputOTPSlot index={5} className="h-12 w-11 sm:w-13 rounded-lg border-white/10 bg-white/[0.03] text-lg text-white font-mono font-bold data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="submit"
                  className="btn-gold w-full h-11 rounded-xl text-sm shadow-[0_0_30px_rgba(212,160,23,0.25)] flex items-center justify-center gap-2"
                  disabled={loading || otp.length !== 6}
                  id="otp-form"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify Code
                </Button>
              </motion.div>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-500 mb-2">
                  Didn&apos;t receive the code?
                </p>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400/80 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${resendCooldown > 0 ? '' : 'hover:rotate-180 transition-transform duration-500'}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ════════════ STEP 3: NEW PASSWORD ════════════ */}
        {step === "new-password" && (
          <motion.div
            key="new-password"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <KeyRound className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                Create New Password
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your identity has been verified. Create a strong new password for your account.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="premium-input h-11 rounded-xl pr-10"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength bar */}
                {newPassword.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: strength.color, width: strength.width }}
                        initial={{ width: 0 }}
                        animate={{ width: strength.width }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-[11px]" style={{ color: strength.color }}>
                      Password strength: {strength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="premium-input h-11 rounded-xl pr-10"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-red-400">Passwords do not match</p>
                )}
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="submit"
                  className="btn-gold w-full h-11 rounded-xl text-sm shadow-[0_0_30px_rgba(212,160,23,0.25)] flex items-center justify-center gap-2"
                  disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Reset Password
                </Button>
              </motion.div>
            </form>
          </motion.div>
        )}

        {/* ════════════ STEP 4: SUCCESS + AUTO-LOGIN ════════════ */}
        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center py-4"
          >
            <motion.div
              className="mx-auto h-16 w-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              {autoLoggingIn ? (
                <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              )}
            </motion.div>
            <h2 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              {autoLoggingIn ? "Signing You In..." : "Password Reset Complete"}
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              {autoLoggingIn
                ? "Securely logging you in with your new password."
                : "Your password has been successfully updated. Redirecting to your dashboard..."
              }
            </p>
            {!onAutoLogin && (
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  onClick={() => {
                    if (onSuccess) {
                      onSuccess();
                    } else {
                      onBack();
                    }
                  }}
                  className="btn-gold h-11 rounded-xl text-sm shadow-[0_0_30px_rgba(212,160,23,0.25)] flex items-center justify-center gap-2 px-8 mx-auto"
                >
                  <ArrowRight className="h-4 w-4" />
                  Back to Sign In
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
