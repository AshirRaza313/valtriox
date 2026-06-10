"use client";

import { useState } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Facebook,
  BarChart3,
  Mail,
  Zap,
  Rocket,
  ChevronRight,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  Globe,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Copy Button ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} title="Copy">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ─── Code Block ───────────────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-lg overflow-hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-lg">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
          <span className="text-[10px] text-slate-400 font-mono">{language || "code"}</span>
          <CopyButton text={code} />
        </div>
        <pre className="p-3 overflow-x-auto">
          <code className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

// ─── Step Card ───────────────────────────────────────────────────────────

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className="flex gap-3">
      <div className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
        isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-amber-100 text-amber-700 border border-amber-200"
      )}>
        {number}
      </div>
      <div className="flex-1 space-y-2">
        <h4 className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>{title}</h4>
        {children}
      </div>
    </div>
  );
}

// ─── Warning Box ─────────────────────────────────────────────────────────

function WarningBox({ children }: { children: React.ReactNode }) {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className={cn(
      "rounded-lg border p-3 flex gap-2",
      isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200"
    )}>
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-xs text-slate-400">{children}</div>
    </div>
  );
}

// ─── Tip Box ─────────────────────────────────────────────────────────────

function TipBox({ children }: { children: React.ReactNode }) {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className={cn(
      "rounded-lg border p-3 flex gap-2",
      isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
    )}>
      <Lightbulb className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
      <div className="text-xs text-slate-400">{children}</div>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] gap-1">
      <CheckCircle2 className="h-3 w-3" /> Active
    </Badge>
  ) : (
    <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/25 text-[10px] gap-1">
      Not Configured
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function IntegrationGuidePage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  const envValue = (envVar: string) => {
    const val = process.env[envVar as keyof NodeJS.ProcessEnv];
    return val ? "••••••••" : "(not set)";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className={cn("text-2xl font-bold", textPrimary)}>Integration Guide</h1>
        <p className={cn("text-sm mt-0.5", textSecondary)}>
          Step-by-step guides for setting up integrations and services
        </p>
      </div>

      <Tabs defaultValue="meta-pixel" className="w-full">
        <TabsList className={cn("w-full flex flex-wrap gap-1 h-auto p-1", isDark ? "bg-white/[0.03]" : "bg-slate-100")}>
          <TabsTrigger value="meta-pixel" className="flex items-center gap-1.5 text-xs">
            <Facebook className="h-3.5 w-3.5" /> Meta Pixel
          </TabsTrigger>
          <TabsTrigger value="google-analytics" className="flex items-center gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Google Analytics
          </TabsTrigger>
          <TabsTrigger value="resend" className="flex items-center gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> Resend Email
          </TabsTrigger>
          <TabsTrigger value="auto-email" className="flex items-center gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" /> Auto-Email
          </TabsTrigger>
          <TabsTrigger value="vercel" className="flex items-center gap-1.5 text-xs">
            <Rocket className="h-3.5 w-3.5" /> Vercel Deploy
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: META PIXEL ═══ */}
        <TabsContent value="meta-pixel">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            <Card className={cn(cardBg)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Facebook className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className={cn("text-base font-semibold", textPrimary)}>Meta Pixel</CardTitle>
                      <p className={cn("text-xs", textSecondary)}>Track conversions and optimize Facebook/Instagram ad performance</p>
                    </div>
                  </div>
                  <StatusBadge configured={!!process.env.NEXT_PUBLIC_META_PIXEL_ID} />
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="what-is">
                  <AccordionItem value="what-is" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>
                      What is Meta Pixel and why it matters?
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <p className={cn("text-sm", textSecondary)}>
                          The Meta Pixel is a piece of code that you place on your website to track visitor actions.
                          It helps you:
                        </p>
                        <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 ml-2">
                          <li>Measure the effectiveness of your Facebook & Instagram ads</li>
                          <li>Track lead generation events (form submissions)</li>
                          <li>Build custom audiences for retargeting campaigns</li>
                          <li>Optimize ad delivery to people likely to convert</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="setup" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>
                      Step-by-step setup
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-1">
                        <StepCard number={1} title="Go to Meta Business Manager">
                          <p className={cn("text-sm", textSecondary)}>
                            Navigate to{" "}
                            <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline flex items-center gap-0.5 inline-flex">
                              business.facebook.com <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            → Events Manager
                          </p>
                        </StepCard>
                        <StepCard number={2} title="Create a Pixel">
                          <p className={cn("text-sm", textSecondary)}>
                            Click &quot;Connect Data Sources&quot; → &quot;Meta Pixel&quot; → Enter a name → Click &quot;Create&quot;.
                            Copy the Pixel ID (looks like: 123456789012345)
                          </p>
                        </StepCard>
                        <StepCard number={3} title="Add to your environment">
                          <p className={cn("text-sm", textSecondary)}>Add the Pixel ID to your Vercel environment variables:</p>
                          <CodeBlock code={`NEXT_PUBLIC_META_PIXEL_ID=123456789012345`} language=".env" />
                        </StepCard>
                        <StepCard number={4} title="Deploy">
                          <p className={cn("text-sm", textSecondary)}>
                            After setting the environment variable, redeploy your application on Vercel.
                            The pixel will automatically fire on page loads and track events.
                          </p>
                        </StepCard>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="verify" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>
                      Verify it&apos;s working
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <StepCard number={1} title="Install Meta Pixel Helper">
                          <p className={cn("text-sm", textSecondary)}>
                            Install the{" "}
                            <a href="https://chromewebstore.google.com/detail/meta-pixel-helper/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline flex items-center gap-0.5 inline-flex">
                              Meta Pixel Helper <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            Chrome extension
                          </p>
                        </StepCard>
                        <StepCard number={2} title="Visit your website">
                          <p className={cn("text-sm", textSecondary)}>
                            Open your website and check the Pixel Helper icon in your browser toolbar.
                            It should show a green indicator if the pixel is working correctly.
                          </p>
                        </StepCard>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="events" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>
                      Events tracked
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className={cn("rounded-lg overflow-hidden", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={isDark ? "border-b border-white/[0.06]" : "border-b border-slate-200"}>
                              <th className="text-left px-3 py-2 text-xs text-slate-400 font-medium">Event</th>
                              <th className="text-left px-3 py-2 text-xs text-slate-400 font-medium">Trigger</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-400">
                            <tr className={isDark ? "border-b border-white/[0.04]" : "border-b border-slate-100"}><td className="px-3 py-2 font-mono text-xs">Lead</td><td className="px-3 py-2">Contact form submitted</td></tr>
                            <tr className={isDark ? "border-b border-white/[0.04]" : "border-b border-slate-100"}><td className="px-3 py-2 font-mono text-xs">ViewContent</td><td className="px-3 py-2">Page viewed</td></tr>
                            <tr className={isDark ? "border-b border-white/[0.04]" : "border-b border-slate-100"}><td className="px-3 py-2 font-mono text-xs">Contact</td><td className="px-3 py-2">Contact section interacted</td></tr>
                            <tr><td className="px-3 py-2 font-mono text-xs">PageView</td><td className="px-3 py-2">Every page load</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ TAB 2: GOOGLE ANALYTICS ═══ */}
        <TabsContent value="google-analytics">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            <Card className={cn(cardBg)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className={cn("text-base font-semibold", textPrimary)}>Google Analytics 4</CardTitle>
                      <p className={cn("text-xs", textSecondary)}>Track website traffic, user behavior, and conversion goals</p>
                    </div>
                  </div>
                  <StatusBadge configured={!!process.env.NEXT_PUBLIC_GA_ID} />
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="setup">
                  <AccordionItem value="setup" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Step-by-step setup</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-1">
                        <StepCard number={1} title="Create a GA4 Property">
                          <p className={cn("text-sm", textSecondary)}>
                            Go to{" "}
                            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline flex items-center gap-0.5 inline-flex">
                              Google Analytics <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            → Admin → Create Account → Property Setup → Enter your website name and URL.
                          </p>
                        </StepCard>
                        <StepCard number={2} title="Get Measurement ID">
                          <p className={cn("text-sm", textSecondary)}>
                            After creation, go to Admin → Data Streams → Your website stream.
                            Copy the Measurement ID (format: G-XXXXXXXXXX).
                          </p>
                          <CodeBlock code={`G-2ABCDE12345`} language="Measurement ID" />
                        </StepCard>
                        <StepCard number={3} title="Add Environment Variable">
                          <p className={cn("text-sm", textSecondary)}>Add to your Vercel environment variables:</p>
                          <CodeBlock code={`NEXT_PUBLIC_GA_ID=G-2ABCDE12345`} language=".env" />
                        </StepCard>
                        <StepCard number={4} title="Deploy & Verify">
                          <p className={cn("text-sm", textSecondary)}>
                            Redeploy on Vercel. Then check Real-time reports in GA4 to verify data is flowing.
                          </p>
                        </StepCard>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="verify" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Verify tracking</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <StepCard number={1} title="Real-time Report">
                          <p className={cn("text-sm", textSecondary)}>
                            In GA4, go to Reports → Realtime. Visit your website in another tab and
                            you should see your own visit appear within seconds.
                          </p>
                        </StepCard>
                      </div>
                      <TipBox>
                        GA4 can take up to 24 hours for full data processing. Use Realtime reports
                        for immediate verification.
                      </TipBox>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ TAB 3: RESEND ═══ */}
        <TabsContent value="resend">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            <Card className={cn(cardBg)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-rose-400" />
                    </div>
                    <div>
                      <CardTitle className={cn("text-base font-semibold", textPrimary)}>Resend Email Service</CardTitle>
                      <p className={cn("text-xs", textSecondary)}>Transactional email delivery for lead notifications and auto-emails</p>
                    </div>
                  </div>
                  <StatusBadge configured={!!process.env.RESEND_API_KEY} />
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="setup">
                  <AccordionItem value="setup" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Step-by-step setup</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-1">
                        <StepCard number={1} title="Create Resend Account">
                          <p className={cn("text-sm", textSecondary)}>
                            Sign up at{" "}
                            <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline flex items-center gap-0.5 inline-flex">
                              resend.com <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            and complete the onboarding.
                          </p>
                        </StepCard>
                        <StepCard number={2} title="Get API Key">
                          <p className={cn("text-sm", textSecondary)}>
                            Go to API Keys → Create API Key → Copy the key (starts with re_).
                          </p>
                          <CodeBlock code={`re_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890`} language="API Key" />
                        </StepCard>
                        <StepCard number={3} title="Verify Your Domain">
                          <p className={cn("text-sm", textSecondary)}>
                            Go to Domains → Add Domain → Enter your domain (e.g., yourdomain.com).
                            Resend will provide DNS records to add:
                          </p>
                          <CodeBlock code={`// Add these DNS records in your domain registrar
// Type: TXT, Name: @, Value: v=spf1 include:amazonses.com ~all
// Type: TXT, Name: resend._domainkey, Value: [DKIM key from Resend]
// Type: MX, Name: send, Value: feedback-smtp.us-east-1.amazonses.com`} language="DNS Records" />
                          <WarningBox>
                            Domain verification can take up to 48 hours to propagate. Until verified,
                            emails will be sent from Resend&apos;s default onboarding domain.
                          </WarningBox>
                        </StepCard>
                        <StepCard number={4} title="Set Environment Variable">
                          <p className={cn("text-sm", textSecondary)}>Add to Vercel environment variables:</p>
                          <CodeBlock code={`RESEND_API_KEY=re_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890`} language=".env" />
                        </StepCard>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="test" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Test email sending</AccordionTrigger>
                    <AccordionContent>
                      <p className={cn("text-sm", textSecondary)}>
                        Submit the contact form on your website. A lead welcome email should be sent
                        automatically. Check the Resend dashboard under Activity → Emails to verify delivery.
                      </p>
                      <TipBox>
                        If emails aren&apos;t sending, verify: 1) API key is set correctly, 2) Domain is verified,
                        3) Check server logs for errors.
                      </TipBox>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ TAB 4: AUTO-EMAIL ═══ */}
        <TabsContent value="auto-email">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            <Card className={cn(cardBg)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className={cn("text-base font-semibold", textPrimary)}>Auto-Email Setup</CardTitle>
                    <p className={cn("text-xs", textSecondary)}>Configure automated email responses for different lead stages</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="how-it-works">
                  <AccordionItem value="how-it-works" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>How auto-emails work</AccordionTrigger>
                    <AccordionContent>
                      <p className={cn("text-sm", textSecondary)}>
                        When a lead submits the contact form, the system automatically sends emails
                        based on triggers and automation rules. You can customize the email content,
                        subject lines, and timing in the Email Templates and Automations pages.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="welcome" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Lead Welcome Email</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 text-[10px]">Immediate</Badge>
                          <span className="text-xs text-slate-400">Triggered when: Lead form is submitted</span>
                        </div>
                        <p className={cn("text-sm", textSecondary)}>
                          Sends a personalized welcome email to the lead confirming receipt of their inquiry.
                          Include company info, next steps, and a thank you message.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="follow-up" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Follow-up Email</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px]">Configurable Delay</Badge>
                          <span className="text-xs text-slate-400">Triggered when: Lead hasn&apos;t responded</span>
                        </div>
                        <p className={cn("text-sm", textSecondary)}>
                          A gentle follow-up email sent after a configurable delay (e.g., 1 day, 3 days).
                          Reminds the lead about your services and encourages them to schedule a consultation.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="consultation" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Consultation Reminder</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/25 text-[10px]">Before Event</Badge>
                          <span className="text-xs text-slate-400">Triggered when: Consultation is scheduled</span>
                        </div>
                        <p className={cn("text-sm", textSecondary)}>
                          Sends a reminder email with meeting details, date/time, and any preparation
                          notes before the scheduled consultation.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="proposal" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Proposal Sent Notification</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">Immediate</Badge>
                          <span className="text-xs text-slate-400">Triggered when: Proposal is sent</span>
                        </div>
                        <p className={cn("text-sm", textSecondary)}>
                          Notifies the lead that a proposal has been prepared and sent for their review.
                          Includes a link to view the proposal details.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="customize" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Customize templates</AccordionTrigger>
                    <AccordionContent>
                      <p className={cn("text-sm", textSecondary)}>
                        Navigate to the <strong className="text-white">Email Templates</strong> page to edit subject lines,
                        HTML content, and available template variables. Navigate to the{" "}
                        <strong className="text-white">Automations</strong> page to configure triggers, delays, and enable/disable rules.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ TAB 5: VERCEL ═══ */}
        <TabsContent value="vercel">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            <Card className={cn(cardBg)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Rocket className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className={cn("text-base font-semibold", textPrimary)}>Vercel Deployment</CardTitle>
                    <p className={cn("text-xs", textSecondary)}>Automatic deployment and environment configuration</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="auto-deploy">
                  <AccordionItem value="auto-deploy" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Automatic deployment</AccordionTrigger>
                    <AccordionContent>
                      <p className={cn("text-sm", textSecondary)}>
                        Your project is connected to Vercel via Git. Any push to the main branch triggers an automatic deployment.
                        Build logs and deployment status can be viewed in the Vercel dashboard.
                      </p>
                      <TipBox>
                        Avoid pushing directly to main. Use feature branches and pull requests for safer deployments.
                      </TipBox>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="env-vars" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Environment variables</AccordionTrigger>
                    <AccordionContent>
                      <p className={cn("text-sm", textSecondary)}>
                        Go to Vercel → Settings → Environment Variables. Required variables:
                      </p>
                      <CodeBlock code={`DATABASE_URL=postgresql://user:pass@host:5432/db
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_META_PIXEL_ID=your-pixel-id
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
RESEND_API_KEY=re_your-api-key`} language="Environment Variables" />
                      <WarningBox>
                        Never commit secrets to Git. Always use Vercel environment variables for sensitive values.
                      </WarningBox>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="custom-domain" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Custom domain setup</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pl-1">
                        <StepCard number={1} title="Add domain in Vercel">
                          <p className={cn("text-sm", textSecondary)}>
                            Go to Settings → Domains → Add your custom domain (e.g., app.yourdomain.com)
                          </p>
                        </StepCard>
                        <StepCard number={2} title="Configure DNS">
                          <p className={cn("text-sm", textSecondary)}>Add a CNAME record in your DNS settings:</p>
                          <CodeBlock code={`// Type: CNAME
// Name: app (or @ for root domain)
// Value: cname.vercel-dns.com`} language="DNS" />
                        </StepCard>
                        <StepCard number={3} title="SSL Certificate">
                          <p className={cn("text-sm", textSecondary)}>
                            Vercel automatically provisions an SSL certificate. It may take a few minutes
                            after DNS propagation.
                          </p>
                        </StepCard>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="logs" className={isDark ? "border-white/[0.06]" : ""}>
                    <AccordionTrigger className={cn("text-sm font-medium", textPrimary)}>Deployment logs</AccordionTrigger>
                    <AccordionContent>
                      <p className={cn("text-sm", textSecondary)}>
                        View deployment logs at Vercel → Deployments → Select deployment → Build Logs / Runtime Logs.
                        Useful for debugging build failures or runtime errors.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
