import { test, expect } from "@playwright/test";

test.describe("Modo demonstração", () => {
  test("banner de demo visível ao entrar no modo demo", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    await expect(page.getByText(/modo demonstração/i)).toBeVisible({ timeout: 3000 });
  });

  test("processos fake são exibidos no modo demo", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    await expect(page.getByText("Nubank")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Spotify")).toBeVisible({ timeout: 3000 });
  });

  test("sair do demo retorna para tela de login", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/demonstração/i).click();
    await page.getByText(/sair/i).first().click();
    await expect(page.getByPlaceholder(/e-mail/i)).toBeVisible({ timeout: 3000 });
  });
});
