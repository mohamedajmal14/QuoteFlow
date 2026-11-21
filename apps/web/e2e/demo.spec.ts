import { expect, test } from "@playwright/test";

test("creates, persists and restores a quote in the browser demo", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /a clearer path/i })).toBeVisible();
  await expect(page.getByText("Interactive portfolio demo")).toBeVisible();
  await expect(page.getByText(/no production backend is connected/i)).toBeVisible();

  await page.getByRole("button", { name: /new quote/i }).click();
  await page.getByLabel("Client", { exact: true }).fill("Andes Foods");
  await page.getByLabel("Main contact", { exact: true }).fill("Elena Ruiz");
  await page.getByLabel("Proposed service", { exact: true }).fill("Ordering portal");
  await page.getByLabel("Quote value (USD)", { exact: true }).fill("7500");
  await page.getByRole("button", { name: "Add to pipeline" }).click();

  await expect(page.getByRole("status")).toContainText("was added to the pipeline");
  await expect(page.getByText("Andes Foods", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Andes Foods", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Restore sample data" }).click();
  await expect(page.getByRole("status")).toContainText("restored to its sample workspace");
  await expect(page.getByText("Andes Foods", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Aurelia Retail", { exact: true }).first()).toBeVisible();
});

test("blocks an empty follow-up date without breaking or persisting invalid data", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Aurelia Retail/ }).first().click();
  const dueDate = page.getByLabel("Due", { exact: true });
  await dueDate.fill("");
  await page.getByRole("button", { name: "Schedule follow-up" }).click();

  await expect(dueDate).toHaveAttribute("required", "");
  await expect(dueDate).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Aurelia Retail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /a clearer path/i })).toBeVisible();
  await expect(page.getByText("Aurelia Retail", { exact: true }).first()).toBeVisible();
});
