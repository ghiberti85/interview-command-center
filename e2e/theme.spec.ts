import { test, expect } from "@playwright/test";

test.describe("Tema dark/light", () => {
  test("tema persiste após reload", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();

    // Pega o tema atual
    const initialBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
    );

    // Toggle do tema
    const themeBtn = page.locator("button[aria-label*=tema]").first();
    await themeBtn.click();

    const newBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
    );

    expect(newBg).not.toBe(initialBg);

    // Reload mantém o tema
    await page.reload();
    await page.getByText(/demonstração/i).click();
    const reloadBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
    );
    expect(reloadBg).toBe(newBg);
  });
});
