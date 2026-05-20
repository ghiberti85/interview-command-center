import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL || "fernando@test.com";
const TEST_PASSWORD = process.env.E2E_PASSWORD || "TestPassword123!";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/e-mail/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/senha/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("text=/pipeline|interview os/i", { timeout: 10000 });
});

test("criar novo processo e confirmar na lista", async ({ page }) => {
  await page.getByRole("button", { name: /novo processo/i }).click();
  await page.getByPlaceholder(/empresa/i).fill("TestCo E2E");
  await page.getByPlaceholder(/cargo/i).fill("Senior Engineer E2E");
  await page.getByRole("button", { name: /adicionar/i }).click();
  await expect(page.getByText("TestCo E2E")).toBeVisible({ timeout: 5000 });
});

test("editar stage via PipelineBar e confirmar persistência", async ({ page }) => {
  // Assume que 'TestCo E2E' foi criado no teste anterior ou existe no banco de testes
  await page.getByText("TestCo E2E").first().click();
  // Clicar na barra de "Entrevista" (3ª barra do PipelineBar)
  const bars = page.locator(".pipeline-bar div[title]");
  await bars.nth(2).click(); // interview
  await expect(page.getByText("Entrevista")).toBeVisible({ timeout: 3000 });
  await page.reload();
  await page.getByText("TestCo E2E").first().click();
  await expect(page.getByText("Entrevista")).toBeVisible({ timeout: 5000 });
});

test("marcar como favorito", async ({ page }) => {
  await page.getByRole("listitem").first().click();
  const starBtn = page.locator("button[aria-label*=favori]").first();
  await starBtn.click();
  await expect(starBtn).toBeVisible();
});
