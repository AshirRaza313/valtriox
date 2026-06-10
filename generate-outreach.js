const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Tab, TabStopPosition, TabStopType, AlignmentType,
  HeadingLevel, BorderStyle, ShadingType, Footer, PageNumber,
  NumberFormat, Header, TableOfContents, LevelFormat,
  convertInchesToTwip, ExternalHyperlink, UnderlineType,
  VerticalAlign, WidthType, LineRuleType
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─── IG-1 (Ink Gold) Palette ───
const IG1 = {
  bg: "1A1A1A",
  primary: "FFFFFF",
  accent: "C9A84C",
  headerBg: "C9A84C",
  headerText: "1A1A1A",
  lightGold: "F5EFE0",
  scriptBg: "FAFAF5",
  subtleGold: "E8DCC8",
};

// ─── Fonts ───
const FONTS = {
  heading: "Times New Roman",
  body: "Calibri",
  accent: "Calibri",
};

// ─── Shared border config ───
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const goldBorder = { style: BorderStyle.SINGLE, size: 6, color: IG1.accent };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" };
const scriptBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: { style: BorderStyle.SINGLE, size: 8, color: IG1.accent },
  right: thinBorder,
};
const headerTableBorders = {
  top: goldBorder,
  bottom: goldBorder,
  left: goldBorder,
  right: goldBorder,
};

// ─── Helper: paragraph with body text style ───
function bodyPara(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 312, lineRule: LineRuleType.AUTO },
    alignment: AlignmentType.JUSTIFIED,
    ...opts,
    children: [
      new TextRun({
        text,
        font: FONTS.body,
        size: 22,
        color: IG1.bg,
        ...(opts.runOpts || {}),
      }),
    ],
  });
}

function bodyParaMulti(runs, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 312, lineRule: LineRuleType.AUTO },
    alignment: AlignmentType.JUSTIFIED,
    ...opts,
    children: runs.map(r => {
      if (typeof r === "string") {
        return new TextRun({ text: r, font: FONTS.body, size: 22, color: IG1.bg });
      }
      return new TextRun({ font: FONTS.body, size: 22, color: IG1.bg, ...r });
    }),
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200, line: 312 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: FONTS.heading,
        size: 36,
        bold: true,
        color: IG1.headerText,
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: IG1.headerBg },
    alignment: AlignmentType.LEFT,
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160, line: 312 },
    children: [
      new TextRun({
        text,
        font: FONTS.heading,
        size: 28,
        bold: true,
        color: IG1.accent,
      }),
    ],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120, line: 312 },
    children: [
      new TextRun({
        text,
        font: FONTS.heading,
        size: 24,
        bold: true,
        color: IG1.bg,
      }),
    ],
  });
}

function emptyPara(spacing = 60) {
  return new Paragraph({ spacing: { after: spacing }, children: [new TextRun({ text: " ", font: FONTS.body, size: 2 })] });
}

function goldLine() {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: IG1.accent, space: 1 },
    },
    children: [new TextRun({ text: " ", font: FONTS.body, size: 2 })],
  });
}

// ─── Script Box (Table with gold left border and light background) ───
function scriptBox(title, content, metaText) {
  const rows = [
    // Title row
    new TableRow({
      children: [
        new TableCell({
          borders: scriptBorders,
          shading: { type: ShadingType.CLEAR, fill: IG1.headerBg },
          children: [
            new Paragraph({
              spacing: { after: 40, before: 80 },
              children: [
                new TextRun({
                  text: title,
                  font: FONTS.heading,
                  size: 22,
                  bold: true,
                  color: IG1.headerText,
                }),
              ],
            }),
          ],
          margins: { top: 60, bottom: 60, left: 140, right: 140 },
        }),
      ],
    }),
  ];

  // Content rows
  const paragraphs = content.map(line =>
    new Paragraph({
      spacing: { after: 80, line: 312, lineRule: LineRuleType.AUTO },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: line,
          font: FONTS.body,
          size: 21,
          color: "333333",
        }),
      ],
    })
  );

  rows.push(
    new TableRow({
      children: [
        new TableCell({
          borders: scriptBorders,
          shading: { type: ShadingType.CLEAR, fill: IG1.scriptBg },
          children: paragraphs,
          margins: { top: 100, bottom: 100, left: 180, right: 140 },
        }),
      ],
    })
  );

  // Meta row (optional)
  if (metaText) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: scriptBorders,
            shading: { type: ShadingType.CLEAR, fill: IG1.lightGold },
            children: [
              new Paragraph({
                spacing: { after: 40, before: 40 },
                children: [
                  new TextRun({
                    text: metaText,
                    font: FONTS.body,
                    size: 18,
                    italics: true,
                    color: "666666",
                  }),
                ],
              }),
            ],
            margins: { top: 40, bottom: 40, left: 140, right: 140 },
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    spacing: { before: 120, after: 200 },
  });
}

// ─── Objection Box (slightly different style) ───
function objectionBox(objection, response) {
  const rows = [
    new TableRow({
      children: [
        new TableCell({
          borders: scriptBorders,
          shading: { type: ShadingType.CLEAR, fill: IG1.headerBg },
          children: [
            new Paragraph({
              spacing: { after: 40, before: 80 },
              children: [
                new TextRun({
                  text: "Objection: ",
                  font: FONTS.heading,
                  size: 21,
                  bold: true,
                  color: IG1.headerText,
                }),
                new TextRun({
                  text: `"${objection}"`,
                  font: FONTS.body,
                  size: 21,
                  italics: true,
                  color: IG1.headerText,
                }),
              ],
            }),
          ],
          margins: { top: 60, bottom: 60, left: 140, right: 140 },
        }),
      ],
    }),
  ];

  const respParas = response.map(line =>
    new Paragraph({
      spacing: { after: 80, line: 312, lineRule: LineRuleType.AUTO },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: line, font: FONTS.body, size: 21, color: "333333" }),
      ],
    })
  );

  rows.push(
    new TableRow({
      children: [
        new TableCell({
          borders: scriptBorders,
          shading: { type: ShadingType.CLEAR, fill: IG1.scriptBg },
          children: respParas,
          margins: { top: 100, bottom: 100, left: 180, right: 140 },
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    spacing: { before: 120, after: 200 },
  });
}

// ───────────────────────────────────────────────
// COVER PAGE — R2 Double-Rule Frame Recipe
// ───────────────────────────────────────────────
function buildCoverSection() {
  const darkBg = { type: ShadingType.CLEAR, fill: IG1.bg };
  const accentColor = IG1.accent;
  const whiteColor = IG1.primary;

  // Outer border table (dark bg, gold border)
  const outerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 18, color: accentColor },
      bottom: { style: BorderStyle.SINGLE, size: 18, color: accentColor },
      left: { style: BorderStyle.SINGLE, size: 18, color: accentColor },
      right: { style: BorderStyle.SINGLE, size: 18, color: accentColor },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
              left: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
              right: { style: BorderStyle.SINGLE, size: 6, color: accentColor },
            },
            shading: darkBg,
            width: { size: 100, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: " ", font: FONTS.body, size: 2 })] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: "V A L T R I O X",
                    font: FONTS.heading,
                    size: 56,
                    color: accentColor,
                    bold: true,
                    characterSpacing: 200,
                  }),
                ],
              }),
              // Gold separator line
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
                children: [
                  new TextRun({
                    text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                    font: FONTS.body,
                    size: 20,
                    color: accentColor,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: "Brand Outreach Guide",
                    font: FONTS.heading,
                    size: 52,
                    color: whiteColor,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    text: "Command Your Brand Universe",
                    font: FONTS.accent,
                    size: 24,
                    italics: true,
                    color: accentColor,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 40 },
                children: [
                  new TextRun({
                    text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                    font: FONTS.body,
                    size: 20,
                    color: accentColor,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 80 },
                children: [
                  new TextRun({
                    text: "Complete Scripts for Beta Partner Acquisition",
                    font: FONTS.accent,
                    size: 26,
                    color: whiteColor,
                  }),
                ],
              }),
              emptyPara(400),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: "Prepared for Valtriox Platform Team",
                    font: FONTS.accent,
                    size: 20,
                    color: "AAAAAA",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: "Confidential",
                    font: FONTS.accent,
                    size: 20,
                    color: "AAAAAA",
                  }),
                ],
              }),
              emptyPara(200),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: "June 2026",
                    font: FONTS.heading,
                    size: 28,
                    color: accentColor,
                    bold: true,
                  }),
                ],
              }),
              emptyPara(600),
            ],
            margins: { top: 0, bottom: 0, left: 600, right: 600 },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  });

  return {
    properties: {
      page: {
        size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69), orientation: "portrait" },
        margin: { top: convertInchesToTwip(0.5), bottom: convertInchesToTwip(0.5), left: convertInchesToTwip(0.75), right: convertInchesToTwip(0.75) },
      },
    },
    children: [outerTable],
  };
}

