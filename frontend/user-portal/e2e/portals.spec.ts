import { expect, test, type Page } from "@playwright/test";

const responsiveViewports = [
  { name: "320px", width: 320, height: 800 },
  { name: "375px", width: 375, height: 812 },
  { name: "768px", width: 768, height: 900 },
  { name: "1024px", width: 1024, height: 900 },
  { name: "1440px", width: 1440, height: 1000 },
  { name: "1920px", width: 1920, height: 1080 },
] as const;

const customerAccount = {
  id: "acct-primary",
  accountNumber: "NXB00000001",
  type: "SAVINGS",
  balance: 250000,
  currency: "INR",
  interestRate: 4.5,
  status: "ACTIVE",
  ifsc: "NEXU0001",
  branchCode: "NXB001",
};

const corsHeaders = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-origin": "http://127.0.0.1:3000",
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
  const overflowReport = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const className =
          element instanceof HTMLElement ? element.className : "";
        const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";

        return {
          tagName: element.tagName.toLowerCase(),
          className: String(className).slice(0, 160),
          text: text.slice(0, 80),
          left: Math.floor(rect.left),
          right: Math.ceil(rect.right),
          width: Math.ceil(rect.width),
        };
      })
      .filter(
        (element) => element.right > root.clientWidth || element.left < 0,
      )
      .sort((a, b) => b.right - a.right)
      .slice(0, 5);

    return {
      overflow: Math.ceil(root.scrollWidth - root.clientWidth),
      offenders,
    };
  });

  expect(
    overflowReport.overflow,
    JSON.stringify(overflowReport.offenders, null, 2),
  ).toBeLessThanOrEqual(2);
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

async function mockAuthenticatedCustomerSession(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await fulfillJson(route, {
        userId: "customer-001",
        email: "customer@nexus.test",
        role: "CUSTOMER",
      });
      return;
    }

    if (path.endsWith("/kyc/status")) {
      await fulfillJson(route, {
        status: "APPROVED",
        emailVerified: true,
        accounts: [customerAccount],
        kycRequest: {
          customer: {
            fullName: "Sankeerth Varma",
            email: "customer@nexus.test",
          },
        },
      });
      return;
    }

    if (path.endsWith("/accounts")) {
      await fulfillJson(route, [customerAccount]);
      return;
    }

    if (path.endsWith("/beneficiaries")) {
      await fulfillJson(route, [
        {
          id: "beneficiary-001",
          nickname: "Family Savings",
          accountNumber: "NXB00000999",
          bankName: "Nexus Simulation Bank",
          ifsc: "NEXU0002",
          active: true,
          verified: true,
          createdAt: "2026-06-19T00:00:00.000Z",
        },
      ]);
      return;
    }

    if (path.endsWith("/transfers/history")) {
      await fulfillJson(route, [
        {
          id: "transfer-001",
          reference: "NXB-REF-001",
          type: "IMPS_SIMULATION",
          amount: "1250",
          status: "COMPLETED",
          recipientDetails: "Family Savings",
          createdAt: "2026-06-19T00:00:00.000Z",
          sourceAccount: { accountNumber: "NXB00000001" },
        },
      ]);
      return;
    }

    if (!["fetch", "xhr"].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    await fulfillJson(route, {});
  });
}

test("renders user net banking portal", async ({ page }) => {
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
  await expect(page.getByText("Secure Customer Portal")).toBeVisible();
  await expect(page.getByText("Enter your email and password")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  expect(relevantConsoleErrors).toEqual([]);
});

for (const viewport of responsiveViewports) {
  test(`customer login is responsive at ${viewport.name}`, async ({ page }) => {
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
  test(`customer shell navigation is responsive at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await mockAuthenticatedCustomerSession(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Simulated Net Banking Dashboard" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    if (viewport.width < 768) {
      await page
        .getByRole("button", { name: "Open customer navigation" })
        .click();
      await expect(
        page.getByRole("navigation", { name: "Customer mobile navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(
        page.getByRole("navigation", { name: "Customer portal navigation" }),
      ).toBeVisible();
    }
  });
}
