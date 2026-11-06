import { expect, test, type Page } from "@playwright/test";

/** Fail any test that logs a console error/warning or throws in the page. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  return errors;
}

const nodes = (page: Page) => page.locator(".react-flow__node");
const edges = (page: Page) => page.locator(".react-flow__edge");
const panel = (page: Page) => page.locator('[role="tabpanel"]').first();

test("every page renders with honest empty states", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByText("Get started")).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("No progress yet")).toBeVisible();
  await page.goto("/challenges");
  await expect(page.locator("main li a")).toHaveCount(7);
  await page.goto("/challenges/does-not-exist");
  await expect(page.getByText("No route to this page")).toBeVisible();
  expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
});

test("lab: build, simulate, save, undo and reload", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/lab");
  await expect(nodes(page)).toHaveCount(4);

  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(panel(page)).toContainText("Simulated");
  await expect(page.locator(".syslab-flow")).toHaveCount(3);

  await page.getByRole("button", { name: /^Add Redis Cache/ }).click();
  await expect(nodes(page)).toHaveCount(5);
  await page.locator(".react-flow__node", { hasText: "App Server" }).click();
  await page.getByLabel("Send traffic to").selectOption({ label: "Redis Cache" });
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(edges(page)).toHaveCount(4);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(edges(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(edges(page)).toHaveCount(4);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByLabel("Name").fill("Smoke design");
  await page.getByRole("dialog").getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText('Saved "Smoke design"')).toBeVisible();

  await page.reload();
  await expect(nodes(page)).toHaveCount(5); // draft autosaved
  expect(errors).toEqual([]);
});

test("challenge: fix the overloaded database and pass", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/challenges/overloaded-database");
  await expect(nodes(page)).toHaveCount(4);
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(panel(page)).toContainText("Not passed yet");

  await page.getByRole("button", { name: /^Add Redis Cache/ }).click();
  await page.getByLabel("Cache size").fill("32");
  await page.locator(".react-flow__node", { hasText: "Catalog API" }).click();
  await page.getByLabel("Send traffic to").selectOption({ label: "Redis Cache" });
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: /Run simulation/ }).click();

  await expect(page.getByText("How to think about it")).toBeVisible(); // explanation opens on first pass
  await page.keyboard.press("Escape");
  await expect(panel(page)).toContainText("Passed");

  await page.goto("/progress");
  await expect(page.getByText("1 / 7")).toBeVisible();
  expect(errors).toEqual([]);
});

test("backup: export from one browser, import into another", async ({ page, browser }) => {
  await page.goto("/lab");
  await expect(nodes(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByLabel("Name").fill("Portable design");
  await page.getByRole("dialog").getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText('Saved "Portable design"')).toBeVisible();

  await page.goto("/progress");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
  const file = await download.path();

  const other = await (await browser.newContext()).newPage();
  await other.goto("/progress");
  await expect(other.getByText("No progress yet")).toBeVisible();
  await other.locator('input[type="file"]').setInputFiles(file);
  await other.getByRole("button", { name: "Merge" }).click();
  await expect(other.getByText("Portable design")).toBeVisible();
});