// ───────────────────────────────────────────────
// TABLE OF CONTENTS SECTION
// ───────────────────────────────────────────────
function buildTOCSection() {
  return {
    properties: {
      page: {
        size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
        margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(1) },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Valtriox Brand Outreach Guide", font: FONTS.accent, size: 16, color: "AAAAAA", italics: true }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "— ", font: FONTS.accent, size: 18, color: IG1.accent }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONTS.accent, size: 18, color: IG1.accent }),
              new TextRun({ text: " —", font: FONTS.accent, size: 18, color: IG1.accent }),
            ],
          }),
        ],
      }),
    },
    children: [
      new Paragraph({
        spacing: { before: 200, after: 300 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "TABLE OF CONTENTS",
            font: FONTS.heading,
            size: 36,
            bold: true,
            color: IG1.headerText,
          }),
        ],
      }),
      goldLine(),
      emptyPara(100),
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
      new Paragraph({
        children: [new PageBreak()],
      }),
    ],
  };
}

// ───────────────────────────────────────────────
// BODY SECTION
// ───────────────────────────────────────────────
function buildBodySection() {
  const children = [];

  // Helper to add content
  const add = (...items) => items.forEach(item => children.push(item));

  // ════════════════════════════════════════════
  // CHAPTER 1: OUTREACH STRATEGY OVERVIEW
  // ════════════════════════════════════════════
  add(
    heading1("Chapter 1: Outreach Strategy Overview"),
    emptyPara(60),
    bodyPara("This guide provides a comprehensive framework for Valtriox's beta partner acquisition campaign. As a premium brand management SaaS platform designed to help businesses command their brand universe, Valtriox is launching an exclusive beta programme to onboard early partners who will shape the platform's evolution. The scripts contained within this document have been crafted to resonate with brand owners and decision-makers across multiple industries, ensuring every outreach touchpoint is professional, compelling, and conversion-focused."),
    emptyPara(40),
    bodyPara("The purpose of this outreach initiative is twofold: first, to identify and engage high-potential brands that would benefit most from an all-in-one brand management solution, and second, to build a community of early adopters whose feedback will directly influence Valtriox's product roadmap. Every interaction should convey exclusivity, value, and a genuine interest in the prospective partner's success. Our beta partners are not merely users — they are founding members of a platform built for ambitious brands."),
    emptyPara(40),
    bodyPara("Our target brands span several key verticals. E-commerce brands managing multi-channel sales and inventory represent our primary audience, as they often struggle with fragmented tools for orders, products, and customer engagement. Fashion and lifestyle brands benefit from Valtriox's marketing hub and CRM capabilities, which help them maintain consistent brand identity across touchpoints. Technology companies value the platform's team collaboration features and real-time analytics, while food and beverage brands appreciate the streamlined order management and customer communication tools. Service-based businesses find particular value in the task management, client relationship management, and reporting modules that Valtriox offers."),
    emptyPara(40),
    bodyPara("The outreach will be conducted across four primary channels, each chosen for its unique advantages. Email remains the most professional medium for formal introductions, allowing detailed value propositions and documentation attachments. WhatsApp provides a more personal, conversational touchpoint ideal for quick follow-ups and trial activation. LinkedIn serves as a powerful platform for connecting with decision-makers in a business context, leveraging professional networks and credibility. Instagram direct messages enable a brand-aware, visually engaging approach for fashion, lifestyle, and creative brands."),
    emptyPara(40),
    bodyPara("Personalisation is the cornerstone of effective outreach. Every script in this guide includes placeholders such as [Brand Name], [Owner Name], and [Specific Detail] — these must be customised for each prospect. Research the brand before reaching out: visit their website, review their social media presence, identify their product range, and note any recent achievements or challenges. Reference specific details in your opening to demonstrate genuine interest. Timing also matters significantly; outreach sent on Tuesday through Thursday between 9:00 AM and 11:00 AM in the recipient's local time zone consistently achieves higher open and response rates."),
    emptyPara(40),
    bodyPara("Establish clear metrics to track the effectiveness of each outreach channel and script variant. Monitor open rates, response rates, trial activation rates, and ultimately, conversion to paid subscriptions. Aim for a minimum 15% response rate across email campaigns and a 25% response rate for WhatsApp and Instagram outreach. Each week, review performance data to identify which scripts and approaches are resonating most, and iterate accordingly. Document all interactions in your CRM to ensure seamless follow-up sequences and team-wide visibility into each prospect's journey."),

    // ════════════════════════════════════════════
    // CHAPTER 2: COLD EMAIL SCRIPTS
    // ════════════════════════════════════════════
    heading1("Chapter 2: Cold Email Scripts"),
    emptyPara(60),
    bodyPara("Email outreach is the most formal and detailed channel in our acquisition strategy. Each script below has been designed to build progressive value while maintaining a professional yet approachable tone. Scripts are sequenced to warm the prospect over time, moving from initial introduction through value demonstration to urgency-driven closing. Always customise placeholders and ensure the subject line is compelling enough to earn the open."),

    heading2("Script 2.1: Initial Cold Email"),
    bodyPara("This is the first point of contact. It should be concise, compelling, and focused on the opportunity rather than a hard sell. The goal is to pique interest and earn a response."),
    emptyPara(40),
    scriptBox(
      "Subject: Exclusive Beta Access — Transform How [Brand Name] Manages Growth",
      [
        "Dear [Owner Name],",
        "",
        "I hope this message finds you well. My name is [Your Name], and I am reaching out from Valtriox — a new premium brand management platform built specifically for ambitious brands like [Brand Name]. We are currently selecting a limited number of founding beta partners, and your brand stood out to us as an exceptional candidate.",
        "",
        "Running a growing brand means juggling orders, inventory, marketing campaigns, customer relationships, and team coordination — often across multiple disconnected tools. Valtriox was designed to solve exactly this challenge. Our platform unifies order management, AI-powered business insights, team collaboration, a full marketing hub, and a built-in CRM into one elegant, intuitive dashboard. In short, Valtriox empowers you to Command Your Brand Universe from a single platform.",
        "",
        "As a beta partner, you will receive exclusive, complimentary access to Valtriox's complete suite of features — absolutely free, with no credit card required and no obligation to continue after the beta period. Your experience and feedback will directly shape the platform's development, ensuring it meets the real-world needs of brand owners like yourself.",
        "",
        "I would be delighted to set up a brief fifteen-minute call to walk you through the platform and discuss how Valtriox could support [Brand Name]'s growth objectives. Alternatively, I can activate your free beta account immediately so you can explore at your own pace.",
        "",
        "Please feel free to reply to this email or reach me directly at [Your Phone Number]. I look forward to the possibility of welcoming [Brand Name] as a founding Valtriox partner.",
        "",
        "Warm regards,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "[Your Email] | [Your Phone]",
        "valtriox.com",
      ],
      "Channel: Email | Timing: First contact | Goal: Earn a response or trial activation"
    ),

    heading2("Script 2.2: Warm Follow-Up Email"),
    bodyPara("Send this 3 to 5 days after the initial email if no response has been received. This follow-up adds specific feature details and reinforces the no-cost value proposition."),
    emptyPara(40),
    scriptBox(
      "Subject: Following Up — How Valtriox Can Streamline [Brand Name]'s Operations",
      [
        "Dear [Owner Name],",
        "",
        "I wanted to follow up on my previous message regarding Valtriox's exclusive beta programme. I understand you are busy managing [Brand Name]'s operations, so I will keep this brief and focused on what matters most to you.",
        "",
        "Valtriox offers five core modules that work together seamlessly as an integrated ecosystem:",
        "",
        "Order Management — Track, process, and fulfil orders across all channels from a single dashboard. Automate status updates, generate invoices, and manage returns effortlessly.",
        "",
        "AI-Powered Insights — Receive predictive analytics on revenue trends, customer behaviour, and inventory patterns. Our AI engine identifies opportunities and risks before they become apparent, giving you a competitive edge.",
        "",
        "Team Collaboration — Assign tasks, track attendance, manage payroll, and communicate with your team in real time. Everyone stays aligned and productive, regardless of location.",
        "",
        "Marketing Hub — Plan campaigns, manage social media, schedule broadcasts, run flash sales, and track ad performance. Your marketing operations live in one centralised hub with full analytics.",
        "",
        "Built-in CRM — Cultivate customer relationships with detailed profiles, purchase history, loyalty programmes, WhatsApp integration, and automated follow-up sequences.",
        "",
        "This is a genuinely complimentary beta — no credit card is required, there is no trial period pressure, and your feedback directly shapes the product. We are selectively onboarding brands that we believe will benefit most, and [Brand Name] remains at the top of our list.",
        "",
        "Would you be open to a quick call this week, or would you prefer I activate your account so you can explore independently? I am happy to accommodate whichever approach suits you best.",
        "",
        "Best regards,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: Email | Timing: 3-5 days after initial | Goal: Feature awareness and trial activation"
    ),

    heading2("Script 2.3: Value-Driven Follow-Up"),
    bodyPara("This follow-up, sent 7 to 10 days after initial contact, provides social proof and a benefit highlight to address the prospect's desire for validated solutions."),
    emptyPara(40),
    scriptBox(
      "Subject: A Quick Win — What Early Brands Are Saying About Valtriox",
      [
        "Dear [Owner Name],",
        "",
        "I hope this finds you well. I am writing one final time to share something I believe will resonate with [Brand Name]'s growth trajectory.",
        "",
        "Since launching our private beta, the response from early brand partners has been remarkable. Brands similar to [Brand Name] — particularly in the [industry segment] space — have reported significant improvements within their first few weeks on the platform. One early adopter described Valtriox as the first tool that finally brought all their brand operations under one roof, replacing four separate subscriptions they were previously managing. Another partner noted that the AI-powered insights identified a revenue opportunity they had been overlooking, resulting in a measurable uplift within the first month.",
        "",
        "What makes these results particularly meaningful is that these brands had no prior relationship with Valtriox. They joined the beta with the same healthy scepticism that any business owner would have when evaluating a new platform — and they quickly discovered that Valtriox delivers on its promise: Command Your Brand Universe.",
        "",
        "I want to be transparent: the beta programme has limited capacity, and spots are filling. We are committed to giving each beta partner the attention and support they deserve, which means we intentionally keep the cohort small. [Brand Name] still has a reserved place, but I wanted to give you a friendly heads-up before we reach capacity.",
        "",
        "There is absolutely no cost during the beta — no credit card, no commitment, no hidden terms. Just a genuine opportunity to experience a platform that could transform how you manage and grow [Brand Name].",
        "",
        "I would love to hear from you. Even a brief reply saying this is not the right time would be greatly appreciated so I can update my records accordingly.",
        "",
        "Kind regards,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: Email | Timing: 7-10 days after initial | Goal: Social proof and urgency"
    ),

    heading2("Script 2.4: Final Closing Email"),
    bodyPara("The final touchpoint in the email sequence, sent at 14 days. This creates urgency while remaining respectful and leaving the door open."),
    emptyPara(40),
    scriptBox(
      "Subject: Closing the Beta Window — Last Invitation for [Brand Name]",
      [
        "Dear [Owner Name],",
        "",
        "This will be my final outreach regarding Valtriox's beta programme, and I want to keep it respectful of your time while ensuring you have every opportunity to participate.",
        "",
        "Our founding beta cohort is approaching capacity. We deliberately limit the number of beta partners to ensure each receives dedicated support and that their feedback meaningfully influences the platform's development. [Brand Name] was identified early in our research as a brand we genuinely want to work with, and I wanted to extend one last invitation before the window closes.",
        "",
        "To recap what Valtriox offers during the beta period:",
        "",
        "Complete, unrestricted access to every module — order management, AI insights, team collaboration, marketing hub, CRM, and all supporting features including analytics, subscriptions, and integrations.",
        "",
        "Zero cost — no credit card is required at any point, and there is no automatic charge when the beta concludes.",
        "",
        "Direct influence on product development — your feedback shapes the features, workflows, and priorities that define Valtriox's public launch.",
        "",
        "Dedicated onboarding support — a member of our team will personally guide you through setup and ensure you are extracting maximum value from day one.",
        "",
        "If you would like to claim your beta spot, simply reply to this email with the word BETA, and I will have your account activated within twenty-four hours. Alternatively, you can sign up directly at valtriox.com using the invitation code [INVITATION CODE].",
        "",
        "Thank you for considering this opportunity. Regardless of your decision, I wish [Brand Name] continued success and growth.",
        "",
        "With respect,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: Email | Timing: 14 days after initial | Goal: Final conversion or graceful close"
    ),

    // ════════════════════════════════════════════
    // CHAPTER 3: WHATSAPP OUTREACH SCRIPTS
    // ════════════════════════════════════════════
    heading1("Chapter 3: WhatsApp Outreach Scripts"),
    emptyPara(60),
    bodyPara("WhatsApp offers a uniquely personal communication channel that often achieves higher response rates than email, particularly for small and medium-sized brand owners who manage their businesses on mobile devices. The scripts below are designed to be professional yet conversational, respecting the informal nature of the platform while maintaining Valtriox's premium brand positioning. Keep messages concise, use appropriate spacing, and always customise placeholders with verified details."),

    heading2("Script 3.1: Initial WhatsApp Message"),
    bodyPara("The first WhatsApp message should feel natural and non-intrusive. Introduce yourself clearly, state your purpose, and make the value proposition immediately apparent."),
    emptyPara(40),
    scriptBox(
      "WhatsApp — Initial Contact Message",
      [
        "Hello [Owner Name] 👋",
        "",
        "My name is [Your Name] from Valtriox. I came across [Brand Name] and was genuinely impressed by what you have built — particularly [mention one specific thing you noticed about their brand, e.g., your product range / your recent campaign / your brand aesthetic].",
        "",
        "I am reaching out because we are currently inviting a select group of brands to join our exclusive beta programme for Valtriox, a new all-in-one brand management platform. Think of it as a single dashboard where you can manage orders, track analytics powered by AI, collaborate with your team, run marketing campaigns, and build customer relationships — all in one place.",
        "",
        "The beta is completely free — no credit card, no catch, no obligation. We are looking for brand owners who want to shape a platform built specifically for their needs.",
        "",
        "Would you be open to learning more? I am happy to send you a quick overview or set up your account right away.",
        "",
        "— [Your Name], Valtriox",
        "valtriox.com",
      ],
      "Channel: WhatsApp | Timing: First contact | Keep under 300 words"
    ),

    heading2("Script 3.2: Follow-Up WhatsApp Message"),
    bodyPara("If the prospect has not responded within 2 to 3 days, this gentle follow-up adds a new angle and addresses potential questions before they are asked."),
    emptyPara(40),
    scriptBox(
      "WhatsApp — Follow-Up Message",
      [
        "Hi [Owner Name], just following up on my earlier message. I completely understand how busy running [Brand Name] keeps you, so I will keep this brief.",
        "",
        "A few brands have asked similar questions, so I thought I would address the most common ones upfront:",
        "",
        "Is it really free? Yes, the entire beta period is complimentary with no credit card required. When the beta ends, you will have the option to continue at a preferred rate — but there is absolutely no pressure or automatic billing.",
        "",
        "How much time does setup take? Most brand partners are up and running within thirty minutes. Our team guides you through every step.",
        "",
        "What if I already use other tools? Valtriox integrates with popular platforms and is designed to consolidate your existing workflow into one unified system.",
        "",
        "I would love to hear your thoughts. Even a quick yes or no helps me plan accordingly. If now is not the right time, no worries at all — I will simply mark you for a future outreach cycle.",
        "",
        "— [Your Name]",
        "valtriox.com",
      ],
      "Channel: WhatsApp | Timing: 2-3 days after initial | Goal: Overcome initial hesitation"
    ),

    heading2("Script 3.3: Trial Activation Message"),
    bodyPara("When the prospect expresses interest, this message provides the sign-up link and brief instructions to ensure a smooth onboarding experience."),
    emptyPara(40),
    scriptBox(
      "WhatsApp — Trial Activation Message",
      [
        "Wonderful news, [Owner Name]! I am thrilled to welcome [Brand Name] to the Valtriox beta programme. 🎉",
        "",
        "Here is your exclusive sign-up link:",
        "valtriox.com/beta-claim?code=[INVITATION CODE]",
        "",
        "Three quick steps to get started:",
        "1. Click the link above and create your account using your business email",
        "2. Complete your brand profile — name, logo, product categories, and team members",
        "3. Explore the dashboard! Start with the Orders or Analytics section to see immediate value",
        "",
        "Your beta account gives you full access to every feature, including AI-powered insights, marketing hub, team collaboration tools, and CRM — all completely free during the beta period.",
        "",
        "I will personally check in with you in a few days to see how things are going and answer any questions. In the meantime, feel free to reach out anytime — I am here to help.",
        "",
        "Welcome aboard! Let us Command Your Brand Universe together. 🚀",
        "",
        "— [Your Name], Valtriox",
        "valtriox.com",
      ],
      "Channel: WhatsApp | Timing: Upon interest confirmation | Goal: Smooth activation"
    ),

    // ════════════════════════════════════════════
    // CHAPTER 4: LINKEDIN OUTREACH SCRIPTS
    // ════════════════════════════════════════════
    heading1("Chapter 4: LinkedIn Outreach Scripts"),
    emptyPara(60),
    bodyPara("LinkedIn provides a professional context for connecting with brand owners, founders, and executives. The platform's networking-first culture means your approach should emphasise mutual professional benefit and the exclusivity of the opportunity. LinkedIn character limits must be respected — connection request messages are capped at 300 characters — so brevity is essential. Once connected, you can transition to more detailed communication via LinkedIn messages, InMail, or even email and WhatsApp with the prospect's permission."),

    heading2("Script 4.1: Connection Request Message"),
    bodyPara("This message must be under 300 characters. Every word must earn its place. The goal is simply to connect, not to sell."),
    emptyPara(40),
    scriptBox(
      "LinkedIn — Connection Request (Max 300 Characters)",
      [
        "Hi [Owner Name], I have been following [Brand Name] and am genuinely impressed by your growth. I work with Valtriox, a brand management platform currently inviting select brands for free beta access. I would love to connect and share how it could support your operations.",
      ],
      "Channel: LinkedIn | Max: 300 characters | Goal: Earn the connection acceptance"
    ),

    heading2("Script 4.2: Post-Connection Message"),
    bodyPara("After the prospect accepts your connection request, send this message within 24 hours. It formally introduces Valtriox and extends the beta invitation."),
    emptyPara(40),
    scriptBox(
      "LinkedIn — Post-Connection Introduction",
      [
        "Dear [Owner Name],",
        "",
        "Thank you for connecting — I truly appreciate it. Now that we are connected, I would like to share a bit more about Valtriox and why I believe [Brand Name] would be an exceptional fit for our beta programme.",
        "",
        "Valtriox is a comprehensive brand management platform that unifies the core operational pillars of running a brand into a single, powerful dashboard. Our platform includes end-to-end order management with automated invoicing and returns processing, AI-driven analytics that deliver predictive insights on revenue, inventory, and customer behaviour, team collaboration tools with task management and real-time communication, a centralised marketing hub for campaigns, social media, and advertising, and a full CRM with customer profiles, loyalty programmes, and WhatsApp integration.",
        "",
        "We are currently onboarding a small cohort of founding beta partners. The programme offers complete, unrestricted access to Valtriox at no cost during the entire beta period — no credit card is required, and there is no automatic transition to a paid plan. Beta partners also receive dedicated onboarding support and the opportunity to directly influence the platform's product development through their feedback.",
        "",
        "I would welcome the opportunity to schedule a brief call to demonstrate the platform, or I can activate your beta account immediately if you prefer to explore independently. Please let me know which option works best for you, or feel free to share any questions you might have.",
        "",
        "Looking forward to the conversation.",
        "",
        "Best regards,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: LinkedIn Message | Timing: Within 24 hours of connection | Goal: Earn a call or trial activation"
    ),

    heading2("Script 4.3: InMail Outreach"),
    bodyPara("For premium brand owners or executives who may not accept unsolicited connection requests, LinkedIn InMail provides a credible, professional alternative that delivers your message directly to their inbox."),
    emptyPara(40),
    scriptBox(
      "LinkedIn InMail — Premium Brand Pitch",
      [
        "Subject: Complimentary Beta Access — Valtriox Brand Management Platform",
        "",
        "Dear [Owner Name],",
        "",
        "I am reaching out via InMail because I believe Valtriox can deliver significant operational value to [Brand Name], and I wanted to present this opportunity through the most professional channel available.",
        "",
        "Valtriox is a new category of brand management software — an all-in-one platform that consolidates order management, AI-powered analytics, team operations, marketing execution, and customer relationship management into a single, cohesive ecosystem. Unlike point solutions that address one operational area in isolation, Valtriox creates a unified operational layer where data flows seamlessly between modules, giving brand owners unprecedented visibility and control over their entire business.",
        "",
        "We are currently running an exclusive beta programme, selecting a limited number of brands to serve as founding partners. Beta participants receive complete platform access at zero cost — no credit card is required, no financial commitment of any kind, and no obligation to subscribe post-beta. In return, we ask for candid feedback and the willingness to help us refine the platform for the brands it serves.",
        "",
        "[Brand Name]'s profile — particularly [mention a specific aspect: your impressive product line / your growth trajectory / your market position] — aligns closely with the type of brand we built Valtriox to serve. I am confident that the platform's capabilities would meaningfully support your operational efficiency and growth ambitions.",
        "",
        "I would be grateful for the opportunity to demonstrate Valtriox in a brief, no-pressure call. Alternatively, I can activate your beta credentials immediately and provide asynchronous support as you explore the platform at your convenience.",
        "",
        "Thank you for your time and consideration. I look forward to hearing from you.",
        "",
        "Respectfully,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: LinkedIn InMail | Timing: Strategic | Goal: Earn demo call or trial sign-up"
    ),

    // ════════════════════════════════════════════
    // CHAPTER 5: INSTAGRAM DM OUTREACH SCRIPTS
    // ════════════════════════════════════════════
    heading1("Chapter 5: Instagram DM Outreach Scripts"),
    emptyPara(60),
    bodyPara("Instagram direct messages are particularly effective for fashion, lifestyle, beauty, food, and creative brands where visual identity is central to the business. The platform's informal culture means your tone should be warm, genuine, and complimentary. Avoid corporate language — instead, mirror the brand's own communication style while maintaining professionalism. Instagram DMs should be shorter and more visually oriented than email or LinkedIn messages. Always reference specific content from their feed to demonstrate authentic engagement."),

    heading2("Script 5.1: Initial Instagram DM"),
    bodyPara("Open with a genuine compliment about their brand, followed by a subtle introduction of Valtriox. The goal is to earn a response, not to close on the first message."),
    emptyPara(40),
    scriptBox(
      "Instagram DM — Initial Contact",
      [
        "Hi [Owner Name]! 🌟",
        "",
        "I have been following [Brand Name] for a while and absolutely love what you are doing — your recent [mention a specific post, product, or campaign] really caught my eye. The attention to detail and brand consistency is exceptional.",
        "",
        "I am [Your Name] from Valtriox, and we are building an all-in-one brand management platform designed to help brands like yours streamline everything from orders and analytics to marketing and customer relationships. We are currently inviting a handful of select brands to join our beta programme — completely free, no credit card needed.",
        "",
        "Would you be open to a quick chat about it? No pressure at all — I just think [Brand Name] would be a perfect fit, and I would love to show you what we have built.",
        "",
        "— [Your Name], Valtriox",
        "valtriox.com",
      ],
      "Channel: Instagram DM | Timing: First contact | Goal: Earn response and interest"
    ),

    heading2("Script 5.2: Follow-Up Instagram DM"),
    bodyPara("If the prospect has not responded after 3 to 4 days, this follow-up adds value by mentioning a specific feature that is relevant to their brand type."),
    emptyPara(40),
    scriptBox(
      "Instagram DM — Follow-Up with Value Proposition",
      [
        "Hi [Owner Name], just floating this back to the top of your inbox! 😊",
        "",
        "I know running [Brand Name] keeps you incredibly busy, so I wanted to share something specific that I think would resonate with you.",
        "",
        "One thing our beta partners in the [fashion/lifestyle/food/etc.] space are finding especially valuable is our Marketing Hub — it lets you plan campaigns, schedule social media posts, manage influencer relationships, and track ad performance all from one place. Several brands told us it replaced multiple tools they were paying for separately.",
        "",
        "We also have an AI insights engine that analyses your sales patterns and customer behaviour to suggest optimisations you might not have considered. It is like having a data analyst on the team.",
        "",
        "The beta is completely free with no credit card — genuinely. I just want to see if it would be a good fit for [Brand Name].",
        "",
        "Happy to send more details or set up a quick call. Whatever works for you!",
        "",
        "— [Your Name]",
        "valtriox.com",
      ],
      "Channel: Instagram DM | Timing: 3-4 days after initial | Goal: Feature-specific value and response"
    ),

    // ════════════════════════════════════════════
    // CHAPTER 6: OBJECTION HANDLING
    // ════════════════════════════════════════════
    heading1("Chapter 6: Objection Handling"),
    emptyPara(60),
    bodyPara("Objections are a natural and valuable part of the sales conversation. They indicate that the prospect is engaged enough to express concerns, which is significantly better than silence. The key to effective objection handling is to acknowledge the concern genuinely, provide a specific and truthful response, and redirect the conversation toward the value opportunity. Never be dismissive or overly aggressive — instead, demonstrate understanding and offer a path forward that addresses their specific hesitation. Below are the most common objections encountered during Valtriox's beta outreach, along with tested response frameworks."),

    heading2("Common Objections and Responses"),
    emptyPara(40),

    objectionBox(
      "We already use a tool for this",
      [
        "Response:",
        "",
        "That is great to hear — it means you already recognise the value of having dedicated tools to manage your brand. Most of our beta partners were using a combination of two, three, or even four separate platforms before Valtriox. What they found was that while each tool served its individual purpose, the lack of integration between them created data silos, duplicated effort, and blind spots in their operations.",
        "",
        "Valtriox was specifically designed to consolidate those fragmented workflows. Rather than replacing your existing tools one-for-one, it creates a unified operational layer where orders, analytics, marketing, team management, and customer relationships all flow together seamlessly. Many of our beta partners discovered that Valtriox actually replaced multiple subscriptions while providing capabilities that none of their individual tools offered — particularly the AI-powered insights and the integrated marketing hub.",
        "",
        "I am not suggesting you switch immediately. The beta is a risk-free opportunity to see whether the consolidated approach delivers meaningful improvements for [Brand Name]. There is no cost, no commitment, and no disruption to your current setup. Would you be open to exploring that?",
      ]
    ),

    emptyPara(80),

    objectionBox(
      "We don't have time to try another platform",
      [
        "Response:",
        "",
        "I completely understand, and I respect your time enormously. Running [Brand Name] is demanding, and adding something new to your plate is the last thing I want to do without clear justification.",
        "",
        "Here is what I would suggest: our onboarding process is designed to be completed in under thirty minutes. You create your account, upload your brand details, and immediately see value in the dashboard — no lengthy setup, no configuration marathons, no training required. The interface is intuitive by design, and our team is available to guide you through each step personally.",
        "",
        "Think of it this way: if Valtriox saves you even thirty minutes per week by eliminating the need to switch between multiple tools, the initial setup time pays for itself within the first week. And if it does not deliver that value, you have lost nothing — the beta is entirely free, and you are under no obligation to continue.",
        "",
        "Could I perhaps set up your account and have our onboarding specialist walk you through just the most relevant module for your current priorities? That way, you can evaluate value without a significant time investment.",
      ]
    ),

    emptyPara(80),

    objectionBox(
      "Is this free? What's the catch?",
      [
        "Response:",
        "",
        "That is a fair and important question, and I appreciate you asking directly. The answer is straightforward: yes, the beta programme is completely free. There is no credit card required at any point, no automatic billing when the beta concludes, and no hidden charges. When you sign up, you receive unrestricted access to every feature in Valtriox — the same capabilities that will be available in the premium subscription tiers.",
        "",
        "The reason we offer this is simple: we are a new platform, and we need real brand owners using Valtriox in real business environments to refine the product. Your feedback, your workflows, and your pain points are invaluable to us. In exchange for your participation and honest feedback, we provide the platform at no cost during the beta period. It is a genuine partnership — you help us build a better product, and we give you a powerful tool at no financial risk.",
        "",
        "When the beta concludes, you will have the option to continue at a preferred rate as an early adopter, or you can walk away with no obligation whatsoever. There is no catch — just a fair exchange of value between us.",
      ]
    ),

    emptyPara(80),

    objectionBox(
      "We're a small brand, we don't need this",
      [
        "Response:",
        "",
        "Actually, small and growing brands are often the ones who benefit most from Valtriox. Here is why: when you are a smaller operation, every team member wears multiple hats, and efficiency is not a luxury — it is a necessity. Juggling orders, marketing, customer follow-ups, and team coordination across multiple tools consumes time and resources that could be reinvested in growth.",
        "",
        "Valtriox was built with brands of all sizes in mind, and we have specifically designed the platform to scale with you. A brand with five orders per day uses the same streamlined workflows as a brand with five hundred. The difference is that the smaller brand gains proportionally more — because consolidating your operations into one platform means fewer tool subscriptions to manage, less context-switching, and clearer visibility into your entire business at a glance.",
        "",
        "Some of our most enthusiastic beta partners are brands with small teams who previously managed everything manually through spreadsheets and basic tools. They tell us that Valtriox gave them the organisational backbone they needed to grow confidently. The beta is free, so there is no financial barrier — would you be willing to explore whether it could help [Brand Name] operate more efficiently?",
      ]
    ),

    emptyPara(80),

    objectionBox(
      "Can I try it first before committing?",
      [
        "Response:",
        "",
        "Absolutely — that is the entire point of the beta programme. We actively encourage you to try Valtriox thoroughly before making any decisions. In fact, we do not even accept payments during the beta period, so committing financially is not something you need to consider right now.",
        "",
        "When you sign up, you receive full, unrestricted access to every module and feature. There are no gated sections, no premium-only limitations, and no artificial constraints. You can use Valtriox exactly as you would if you were a paying subscriber — manage real orders, run real campaigns, track real analytics, and collaborate with your actual team. The only thing we ask in return is your candid feedback about the experience.",
        "",
        "I can activate your account right now, and you will be exploring the platform within minutes. There is no commitment beyond your willingness to give it an honest try. Shall I go ahead?",
      ]
    ),

    emptyPara(80),

    objectionBox(
      "I'll think about it",
      [
        "Response:",
        "",
        "Of course — I would never want you to make a decision without being fully comfortable. Taking time to evaluate is the hallmark of a thoughtful business leader, and I respect that approach.",
        "",
        "To make your consideration as easy as possible, may I suggest a practical approach? Rather than committing to a full evaluation, you could start with just one module — whichever area of [Brand Name]'s operations you find most time-consuming or challenging right now. For example, if order management is your biggest pain point, spend just fifteen minutes exploring how Valtriox handles it. If marketing campaign planning is where you see the most potential, start there.",
        "",
        "This way, you can evaluate Valtriox based on real experience with real data from your own business, rather than a hypothetical assessment. And since the beta is free with no time pressure, you can take as long as you need.",
        "",
        "I will follow up in about a week to see if any questions have come to mind. In the meantime, your beta spot remains reserved, and I am available anytime if you would like to chat or get started. Sound fair?",
      ]
    ),

    // ════════════════════════════════════════════
    // CHAPTER 7: TRIAL ACTIVATION & ONBOARDING
    // ════════════════════════════════════════════
    heading1("Chapter 7: Trial Activation and Onboarding"),
    emptyPara(60),
    bodyPara("The moment a prospect agrees to try Valtriox marks the transition from outreach to onboarding. This phase is critical — the first few days of a user's experience will determine whether they become an active, engaged beta partner or drift into inactivity. Every touchpoint during onboarding should be proactive, helpful, and focused on helping the user discover value quickly. The scripts below cover the complete onboarding journey, from account confirmation through trial conversion."),

    heading2("Script 7.1: Beta Account Confirmation"),
    bodyPara("Send this immediately after activating the prospect's account to confirm their beta status and set clear expectations."),
    emptyPara(40),
    scriptBox(
      "Subject: Your Valtriox Beta Account Is Ready — Welcome, [Brand Name]!",
      [
        "Dear [Owner Name],",
        "",
        "I am delighted to confirm that your beta account for Valtriox has been successfully activated. On behalf of the entire Valtriox team, welcome aboard! We are genuinely excited to have [Brand Name] as part of our founding beta cohort.",
        "",
        "Your login credentials have been sent to [Email Address]. Please sign in at valtriox.com using the credentials provided. If you have not received the login email, please check your spam folder or let me know and I will resend it immediately.",
        "",
        "Here is what to expect over the coming days: your account includes unrestricted access to every Valtriox module, including order management, AI-powered insights, team collaboration, marketing hub, CRM, and all supporting features. A member of our onboarding team will be in touch within the next twenty-four hours to guide you through the initial setup, though you are welcome to begin exploring independently at any time.",
        "",
        "During the beta period, we encourage you to use Valtriox as you would in a production environment — add your real products, process real orders, create marketing campaigns, and invite your team. The more authentically you use the platform, the more valuable your feedback will be, and the more clearly you will see the operational improvements Valtriox can deliver.",
        "",
        "Remember: this is entirely free during the beta — no credit card, no charges, no commitments. We are here to support you every step of the way.",
        "",
        "Welcome to Valtriox. Let us Command Your Brand Universe together.",
        "",
        "Warm regards,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: Email | Timing: Immediately after account activation | Goal: Confirm and set expectations"
    ),

    heading2("Script 7.2: Welcome Message with Quick-Start Tips"),
    bodyPara("Send this as a follow-up to the confirmation, providing actionable first steps to help the user find immediate value."),
    emptyPara(40),
    scriptBox(
      "WhatsApp / Email — Quick-Start Tips for New Beta Partners",
      [
        "Hi [Owner Name]! 👋",
        "",
        "Now that your Valtriox beta account is live, here are three quick-start tips to help you find value right away:",
        "",
        "1. Complete Your Brand Profile — Head to Settings and add your brand logo, business details, product categories, and team member details. A complete profile ensures that all modules display accurate, branded information from the start.",
        "",
        "2. Explore the Dashboard — Your home dashboard gives you an at-a-glance view of key metrics: revenue trends, recent orders, customer activity, and AI-powered insights. Take five minutes to review the widgets and customise your layout.",
        "",
        "3. Try One Real Workflow — The fastest way to experience Valtriox's value is to process one real task through the platform. Process a customer order, create a task for your team, or draft a marketing campaign. Seeing your own data in the platform makes the benefits tangible immediately.",
        "",
        "If you hit any questions or need guidance, I am always a message away. The onboarding team is also available for a live walkthrough at your convenience.",
        "",
        "Let us make this count! 🚀",
        "",
        "— [Your Name], Valtriox",
        "valtriox.com",
      ],
      "Channel: WhatsApp or Email | Timing: Day 1 of trial | Goal: Drive immediate engagement"
    ),

    heading2("Script 7.3: Three-Day Trial Check-In"),
    bodyPara("After three days of trial usage, proactively reach out to check progress, address challenges, and reinforce value."),
    emptyPara(40),
    scriptBox(
      "Subject: How Is Your Valtriox Experience So Far, [Owner Name]?",
      [
        "Dear [Owner Name],",
        "",
        "It has been a few days since [Brand Name] joined the Valtriox beta, and I wanted to personally check in to see how things are going. I hope the platform has been intuitive and that you have had a chance to explore the features most relevant to your operations.",
        "",
        "I would love to hear your initial impressions — both positive and constructive. Our product team reviews all beta partner feedback, and your experience directly influences our development priorities. Specifically, I am curious about the following: have you had a chance to explore the module most relevant to your workflow? Did you encounter any friction during setup or navigation? Is there a particular feature or capability that you were hoping to find but did not see?",
        "",
        "If you have any questions or would like a guided walkthrough of a specific module, I am happy to arrange a brief call at your convenience. Our goal is to ensure you are extracting maximum value from Valtriox during the beta period.",
        "",
        "Thank you for being a valued beta partner. Your participation is shaping the future of brand management technology.",
        "",
        "Best regards,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: Email | Timing: Day 3 of trial | Goal: Gather feedback and maintain engagement"
    ),

    heading2("Script 7.4: Trial Conversion Script"),
    bodyPara("As the beta period nears its conclusion, this script converts active users into paid subscribers by emphasising the value they have already experienced."),
    emptyPara(40),
    scriptBox(
      "Subject: Your Valtriox Beta Journey — What Comes Next for [Brand Name]",
      [
        "Dear [Owner Name],",
        "",
        "As our beta programme enters its final phase, I wanted to take a moment to reflect on [Brand Name]'s journey with Valtriox and share what comes next.",
        "",
        "Over the past [duration], you have experienced the platform's capabilities in a real business context. From the insights in your analytics dashboard to the efficiency of your order management workflow, Valtriox has been working alongside you to streamline [Brand Name]'s operations. We hope the experience has been as valuable for you as your feedback has been for us.",
        "",
        "As a founding beta partner, you have earned a special position in the Valtriox community. When the beta concludes, we would be honoured to welcome you as a charter subscriber at a preferred rate — a significant discount from our standard pricing, locked in for your first year. This is our way of thanking you for the time, feedback, and confidence you invested in helping us build Valtriox.",
        "",
        "Charter subscribers also receive priority access to new features, a dedicated account manager, and continued input into the product roadmap. There is no obligation to continue, of course, but based on your engagement during the beta, we believe Valtriox has become a meaningful part of [Brand Name]'s operational toolkit.",
        "",
        "I would welcome the opportunity to discuss the charter offer and answer any questions. Could we schedule a brief call this week? Alternatively, the charter subscription details are available in your Valtriox dashboard under the Subscriptions tab.",
        "",
        "Thank you for being a founding member of the Valtriox community. Your brand's success is our mission.",
        "",
        "With gratitude,",
        "[Your Name]",
        "[Your Title], Valtriox",
        "valtriox.com",
      ],
      "Channel: Email | Timing: End of trial period | Goal: Convert to paid subscription"
    ),

    // ════════════════════════════════════════════
    // CHAPTER 8: KEY TALKING POINTS
    // ════════════════════════════════════════════
    heading1("Chapter 8: Key Talking Points"),
    emptyPara(60),
    bodyPara("This chapter consolidates the essential talking points that should underpin every outreach interaction. Whether you are crafting an email, composing a WhatsApp message, or engaging in a live conversation, these points serve as the foundation of your pitch. Internalise them, but always deliver them in your own words and adapted to the specific context of each prospect."),

    heading2("Core Value Propositions"),
    emptyPara(40),
    bodyPara("Valtriox's primary value proposition centres on unification. Brand owners currently manage their operations through a fragmented collection of tools — one platform for orders, another for analytics, a third for marketing, a fourth for team coordination, and perhaps a fifth for customer management. Each tool serves its purpose, but none of them communicate with each other, creating data silos, duplicated effort, and operational blind spots. Valtriox eliminates this fragmentation by bringing all essential brand management functions into a single, integrated platform where data flows seamlessly between modules."),
    emptyPara(40),
    bodyPara("The platform's AI-powered insights engine represents a significant competitive advantage. Rather than simply reporting historical data, Valtriox's AI analyses patterns in revenue, customer behaviour, inventory movement, and market trends to deliver predictive recommendations. This means brand owners receive actionable intelligence — not just dashboards — enabling proactive decision-making that drives measurable growth. Early beta partners have described this capability as transformative, noting that the AI frequently identifies opportunities and risks that manual analysis would miss entirely."),
    emptyPara(40),
    bodyPara("Team collaboration within Valtriox goes beyond simple task management. The platform provides real-time communication channels, attendance tracking, payroll management, and a shared workspace where every team member has role-appropriate access to the information and tools they need. For growing brands where team members often wear multiple hats, this centralised approach eliminates the confusion and miscommunication that arise from scattered tools and informal coordination methods."),
    emptyPara(40),
    bodyPara("The marketing hub consolidates campaign planning, social media management, advertising, flash sales, influencer coordination, and email marketing into one module with unified analytics. Brand owners can plan a campaign, execute it across multiple channels, and measure its impact — all without leaving Valtriox. The integrated calendar ensures nothing falls through the cracks, while the AI-powered performance analytics provide continuous optimisation recommendations."),

    heading2("Competitive Advantages"),
    emptyPara(40),
    bodyPara("Unlike point solutions that address one operational area, Valtriox provides end-to-end brand management. This eliminates the integration complexity, data inconsistency, and cost multiplier that comes with running multiple tools. Competitors typically offer either order management or marketing or analytics — Valtriox delivers all of them in a unified ecosystem where each module enhances the others."),
    emptyPara(40),
    bodyPara("The AI insights engine is not an add-on or premium feature — it is woven into every module. Orders analytics feed into inventory predictions, customer behaviour data informs marketing recommendations, and team performance metrics contribute to operational efficiency scores. This interconnected intelligence is something no single-purpose tool can replicate, and it provides Valtriox users with a level of business awareness that is simply not available elsewhere."),
    emptyPara(40),
    bodyPara("Valtriox is built for brands, not generic businesses. Every feature, workflow, and interface decision has been made with brand owners in mind — from the visual dashboard aesthetics to the terminology used throughout the platform. This brand-first design philosophy means the learning curve is shorter, the experience is more intuitive, and the platform feels like it was built specifically for the user's business rather than adapted from a generic business tool."),

    heading2("Beta Programme Benefits"),
    emptyPara(40),
    bodyPara("Beta partners receive complete, unrestricted access to Valtriox's full feature set at zero cost. No credit card is required at any point during the beta, and there is no automatic transition to paid pricing when the programme concludes. This represents a genuine, risk-free opportunity to evaluate a premium platform with real business data and workflows."),
    emptyPara(40),
    bodyPara("Beyond free access, beta partners gain direct influence over Valtriox's product development. Feedback submitted through the platform, during check-in calls, or via direct communication with the product team is reviewed, prioritised, and implemented in regular updates. Many features in the current platform exist specifically because early beta partners identified them as priorities. This level of input is typically reserved for enterprise clients paying premium fees — Valtriox offers it to its beta partners as a foundational benefit."),
    emptyPara(40),
    bodyPara("Beta partners also receive dedicated onboarding support from the Valtriox team, priority access to new features as they are released, and preferred pricing as charter subscribers when the platform transitions from beta to general availability. The combination of free access, direct product influence, dedicated support, and long-term pricing benefits creates a compelling value proposition that extends well beyond the beta period itself."),

    heading2("Social Proof Elements"),
    emptyPara(40),
    bodyPara("When appropriate during outreach conversations, reference the growing community of beta partners and their positive experiences. Mention that brands across e-commerce, fashion, technology, food and beverage, and services verticals are actively using Valtriox. Note specific, anonymised outcomes such as consolidated tool stacks replacing three or more separate subscriptions, AI-identified revenue opportunities leading to measurable growth, and time savings of several hours per week through streamlined workflows. These elements build credibility and reduce perceived risk, making prospects more comfortable committing to a trial."),
    emptyPara(40),
    bodyPara("Additionally, emphasise Valtriox's professional positioning: the platform is developed by an experienced team with deep expertise in brand management and SaaS development. The platform's visual design reflects premium quality, and its feature set rivals or exceeds tools that charge significant monthly subscriptions. This combination of professional credibility and zero-cost access during the beta creates a compelling narrative that resonates with discerning brand owners."),
  );

  return {
    properties: {
      page: {
        size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
        margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(1) },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: IG1.accent, space: 4 },
            },
            children: [
              new TextRun({ text: "Valtriox Brand Outreach Guide", font: FONTS.accent, size: 16, color: "AAAAAA", italics: true }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: IG1.accent, space: 4 },
            },
            children: [
              new TextRun({ text: "Command Your Brand Universe  |  ", font: FONTS.accent, size: 16, color: "AAAAAA", italics: true }),
              new TextRun({ text: "valtriox.com  |  Page ", font: FONTS.accent, size: 16, color: "AAAAAA", italics: true }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONTS.accent, size: 16, color: IG1.accent }),
            ],
          }),
        ],
      }),
    },
    children,
  };
}

