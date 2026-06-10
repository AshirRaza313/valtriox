"use client";

import { useState } from "react";
import { sanitizeEmail } from "@/lib/sanitize";

interface UseAuthHandlersOptions {
  onSuccess?: (data: { user: any; organization: any }) => void;
  onError?: (error: string) => void;
}

export function useAuthHandlers(options: UseAuthHandlersOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizeEmail(email), password, loginType: "password" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      options.onSuccess?.(data);
    } catch (err: any) {
      const msg = err.message || "Login failed";
      setError(msg);
      options.onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = async (email: string, pin: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizeEmail(email), pin, loginType: "pin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN login failed");
      options.onSuccess?.(data);
    } catch (err: any) {
      const msg = err.message || "PIN login failed";
      setError(msg);
      options.onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return { handleLogin, handlePinLogin, isLoading, error, setError };
}
