import { expect, test } from "@playwright/test";

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

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthenticated" }),
    });
  });

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
