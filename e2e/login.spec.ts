import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL || "fernando@test.com";
const TEST_PASSWORD = process.env.E2E_PASSWORD || "TestPassword123!";

test.describe("Login e navegação básica", () => {
  test("tela de login aparece para usuário não autenticado", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/e-mail/i)).toBeVisible();
  });

  test("login com credenciais corretas acessa o app", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/e-mail/i).fill(TEST_EMAIL);
    await page.getByPlaceholder(/senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/pipeline|interview os/i)).toBeVisible({ timeout: 10000 });
  });

  test("mensagem de erro para credenciais inválidas", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/e-mail/i).fill("wrong@test.com");
    await page.getByPlaceholder(/senha/i).fill("wrong");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/incorretos|inválido/i)).toBeVisible({ timeout: 5000 });
  });

  test("modo magic link exibe campo de email apenas", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/entrar sem senha/i).click();
    await expect(page.getByPlaceholder(/e-mail/i)).toBeVisible();
    await expect(page.getByPlaceholder(/senha/i)).not.toBeVisible();
  });

  test("modo esqueci senha exibe campo de email", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/esqueci/i).click();
    await expect(page.getByText(/recuperação/i)).toBeVisible();
  });
});