// ───────────────────────────────────────────────
// MAIN — BUILD DOCUMENT
// ───────────────────────────────────────────────
async function main() {
  console.log("Generating Valtriox Brand Outreach Guide...");

  const doc = new Document({
    creator: "Valtriox Platform Team",
    title: "Valtriox Brand Outreach Guide",
    description: "Complete Scripts for Beta Partner Acquisition",
    styles: {
      default: {
        document: {
          run: { font: FONTS.body, size: 22, color: IG1.bg },
          paragraph: { spacing: { line: 312, lineRule: LineRuleType.AUTO } },
        },
        heading1: {
          run: {
            font: FONTS.heading,
            size: 36,
            bold: true,
            color: IG1.headerText,
          },
          paragraph: {
            spacing: { before: 360, after: 200, line: 312 },
            shading: { type: ShadingType.CLEAR, fill: IG1.headerBg },
          },
        },
        heading2: {
          run: {
            font: FONTS.heading,
            size: 28,
            bold: true,
            color: IG1.accent,
          },
          paragraph: {
            spacing: { before: 280, after: 160, line: 312 },
          },
        },
        heading3: {
          run: {
            font: FONTS.heading,
            size: 24,
            bold: true,
            color: IG1.bg,
          },
          paragraph: {
            spacing: { before: 200, after: 120, line: 312 },
          },
        },
      },
    },
    numbering: { config: [] },
    sections: [
      buildCoverSection(),
      buildTOCSection(),
      buildBodySection(),
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = "/home/z/my-project/download/Valtriox_Brand_Outreach_Guide.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document saved to: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error("Error generating document:", err);
  process.exit(1);
});
