// Bulk-replace specific hardcoded strings with translation calls.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const replacements = [
  {
    file: "src/components/brandflow/coupons/CouponsPage.tsx",
    edits: [
      [/>(\s*)Create Coupon(\s*)</g, ">{t(\"createCoupon\")}<"],
      [/>(\s*)Create First Coupon(\s*)</g, ">{t(\"createFirstCoupon\")}<"],
    ],
  },
  {
    file: "src/components/brandflow/team/TeamPage.tsx",
    edits: [
      [/>(\s*)Team Management(\s*)</g, ">{t(\"teamManagement\")}<"],
      [/>(\s*)Add Team Member(\s*)</g, ">{t(\"addTeamMember\")}<"],
    ],
  },
  {
    file: "src/components/brandflow/dashboard/widgets/CampaignPerformanceWidget.tsx",
    edits: [[/>(\s*)Create your first campaign(\s*)</g, ">{t(\"createFirstCampaign\")}<"]],
  },
  {
    file: "src/components/brandflow/dashboard/DashboardGrid.tsx",
    edits: [[/>(\s*)Click to upgrade(\s*)</g, ">{t(\"clickToUpgrade\")}<"]],
  },
  {
    file: "src/components/brandflow/layout/Sidebar.tsx",
    edits: [[/>(\s*)Sign Out(\s*)</g, ">{t(\"signOut\")}<"]],
  },
];

let total = 0;
for (const { file, edits } of replacements) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.log(`Missing: ${file}`);
    continue;
  }

  let source = fs.readFileSync(full, "utf8");
  let count = 0;
  for (const [pattern, replacement] of edits) {
    const matches = source.match(pattern);
    if (matches) count += matches.length;
    source = source.replace(pattern, replacement);
  }
  fs.writeFileSync(full, source, "utf8");
  console.log(`${file}: ${count} edits`);
  total += count;
}

console.log(`\nTotal edits: ${total}`);
