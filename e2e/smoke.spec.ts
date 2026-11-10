import { expect, test, type Page } from "@playwright/test";

/** Fail any test that logs a console error/warning or throws in the page. */
/**
 * React's development build records component timings with performance.measure(). When a page is left while a
 * prerendered component is still measuring, it throws "… cannot have a negative time stamp". It's a dev-only
 * React quirk (production builds don't include the timing code), not an app error, so it doesn't fail a test.
 */
const DEV_ONLY_NOISE = /Failed to execute 'measure' on 'Performance': .* cannot have a negative time stamp/;

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    if (!DEV_ONLY_NOISE.test(e.message)) errors.push(`pageerror: ${e.message}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  return errors;
}

const nodes = (page: Page) => page.locator(".react-flow__node");
const edges = (page: Page) => page.locator(".react-flow__edge");
const panel = (page: Page) => page.locator('[role="tabpanel"]').first();
/** Open a palette group (groups are collapsible; opening one that's open is a no-op). */
const category = async (page: Page, name: string) => {
  const toggle = page.getByRole("button", { name: `${name} components`, exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
};

test("every page renders with honest empty states", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Design systems/ })).toBeVisible(); // first visit: landing page
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
  // First visit: the on-call page, with a root-cause question.
  await expect(page.getByText("You are on call")).toBeVisible();
  await page.getByRole("button", { name: /overloaded by repeated reads/ }).click();
  await expect(page.getByText("Correct diagnosis.")).toBeVisible();
  await page.getByRole("button", { name: /Start fixing/ }).click();
  await expect(page.getByText("You are on call")).toBeHidden();
  // The system was run as it is: the run console shows it failing.
  await expect(page.getByText("FAIL", { exact: true }).first()).toBeVisible();

  // Problem pages keep components in a drawer over the canvas.
  await page.getByRole("button", { name: "Add components" }).click();
  await category(page, "Storage");
  await page.getByRole("button", { name: /^Add Redis Cache/ }).click();
  await page.getByRole("button", { name: "Close components" }).click();
  await page.locator(".react-flow__node", { hasText: "Redis Cache" }).locator("p").nth(1).dblclick();
  await page.getByLabel("Cache size").fill("32");
  await page.getByRole("button", { name: "Hide side panel" }).click();
  await page.locator(".react-flow__node", { hasText: "Catalog API" }).locator("p").nth(1).dblclick(); // double-click opens the inspector drawer
  await page.getByLabel("Send traffic to").selectOption({ label: "Redis Cache" });
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(page.getByText("Solved", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: /Submissions/ }).click();
  await expect(page.getByText(/score \d+/).first()).toBeVisible();

  // The on-call page doesn't come back once seen (wait for the draft autosave first).
  await page.waitForTimeout(800);
  await page.reload();
  await expect(nodes(page)).toHaveCount(5);
  await expect(page.getByText("You are on call")).toBeHidden();

  // Move on to the next challenge.
  await page.getByRole("link", { name: /Next: One Server/ }).click();
  await expect(page).toHaveURL(/\/challenges\/single-point-of-failure/);

  await page.goto("/progress");
  await expect(page.getByText("1 / 52")).toBeVisible();
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

  // Every category opens and lists its components.
  for (const c of ["Entry", "Compute", "Messaging", "Databases", "Storage", "AI", "Locks", "Delivery", "Ops", "Custom"]) {
    await category(page, c);
    await expect(page.locator('[aria-label="Component palette"] button[aria-label^="Add "]').first()).toBeVisible();
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
  await expect(page.getByPlaceholder(/Search Kafka/)).toBeVisible();
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
  await expect(page.locator("main li a")).toHaveCount(36);

  await page.getByRole("link", { name: /Shopping App/ }).click();
  await expect(page).toHaveURL(/\/build\/shopping-app/);
  await expect(nodes(page)).toHaveCount(1); // blank canvas: just the users

  await expect(page.getByText("Place orders without overselling stock")).toBeVisible();
  await expect(page.getByText(/Back-of-envelope/i)).toBeVisible();

  // The unchanged reference passes but earns nothing.
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reveal solution" }).click();
  await expect(nodes(page)).toHaveCount(11);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/That's the revealed solution, unchanged/)).toBeVisible();

  // Make it yours (add a third LB replica) and it counts.
  await page.locator(".react-flow__node", { hasText: "Load Balancer" }).locator("p").nth(1).dblclick();
  const replicas = page.getByLabel("Replicas", { exact: true });
  await replicas.fill("3");
  await replicas.press("Enter");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Accepted! Score/)).toBeVisible();
  await page.goto("/build");
  await expect(page.locator("main li a").filter({ has: page.getByRole("heading", { name: "Shopping App", exact: true }) })).toContainText("Solved");
  expect(errors).toEqual([]);
});

test("challenges can reveal their solution", async ({ page }) => {
  await page.goto("/challenges/missing-index");
  await page.getByRole("button", { name: /Look at the system first/ }).click();
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reveal solution" }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
});

test("mock interview: requirements, estimates, twist and a scorecard", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/interview");
  await page.getByRole("link", { name: /Design Pastebin/ }).click();
  await page.getByRole("button", { name: /Start the 45-minute clock/ }).click();
  await page.getByRole("tab", { name: "Requirements" }).click();
  await page.getByLabel("Functional requirements", { exact: true }).fill("Create a paste\nOpen a paste\nDownload raw");
  await page.getByLabel("Non-functional requirements", { exact: true }).fill("6000 rps\np99 under 200 ms\n99.9% uptime");
  await page.getByRole("tab", { name: "Estimates" }).click();
  await page.getByLabel("Peak requests per second").fill("6000");
  await page.getByLabel("Share of reads (%)").fill("90");
  await page.getByRole("button", { name: /bring the twist now/ }).click();
  await expect(page.getByText("Lose any one component").first()).toBeVisible();
  await page.getByRole("button", { name: /Finish interview/ }).click();
  await expect(page.getByText(/Performance:/)).toBeVisible();
  await expect(page.getByText("3 measurable non-functional requirements.")).toBeVisible();
  await page.goto("/interview");
  await expect(page.locator("ol li")).toHaveCount(1);
  expect(errors).toEqual([]);
});
