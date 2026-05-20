import { test, expect, devices } from "@playwright/test";

// Usa o projeto "mobile" do playwright.config.ts (iPhone 12)
// Pode também ser rodado explicitamente: playwright test --project=mobile

test.describe("Mobile UX", () => {
  test.use({ ...devices["iPhone 12"] });

  test("bottom navigation visível no mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    // Bottom nav deve ter 3 botões
    const navBtns = page.locator(".bottom-nav-btn");
    await expect(navBtns).toHaveCount(3);
  });

  test("filtro de stage funcional no mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    await page.getByText("Entrevista").first().click();
    // Apenas processos de interview devem aparecer
    const cards = page.locator(".process-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("toque em card navega para detail", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    await page.locator(".process-card").first().click();
    await expect(page.getByText(/voltar/i)).toBeVisible({ timeout: 3000 });
  });

  test("botão voltar retorna para lista", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    await page.locator(".process-card").first().click();
    await page.getByText(/voltar/i).click();
    await expect(page.locator(".process-card").first()).toBeVisible({ timeout: 3000 });
  });
});
