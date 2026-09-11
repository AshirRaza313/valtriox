// Replaces hardcoded dashboard/sidebar strings with translation calls.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const replacements = [
  {
    file: "src/components/brandflow/dashboard/ActivityFeed.tsx",
    edits: [
      [">Activity Feed<", '>{t("activityFeed")}<'],
      [">View All <", '>{t("viewAll")} <'],
      [">Create first order<", '>{t("createFirstOrder")}<'],
    ],
  },
  {
    file: "src/components/brandflow/dashboard/DailySummaryWidget.tsx",
    edits: [[">Daily Summary<", '>{t("dailySummary")}<']],
  },
  {
    file: "src/components/brandflow/dashboard/DashboardGrid.tsx",
    edits: [[">Upgrade <", '>{t("upgrade")} <']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/CampaignPerformanceWidget.tsx",
    edits: [[">View All <", '>{t("viewAll")} <']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/CouponAnalyticsWidget.tsx",
    edits: [[">Manage <", '>{t("manage")} <']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/EmailStatsWidget.tsx",
    edits: [[">Start Email Marketing<", '>{t("startEmailMarketing")}<']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/MarketingCalendarWidget.tsx",
    edits: [[">Create Event<", '>{t("createEvent")}<']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/SEOMetricsWidget.tsx",
    edits: [
      [">Details <", '>{t("details")} <'],
      [">Connect Google Search Console<", '>{t("connectGoogleSearchConsole")}<'],
    ],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/SocialAnalyticsWidget.tsx",
    edits: [[">Set Up Social Media<", '>{t("setUpSocialMedia")}<']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/RevenueForecastWidget.tsx",
    edits: [[">Requires at least 30 days of revenue data<", '>{t("revenueForecastRequires")}<']],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/PredictiveAnalyticsWidget.tsx",
    edits: [[">Predictions will appear once enough data is collected<", '>{t("predictiveAnalyticsWillAppear")}<']],
  },
  {
    file: "src/components/brandflow/layout/Sidebar.tsx",
    edits: [
      [">Requires <", '>{t("requires")} <'],
      [">Collapse</span>", '>{t("collapse")}</span>'],
    ],
  },
];

let totalEdits = 0;
for (const { file, edits } of replacements) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.log(`Missing: ${file}`);
    continue;
  }

  let source = fs.readFileSync(full, "utf8");
  let fileEdits = 0;
  for (const [search, replacement] of edits) {
    if (source.includes(search)) {
      source = source.replace(search, replacement);
      fileEdits++;
      totalEdits++;
    }
  }
  fs.writeFileSync(full, source, "utf8");
  console.log(`${file}: ${fileEdits} edits`);
}

console.log(`\nTotal: ${totalEdits} replacements across ${replacements.length} files`);