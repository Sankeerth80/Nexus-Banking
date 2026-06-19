import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const allowedAdvisories = new Map([
  [
    "https://github.com/advisories/GHSA-72gw-mp4g-v24j",
    "Exact-pinned multer dependency in @nestjs/platform-express 11.1.27; npm only offers a force downgrade of Nest packages.",
  ],
  [
    "https://github.com/advisories/GHSA-3p4h-7m6x-2hcm",
    "Exact-pinned multer dependency in @nestjs/platform-express 11.1.27; npm only offers a force downgrade of Nest packages.",
  ],
  [
    "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
    "Exact-pinned postcss dependency in next 16.2.9; npm only offers a force downgrade of Next.",
  ],
  [
    "https://github.com/advisories/GHSA-h67p-54hq-rp68",
    "Exact-pinned js-yaml dependency in @nestjs/swagger 11.4.4; npm only offers a force downgrade of Swagger/Nest.",
  ],
  [
    "https://github.com/advisories/GHSA-92pp-h63x-v22m",
    "Exact-pinned @hono/node-server dependency in Prisma 7.8.0 dev tooling pulled through Prisma client peer resolution.",
  ],
]);

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const npmCliPath =
  process.env.npm_execpath ??
  join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

if (!existsSync(npmCliPath)) {
  console.error(`Unable to locate npm CLI at ${npmCliPath}.`);
  process.exit(1);
}

const audit = spawnSync(
  process.execPath,
  [npmCliPath, "audit", "--omit=dev", "--json"],
  {
    encoding: "utf8",
  },
);

if (audit.error) {
  console.error(`Unable to run npm audit: ${audit.error.message}`);
  process.exit(1);
}

if (!audit.stdout.trim()) {
  console.error(audit.stderr || "npm audit did not return JSON output.");
  process.exit(1);
}

const report = JSON.parse(audit.stdout);
const vulnerabilities = report.vulnerabilities ?? {};

function collectAdvisories(vulnerabilityName, visited = new Set()) {
  if (visited.has(vulnerabilityName)) {
    return [];
  }

  visited.add(vulnerabilityName);

  const vulnerability = vulnerabilities[vulnerabilityName];
  if (!vulnerability) {
    return [];
  }

  return vulnerability.via.flatMap((via) => {
    if (typeof via === "string") {
      return collectAdvisories(via, visited);
    }

    return [
      {
        packageName: vulnerabilityName,
        title: via.title,
        severity: via.severity,
        url: via.url,
      },
    ];
  });
}

const unapprovedFindings = [];
const allowedFindings = new Map();

for (const vulnerabilityName of Object.keys(vulnerabilities)) {
  const advisories = collectAdvisories(vulnerabilityName);

  for (const advisory of advisories) {
    if (severityRank[advisory.severity] < severityRank.high) {
      continue;
    }

    if (allowedAdvisories.has(advisory.url)) {
      allowedFindings.set(advisory.url, advisory);
      continue;
    }

    unapprovedFindings.push(advisory);
  }
}

if (unapprovedFindings.length > 0) {
  console.error("Security audit failed. Unapproved high/critical advisories:");
  for (const finding of unapprovedFindings) {
    console.error(
      `- ${finding.severity.toUpperCase()} ${finding.packageName}: ${finding.title}`,
    );
    console.error(`  ${finding.url}`);
  }
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log("Security audit gate passed.");
console.log(
  `npm audit observed ${counts.total ?? 0} advisories: ${counts.high ?? 0} high, ${counts.moderate ?? 0} moderate.`,
);

if (allowedFindings.size > 0) {
  console.log("Allowed upstream advisories with no non-breaking npm fix:");
  for (const [url, finding] of allowedFindings) {
    console.log(`- ${finding.packageName}: ${finding.title}`);
    console.log(`  ${url}`);
    console.log(`  ${allowedAdvisories.get(url)}`);
  }
}
