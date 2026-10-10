import { test, expect } from "@playwright/test";

test("replaces verification shell and completes a local field tour without login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your field, in focus." })).toBeVisible();
  await expect(page.getByText("Terrevo is online.")).toHaveCount(0);
  await expect(page.getByText("No login screen.")).toBeVisible();

  await page.getByRole("button", { name: "My tours" }).click();
  await page.getByRole("textbox", { name: "Territory or working area" }).fill("Central Zone");
  await page.getByRole("button", { name: /Start tour/ }).click();
  await expect(page.getByText("Tour started in this local workspace.")).toBeVisible();

  await page.getByRole("button", { name: "Field visits" }).click();
  await page.getByRole("textbox", { name: "Account / HCP display name" }).fill("Example Doctor");
  await page.getByRole("button", { name: /Record check-in/ }).click();
  await expect(page.getByRole("heading", { name: "Visit in progress" })).toBeVisible();
  await page.getByRole("textbox", { name: "Field notes (local only)" }).fill("Test-only visit note");
  await page.getByRole("button", { name: "Save notes" }).click();
  await page.getByRole("button", { name: "Check out" }).click();

  await page.getByRole("button", { name: "My tours" }).click();
  await page.getByRole("button", { name: "Submit tour" }).click();
  await expect(page.getByText("Tour submitted to local activity history.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "My tours" }).click();
  await expect(page.getByText("Central Zone")).toBeVisible();
  await page.getByRole("button", { name: "Field visits" }).click();
  await expect(page.getByText("Test-only visit note")).toBeVisible();
});

test("local workflow never exposes a login form or sends mutation requests", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", request => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) mutations.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your field, in focus." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /password/i })).toHaveCount(0);
  await page.getByRole("button", { name: "My tours" }).click();
  await page.getByRole("textbox", { name: "Territory or working area" }).fill("South Zone");
  await page.getByRole("button", { name: /Start tour/ }).click();
  expect(mutations).toEqual([]);
});
