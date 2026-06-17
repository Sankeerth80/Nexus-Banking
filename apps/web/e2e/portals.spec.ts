import { expect, test } from "@playwright/test";

test("renders user and master admin portals", async ({ page }) => {
  const relevantConsoleErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Hydration failed|Encountered a script tag/.test(message.text())
    ) {
      relevantConsoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nexus Banking" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /User Portal/ })).toBeVisible();
  await expect(page.getByText("Transfer Command Center")).toBeVisible();

  await page.getByRole("tab", { name: /Master Admin/ }).click();

  await expect(page.getByText("Master admin sign in")).toBeVisible();
  await page.getByLabel("Password").fill("Admin@1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Customer Approval Flow")).toBeVisible();
  await expect(page.getByText("Risk And Compliance Queue")).toBeVisible();
  await expect(page.getByText("Security Administrator")).toBeVisible();
  expect(relevantConsoleErrors).toEqual([]);
});
