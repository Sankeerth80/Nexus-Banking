import { expect, test, type Page } from "@playwright/test";

const responsiveViewports = [
  { name: "320px", width: 320, height: 800 },
  { name: "375px", width: 375, height: 812 },
  { name: "768px", width: 768, height: 900 },
  { name: "1024px", width: 1024, height: 900 },
  { name: "1440px", width: 1440, height: 1000 },
  { name: "1920px", width: 1920, height: 1080 },
] as const;

const pendingKycRequest = {
  id: "kyc-001",
  customerId: "customer-001",
  idType: "PAN",
  idNumber: "ABCDE1234F",
  documentStatus: "PENDING",
  riskStatus: "PENDING",
  complianceStatus: "PENDING",
  branchStatus: "PENDING",
  createdAt: "2026-06-19T00:00:00.000Z",
  customer: {
    id: "customer-001",
    fullName: "Sankeerth Varma",
    email: "customer@nexus.test",
    phone: "+919876543210",
    status: "KYC_REVIEW",
  },
};

const corsHeaders = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-origin": "http://127.0.0.1:3200",
};

async function fulfillJson(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;

    return Math.ceil(root.scrollWidth - root.clientWidth);
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function mockUnauthenticatedSession(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await fulfillJson(route, { message: "Unauthenticated" }, 401);
      return;
    }

    await route.continue();
  });
}

async function mockAuthenticatedAdminSession(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await fulfillJson(route, {
        userId: "admin-001",
        email: "admin@gmail.com",
        role: "KYC_OFFICER",
      });
      return;
    }

    if (path.endsWith("/kyc/pending")) {
      await fulfillJson(route, [pendingKycRequest]);
      return;
    }

    if (!["fetch", "xhr"].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    await fulfillJson(route, {});
  });
}

test("renders admin portal login", async ({ page }) => {
  const relevantConsoleErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Hydration failed|Encountered a script tag/.test(message.text())
    ) {
      relevantConsoleErrors.push(message.text());
    }
  });

  await mockUnauthenticatedSession(page);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Nexus Banking" }),
  ).toBeVisible();
  await expect(page.getByText("Employee Operations Console")).toBeVisible();
  await expect(page.getByText("Employee Sign In")).toBeVisible();
  await expect(page.getByLabel("Work Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign In to Console" }),
  ).toBeVisible();
  expect(relevantConsoleErrors).toEqual([]);
});

for (const viewport of responsiveViewports) {
  test(`admin login is responsive at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await mockUnauthenticatedSession(page);

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Nexus Banking" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

for (const viewport of responsiveViewports) {
  test(`admin shell navigation is responsive at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await mockAuthenticatedAdminSession(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "KYC & Onboarding Operations" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open admin navigation" }).click();
      await expect(
        page.getByRole("navigation", { name: "Admin mobile navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(
        page.getByRole("navigation", { name: "Admin portal navigation" }),
      ).toBeVisible();
    }
  });
}
