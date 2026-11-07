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
const category = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Component categories" }).getByRole("button", { name, exact: true }).click();

test("every page renders with honest empty states", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByText(/Start here/)).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("No progress yet")).toBeVisible();
  await page.goto("/challenges");
  await expect(page.locator("main li a")).toHaveCount(16);
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

  await category(page, "Storage");
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

  await category(page, "Storage");
  await page.getByRole("button", { name: /^Add Redis Cache/ }).click();
  await page.getByLabel("Cache size").fill("32");
  await page.locator(".react-flow__node", { hasText: "Catalog API" }).click();
  await page.getByLabel("Send traffic to").selectOption({ label: "Redis Cache" });
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: /Run simulation/ }).click();

  await expect(page.getByText("How to think about it")).toBeVisible(); // explanation opens on first pass
  await page.keyboard.press("Escape");
  await expect(panel(page)).toContainText("Passed");
  await expect(page.getByText("Solved", { exact: true }).first()).toBeVisible();

  // Move on to the next challenge.
  await page.getByRole("link", { name: "Next challenge" }).click();
  await expect(page).toHaveURL(/\/challenges\/single-point-of-failure/);

  await page.goto("/progress");
  await expect(page.getByText("1 / 16")).toBeVisible();
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

test("lab: hand-drawn connections and palette search", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/lab");
  await expect(nodes(page)).toHaveCount(4);

  // Search finds named services hidden behind "+ services".
  const search = page.getByPlaceholder(/Search/);
  await search.fill("kafka");
  await page.getByRole("button", { name: /^Add Apache Kafka/ }).click();
  await search.fill("");
  await expect(nodes(page)).toHaveCount(5);
  const before = await edges(page).count();

  // Drag from the App Server's output handle and release on the middle of the Kafka node (not its handle).
  const handle = page.locator(".react-flow__node", { hasText: "App Server" }).locator(".react-flow__handle.source");
  const kafka = page.locator(".react-flow__node", { hasText: "Apache Kafka" });
  const h = (await handle.boundingBox())!;
  const k = (await kafka.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(k.x + k.width * 0.6, k.y + k.height * 0.7, { steps: 12 });
  await page.mouse.up();
  await expect(edges(page)).toHaveCount(before + 1);

  // Dropping onto a client explains why instead of failing silently.
  const client = page.locator(".react-flow__node", { hasText: "Client" }).first();
  const c = (await client.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText(/Clients only send traffic/)).toBeVisible();
  await expect(edges(page)).toHaveCount(before + 1);
  expect(errors).toEqual([]);
});

test("lab: palette categories, logos, custom component and rename", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/lab");
  await expect(nodes(page)).toHaveCount(4);

  // Every category fits without scrolling the tile area.
  for (const c of ["Entry", "Compute", "Messaging", "Databases", "Storage", "AI", "Locks", "Delivery", "Ops", "Custom"]) {
    await category(page, c);
    const scroller = page.locator('[aria-label="Component palette"] .overflow-y-auto').last();
    const fits = await scroller.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    expect(fits, `${c} should fit without scrolling`).toBe(true);
  }

  // Custom component: add it, pick a behavior, rename it on the canvas.
  await category(page, "Custom");
  await page.getByRole("button", { name: /^Add Custom Component/ }).click();
  await expect(nodes(page)).toHaveCount(5);
  await page.getByLabel("Behaves like").selectOption("nosqlDb");
  const custom = page.locator(".react-flow__node", { hasText: "Custom Component" });
  await expect(custom).toContainText("Custom · NoSQL Database");
  await custom.getByText("Custom Component", { exact: true }).dblclick();
  await page.getByRole("textbox", { name: "Component name" }).fill("Ledger Service");
  await page.keyboard.press("Enter");
  await expect(page.locator(".react-flow__node", { hasText: "Ledger Service" })).toBeVisible();

  // Delivery: GitHub → Actions deploys show as dashed "deploy" links and a pipeline report.
  await category(page, "Delivery");
  await page.getByRole("button", { name: /^Add GitHub:/ }).click();
  await page.getByRole("button", { name: /^Add GitHub Actions/ }).click();
  await page.locator(".react-flow__node", { hasText: "GitHub Actions" }).click();
  await page.getByLabel("Send traffic to").selectOption({ label: "App Server" });
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("deploy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(panel(page)).toContainText("Delivery pipeline");
  await expect(panel(page)).toContainText("isn't connected to a CI pipeline");
  expect(errors).toEqual([]);
});

test("lab: hide side panels to widen the canvas", async ({ page }) => {
  await page.goto("/lab");
  const canvas = page.locator(".react-flow");
  const before = (await canvas.boundingBox())!.width;
  await page.getByRole("button", { name: "Hide components panel" }).click();
  await page.getByRole("button", { name: "Hide side panel" }).click();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(before + 500);
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(panel(page)).toContainText("Simulated"); // results reopen the side panel
  await page.getByRole("button", { name: "Show components panel" }).click();
  await expect(page.getByPlaceholder(/Search all/)).toBeVisible();
});

test("lab: import a design file straight from Load", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/lab");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByLabel("Design file").setInputFiles("e2e/fixtures/ai-pipeline-fixed.json");
  await expect(page.getByText('Imported and opened "AI pipeline (fixed)"')).toBeVisible();
  await expect(nodes(page)).toHaveCount(10);
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(panel(page)).toContainText("Healthy");
  await expect(panel(page)).not.toContainText("Idle components");
  expect(errors).toEqual([]);
});

test("build: product problems with requirements and a reference architecture", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: "Design real products from scratch" })).toBeVisible();
  await expect(page.locator("main li a")).toHaveCount(12);

  await page.getByRole("link", { name: /Shopping App/ }).click();
  await expect(page).toHaveURL(/\/build\/shopping-app/);
  await expect(nodes(page)).toHaveCount(1); // blank canvas: just the users

  await page.getByRole("button", { name: /Requirements & hints/ }).click();
  await expect(page.getByText("Place orders without overselling stock")).toBeVisible();
  await expect(page.getByText(/Back-of-envelope/i)).toBeVisible();
  await page.keyboard.press("Escape");

  // The unchanged reference passes but earns nothing.
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reveal solution" }).click();
  await expect(nodes(page)).toHaveCount(11);
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(page.getByText(/That's the revealed solution, unchanged/)).toBeVisible();

  // Make it yours (add a third LB replica) and it counts.
  await page.locator(".react-flow__node", { hasText: "Load Balancer" }).click();
  const replicas = page.getByLabel("Replicas", { exact: true });
  await replicas.fill("3");
  await replicas.press("Enter");
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(page.getByText(/Solved! Score/)).toBeVisible();
  await page.goto("/build");
  await expect(page.locator("main li a", { hasText: "Shopping App" })).toContainText("Solved");
  expect(errors).toEqual([]);
});

test("challenges can reveal their solution", async ({ page }) => {
  await page.goto("/challenges/missing-index");
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reveal solution" }).click();
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(panel(page)).toContainText("Passed");
});
