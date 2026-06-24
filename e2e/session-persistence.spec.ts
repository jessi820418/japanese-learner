import { test, expect } from "@playwright/test";

const SESSION_KEY = "jp-learner:active-session";

test.describe("Study session persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("flipping then reloading keeps the same card, still flipped", async ({ page }) => {
    // Start a random review so all cards are in the queue.
    await page.getByRole("heading", { name: "Test 詞彙" }).click();
    await page.getByText("隨機複習（全部卡片）").click();
    await expect(page).toHaveURL(/\/study\/test-vocab\/session$/);

    const card = page.locator(".perspective");
    await expect(card).toBeVisible();

    // Capture the back-face Chinese meaning before flipping so we can confirm
    // the SAME card is shown after reload (queue order is randomized once).
    await card.click();
    await expect(page.getByRole("button", { name: "記住了" })).toBeVisible();
    const backText = await page.locator(".card-back").innerText();

    // The snapshot should record a flipped card.
    const snapshot = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
    expect(snapshot).toBeTruthy();
    expect(JSON.parse(snapshot!).isFlipped).toBe(true);

    // Reload — simulates refresh / PWA returning from background.
    await page.reload();
    await expect(page).toHaveURL(/\/study\/test-vocab\/session$/);

    // Still flipped (rating buttons visible immediately) and same card content.
    await expect(page.getByRole("button", { name: "記住了" })).toBeVisible();
    const backTextAfter = await page.locator(".card-back").innerText();
    expect(backTextAfter).toBe(backText);
  });

  test("position is preserved across reload", async ({ page }) => {
    await page.getByRole("heading", { name: "Test 詞彙" }).click();
    await page.getByText("隨機複習（全部卡片）").click();

    // Rate the first card to advance to index 1.
    const card = page.locator(".perspective");
    await expect(card).toBeVisible();
    await card.click();
    await page.getByRole("button", { name: "記住了" }).click();
    await page.waitForTimeout(300);

    const indexBefore = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key)!).currentIndex;
    }, SESSION_KEY);
    expect(indexBefore).toBe(1);

    await page.reload();
    await expect(page).toHaveURL(/\/study\/test-vocab\/session$/);

    const indexAfter = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key)!).currentIndex;
    }, SESSION_KEY);
    expect(indexAfter).toBe(1);
  });

  test("snapshot is cleared when the session completes", async ({ page }) => {
    await page.getByRole("heading", { name: "Test 詞彙" }).click();
    await page.getByText("隨機複習（全部卡片）").click();

    // Complete all 3 cards.
    for (let i = 0; i < 3; i++) {
      const card = page.locator(".perspective");
      await expect(card).toBeVisible({ timeout: 5000 });
      await card.click();
      await page.getByRole("button", { name: "記住了" }).click();
      await page.waitForTimeout(300);
    }

    await expect(page.getByText("學習完成！")).toBeVisible({ timeout: 5000 });
    const snapshot = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
    expect(snapshot).toBeNull();
  });

  test("home page offers to resume an unfinished session", async ({ page }) => {
    await page.getByRole("heading", { name: "Test 詞彙" }).click();
    await page.getByText("隨機複習（全部卡片）").click();

    // Flip one card so a snapshot exists, then go home.
    const card = page.locator(".perspective");
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForTimeout(200);

    await page.goto("/");
    const resume = page.getByRole("button", { name: /繼續上次複習/ });
    await expect(resume).toBeVisible();

    await resume.click();
    await expect(page).toHaveURL(/\/study\/test-vocab\/session$/);
    await expect(page.locator(".perspective")).toBeVisible();
  });
});
