// ============================================================================
// Environment Variable Validation (Adapted for SQLite dev + PostgreSQL prod)
// ============================================================================

import { z } from "zod";

const envSchema = z.object({
  // ── Required ──
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),

  NEXTAUTH_URL: z.string().min(1, "NEXTAUTH_URL is required"),

  // ── Optional (for production PostgreSQL) ──
  DIRECT_DATABASE_URL: z.string().optional(),

  // ── Optional but important ──
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email address").optional().default(""),

  // ── Optional: Push Notifications ──
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // ── Optional: Supabase Storage ──
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // ── Optional: Cloudinary (fallback if not set in admin panel DB) ──
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER_PREFIX: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
});

type EnvSchema = z.infer<typeof envSchema>;

let _validatedEnv: EnvSchema | null = null;

export function validateEnv(): EnvSchema {
  if (_validatedEnv) return _validatedEnv;

  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_FOLDER_PREFIX: process.env.CLOUDINARY_FOLDER_PREFIX,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    // FIX 2.5: Crash on startup if env vars are invalid in production
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `\n${"=".repeat(60)}\nENVIRONMENT VARIABLE VALIDATION FAILED\n${"=".repeat(60)}\n${errors}\n${"=".repeat(60)}\n`
      );
    }

    console.error("\n" + "=".repeat(60));
    console.error("ENVIRONMENT VARIABLE VALIDATION FAILED");
    console.error("=".repeat(60));
    console.error(errors);
    console.error("=".repeat(60) + "\n");

    _validatedEnv = result.data as EnvSchema;
    return _validatedEnv;
  }

  _validatedEnv = result.data;
  return _validatedEnv;
}

export function getEnvVar<K extends keyof EnvSchema>(key: K): EnvSchema[K] {
  return validateEnv()[key];
}
