import { expect, test } from "@playwright/test";

test("marketing site core pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan Real Trips" })).toBeVisible();

  await page.goto("/features");
  await expect(page.getByRole("heading", { name: /Discovery, planning/ })).toBeVisible();

  await page.goto("/blog");
  await expect(page.getByText("Introducing Scope")).toBeVisible();
});
