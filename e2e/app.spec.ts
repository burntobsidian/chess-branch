import { test, expect } from "@playwright/test";
test("imports, persists, practices and analyzes on one screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "＋ New opening" })).toBeEnabled();
  await page.getByRole("button", { name: "Try an Italian game" }).click();
  await expect(
    page.locator(".opening-title").filter({ hasText: "Italian · sample" }),
  ).toBeVisible();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".opening-title").filter({ hasText: "Italian · sample" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "♟ Black", exact: true }).click();
  await expect(page.getByText("Recall the line")).toBeVisible();
  await page.getByRole("button", { name: "Reveal move", exact: true }).click();
  await expect(page.getByRole("status", { name: "Practice feedback" })).toContainText(
    "Saved move: e5",
  );
  await page.getByRole("button", { name: "Stop practice", exact: true }).click();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.locator(".candidate").first()).toBeVisible({ timeout: 30000 });
  await page.locator(".candidate").first().click();
  await page.getByLabel("Name this variation").fill("Engine extension");
  await page.getByRole("button", { name: "Save variation", exact: true }).click();
  await expect(page.getByRole("treeitem", { name: "Engine extension" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Branch home" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("plays a black response on the board and exports completed practice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Paste or import moves", exact: true }).click();
  await page.getByLabel("PGN or move notation").fill("1. e4 e5");
  await page.getByRole("button", { name: "Import lines", exact: true }).click();
  await page.getByRole("button", { name: "♟ Black", exact: true }).click();
  await page.locator('[data-square="e7"]').click();
  await page.locator('[data-square="e5"]').click();
  await expect(page.getByRole("status", { name: "Practice feedback" })).toContainText(
    "Line complete",
  );
  await page.getByRole("button", { name: "Explore this line", exact: true }).click();
  await page.getByText("Files", { exact: false }).first().click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export practiced lines", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("branch-practice.pgn");
});

test("Files import reveals the editor, groups branches, and renames inline", async ({ page }) => {
  await page.goto("/");
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await page.locator(".file-menu summary").click();
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page.getByLabel("PGN or move notation")).toBeFocused();
  await expect(page.locator(".file-menu")).not.toHaveAttribute("open", "");
  await page.getByLabel("PGN or move notation").fill('[Event "King pawn"]\n1. e4 e5 (1... c5)');
  await page.getByRole("button", { name: "Import lines", exact: true }).click();
  await expect(page.locator(".opening-title")).toHaveCount(1);
  await expect(page.locator(".variation-tree .line")).toHaveCount(2);
  await page.getByRole("button", { name: "Rename variation", exact: true }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Open game");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.locator(".variation-tree .line").filter({ hasText: "Open game" }),
  ).toBeVisible();
  expect(dialogs).toBe(0);
  await page.getByLabel("Practice", { exact: true }).selectOption("opening");
  await page.getByRole("button", { name: "♟ Black", exact: true }).click();
  await expect(page.getByText("Variation 1 of 2", { exact: true })).toBeVisible();
  await page.locator('[data-square="e7"]').click();
  await page.locator('[data-square="e5"]').click();
  await page.getByRole("button", { name: "Next variation", exact: true }).click();
  await expect(page.getByText("Variation 2 of 2", { exact: true })).toBeVisible();
  await page.locator('[data-square="c7"]').click();
  await page.locator('[data-square="c5"]').click();
  await expect(page.getByRole("button", { name: "Practice again", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Explore this line", exact: true }).click();
  await page.locator(".variation-tree .line").filter({ hasText: "Open game" }).click();
  await expect(page.getByLabel("Practice", { exact: true })).toHaveValue("line");
  await page.getByRole("button", { name: "♟ Black", exact: true }).click();
  await expect(page.getByText("Selected variation", { exact: true })).toBeVisible();
});

test("previews and reverses separation of an already saved mixed opening", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Paste or import moves", exact: true }).click();
  await page
    .getByLabel("PGN or move notation")
    .fill('[Event "Italian"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4');
  await page.getByRole("button", { name: "Import lines", exact: true }).click();
  await page.getByRole("button", { name: "Paste or import moves", exact: true }).click();
  await page.getByLabel("Add to", { exact: true }).selectOption({ label: "Italian" });
  await page
    .getByLabel("PGN or move notation")
    .fill('[Event "Ruy Lopez"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5');
  await page.getByRole("button", { name: "Import lines", exact: true }).click();
  await expect(page.locator(".opening-title")).toHaveCount(1);
  await page.getByRole("button", { name: "Separate mixed openings…", exact: true }).click();
  await expect(page.getByRole("region", { name: "Separate mixed openings" })).toContainText(
    "Ruy Lopez",
  );
  await expect(page.locator(".opening-title")).toHaveCount(1);
  await page.getByRole("button", { name: "Apply separation", exact: true }).click();
  await expect(page.locator(".opening-title")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo separation", exact: true }).click();
  await expect(page.locator(".opening-title")).toHaveCount(1);
  await page.getByRole("button", { name: "Separate mixed openings…", exact: true }).click();
  await page.getByRole("button", { name: "Apply separation", exact: true }).click();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(page.locator(".opening-title")).toHaveCount(2);
});

test("explorer expands independently, keeps folders open and supports keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Paste or import moves", exact: true }).click();
  await page
    .getByLabel("PGN or move notation")
    .fill('[Event "Italian"]\n1. e4 e5 (1... c5) *\n\n[Event "Queen pawn"]\n1. d4 d5 *');
  await page.getByRole("button", { name: "Import lines", exact: true }).click();
  const folders = page.locator(".opening-title");
  const before = await page.locator(".moves").innerText();
  await page.getByRole("button", { name: "Expand Queen pawn", exact: true }).click();
  await expect(folders.filter({ hasText: "Italian" })).toHaveAttribute("aria-expanded", "true");
  await expect(folders.filter({ hasText: "Queen pawn" })).toHaveAttribute("aria-expanded", "true");
  expect(await page.locator(".moves").innerText()).toBe(before);
  await page.getByRole("button", { name: "Collapse Italian", exact: true }).click();
  expect(await page.locator(".moves").innerText()).toBe(before);
  await expect(folders.filter({ hasText: "Italian" })).toHaveAttribute("aria-expanded", "false");
  const italian = folders.filter({ hasText: "Italian" });
  await italian.focus();
  await page.keyboard.press("ArrowRight");
  await expect(italian).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".variation-tree .line").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("treeitem", { name: "Variation 1", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Practice", { exact: true })).toHaveValue("line");
  await expect(page.getByRole("treeitem", { name: "Variation 1", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(italian).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Practice", { exact: true })).toHaveValue("opening");
  await expect(italian).toHaveAttribute("aria-selected", "true");
  await expect(folders.filter({ hasText: "Queen pawn" })).toHaveAttribute("aria-expanded", "true");
});

test("workspace begins directly below the header", async ({ page }) => {
  await page.goto("/");
  const header = await page.locator("header").boundingBox();
  const board = await page.locator(".board-panel").boundingBox();
  expect(header).not.toBeNull();
  expect(board).not.toBeNull();
  expect(board!.y - (header!.y + header!.height)).toBeLessThanOrEqual(32);
  await expect(page.locator(".intro")).toHaveCount(0);
});
