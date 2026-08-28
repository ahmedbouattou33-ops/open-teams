import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const users = {
  admin: { name: "Enterprise Admin", email: `admin-${Date.now()}@openteams.test`, password: "Str0ngPassw0rd!x" },
  alice: { name: "Alice", email: `alice-${Date.now()}@openteams.test`, password: "Str0ngPassw0rd!x" },
  bob: { name: "Bob", email: `bob-${Date.now()}@openteams.test`, password: "Str0ngPassw0rd!x" },
};

async function register(page: Page, user: typeof users.admin) {
  await page.goto(`${BASE}/register`);
  await page.fill("#displayName", user.name);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(`${BASE}/`);
  await expect(page.locator('nav[aria-label="Workspaces"]')).toBeVisible();
}

async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 1440, height: 900 } });
}

test.describe("OpenTeams full multi-user coverage", () => {
  test("public routes render without client runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["/register", "/login"]) {
      await page.goto(`${BASE}${route}`);
      await expect(page.locator("body")).not.toContainText("This page couldn’t load");
    }
    expect(errors.filter((message) => /maximum update depth|invalid hook call|hydration/i.test(message))).toEqual([]);
  });

  test("four isolated contexts and authentication flows", async ({ browser }) => {
    const contexts = await Promise.all([
      newContext(browser), newContext(browser), newContext(browser),
    ]);
    const [admin, alice, bob] = contexts;
    const anonymous = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pages = await Promise.all([admin.newPage(), alice.newPage(), bob.newPage(), anonymous.newPage()]);
    try {
      await register(pages[0], users.admin);
      await register(pages[1], users.alice);
      await register(pages[2], users.bob);
      await pages[3].goto(`${BASE}/login`);
      await expect(pages[3].locator("#email")).toBeVisible();
      for (const page of pages.slice(0, 3)) {
        const token = await page.evaluate(() => JSON.parse(localStorage.getItem("openteams.auth.v1") ?? "{}").state?.accessToken);
        expect(token).toEqual(expect.any(String));
      }
    } finally {
      await Promise.all([...contexts, anonymous].map((context) => context.close()));
    }
  });

  test("admin workspace/channel creation and UI navigation", async ({ page }) => {
    await register(page, users.admin);
    await page.click('[title="Create workspace"]');
    await page.fill("#ws-name", "Enterprise HQ");
    await page.fill("#ws-slug", `enterprise-hq-${Date.now()}`);
    await page.locator("form:has(#ws-name) button[type=submit]").click();
    await expect(page.locator('nav[aria-label="Workspaces"]')).toContainText("Enterprise HQ");
    for (const channel of ["general", "dev-team", "whistleblowing"]) {
      await page.click('[title="Create channel"]');
      await page.fill("#ch-name", channel);
      await page.locator("form:has(#ch-name) button[type=submit]").click();
    }
    await page.click('[title="Enterprise console"]');
    await page.waitForURL("**/enterprise");
    await expect(page.locator('nav[aria-label="Enterprise modules"]')).toBeVisible();
  });

  test("enterprise modules render without client errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await register(page, users.admin);
    await page.goto(`${BASE}/enterprise`);
    for (const label of ["Audit Log & SIEM", "Whistleblowing", "License Tracker", "Backup & Legal Export"]) {
      await page.locator('nav[aria-label="Enterprise modules"] button').filter({ hasText: label }).click();
      await expect(page.locator("main")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("command center quick actions open live drawers and presence", async ({ page }) => {
    await register(page, users.admin);
    await page.getByTitle("Create workspace").click();
    await page.fill("#ws-name", "Dashboard QA");
    await page.fill("#ws-slug", `dashboard-qa-${Date.now()}`);
    await page.locator("form:has(#ws-name) button[type=submit]").click();
    await page.getByTitle("Open workspace dashboard").click();
    await expect(page.getByLabel("Workspace dashboard")).toBeVisible();
    await expect(page.getByText("Quick actions")).toBeVisible();
    await expect(page.getByText("Your status").locator(".." )).toContainText(/ONLINE|OFFLINE/);
    await page.getByRole("button", { name: "Agenda & meetings" }).click();
    await expect(page.getByLabel("Personal agenda and notes")).toBeVisible();
    await page.getByLabel("Close open drawer").click();
    await page.getByTitle("Open workspace dashboard").click();
    await page.getByRole("button", { name: "Work plan" }).click();
    await expect(page.getByLabel("Team work plan")).toBeVisible();
    await page.getByLabel("Close open drawer").click();
    await page.getByTitle("Open workspace dashboard").click();
    await page.getByRole("button", { name: "Secure file vault" }).click();
    await expect(page.getByText("File vault")).toBeVisible();
  });

  test("theme toggle persists and rerenders the app", async ({ page }) => {
    await register(page, users.admin);
    await expect(page.getByRole("button", { name: "Light theme" })).toBeVisible();
    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.evaluate(() => localStorage.getItem("openteams.theme.v1"))).resolves.toBe("light");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.evaluate(() => localStorage.getItem("openteams.theme.v1"))).resolves.toBe("dark");
  });

  test("users directory renders search filters and member actions", async ({ page }) => {
    await register(page, users.admin);
    await page.getByTitle("Create workspace").click();
    await page.fill("#ws-name", "Users QA");
    await page.fill("#ws-slug", `users-qa-${Date.now()}`);
    await page.locator("form:has(#ws-name) button[type=submit]").click();
    await page.goto(`${BASE}/users`);
    await expect(page.getByRole("heading", { name: "All Users" })).toBeVisible();
    await expect(page.getByRole("button", { name: /add new user/i })).toBeVisible();
    await page.getByLabel("Search users").fill("Enterprise");
    await page.getByLabel("Filter by role").selectOption("ADMIN");
    await page.getByLabel("Filter by status").selectOption("ONLINE");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByTitle("Member actions")).toBeVisible();
  });

  test("language switcher persists locale and flips document direction", async ({ page }) => {
    await register(page, users.admin);
    const language = page.getByLabel("Interface language");
    await language.selectOption("fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.evaluate(() => localStorage.getItem("openteams.locale.v1"))).resolves.toBe("fr");
    await expect(page.context().cookies()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: "openteams.locale", value: "fr" })]));
    await language.selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("invalid refresh token clears session and redirects to login", async ({ page }) => {
    await register(page, users.admin);
    await page.evaluate(() => {
      const raw = localStorage.getItem("openteams.auth.v1");
      const parsed = JSON.parse(raw ?? "{}");
      parsed.state = { ...parsed.state, accessToken: "expired-access-token", refreshToken: "invalid-refresh-token" };
      localStorage.setItem("openteams.auth.v1", JSON.stringify(parsed));
    });
    await page.reload();
    await expect(page).toHaveURL(/\/login\?reason=session-expired$/);
    await expect(page.getByRole("alert")).toContainText("Your session expired — please sign in again");
    await expect(page.evaluate(() => localStorage.getItem("openteams.auth.v1"))).resolves.toBeNull();
  });

  test("admin adds Alice as Member and roster updates", async ({ browser }) => {
    const adminContext = await newContext(browser);
    const aliceContext = await newContext(browser);
    const admin = await adminContext.newPage();
    const alice = await aliceContext.newPage();
    const adminUser = { ...users.admin, email: `invite-admin-${Date.now()}@openteams.test` };
    const aliceUser = { ...users.alice, email: `alice-invite-${Date.now()}@openteams.test` };
    try {
      await register(admin, adminUser);
      await admin.getByTitle("Create workspace").click();
      await admin.fill("#ws-name", "Invite QA Workspace");
      await admin.fill("#ws-slug", `invite-qa-${Date.now()}`);
      await admin.locator("form:has(#ws-name) button[type=submit]").click();
      await expect(admin.locator('nav[aria-label="Workspaces"]')).toContainText("Invite QA Workspace");
      await register(alice, aliceUser);
      await admin.getByRole("button", { name: /add member/i }).click();
      await admin.getByLabel(/Email or username/i).fill(aliceUser.email);
      await admin.getByLabel(/Initial role/i).selectOption("MEMBER");
      await admin.getByLabel(/Add existing account directly/i).check();
      await admin.getByRole("button", { name: /^Add member$/i }).click();
      await expect(admin.getByText(/Member added directly/i)).toBeVisible();
      await admin.getByRole("button", { name: /^Members$/i }).click();
      await expect(admin.getByLabel("Team members")).toContainText("Alice");
      await alice.reload();
      await alice.getByRole("button", { name: /^Members$/i }).click();
      await expect(alice.getByLabel("Team members")).toContainText("Alice");
    } finally {
      await adminContext.close();
      await aliceContext.close();
    }
  });

  test("new UI guardrails render without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${BASE}/register`);
    await page.evaluate(() => localStorage.setItem("openteams.auth.v1", JSON.stringify({ state: { user: { id: "ui-qa", email: "ui@example.test", displayName: "UI QA", role: "OWNER" }, accessToken: "test-token", refreshToken: "test-refresh" }, version: 0 })));
    await page.goto(`${BASE}/`);
    await expect(page.getByLabel("Interface language")).toBeVisible();
    await expect(page.getByLabel("Interface language").locator("option")).toHaveCount(3);
    for (const title of ["Bold", "Italic", "Inline code", "Code block", "Bullet list", "Record voice note"]) await expect(page.getByTitle(title)).toBeVisible();
    await page.getByLabel("Interface language").selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(errors.filter((message) => /maximum update depth|invalid hook call|hydration/i.test(message))).toEqual([]);
  });

  test("panic mode purges local session and redirects only Alice context", async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    try {
      await register(alice, users.alice);
      await register(bob, users.bob);
      await alice.keyboard.press("Control+Shift+L");
      await alice.getByRole("button", { name: /lock everything now/i }).click();
      await expect(alice).toHaveURL(/\/login\?locked=1$/);
      const aliceSession = await alice.evaluate(() => localStorage.getItem("openteams.auth.v1"));
      expect(aliceSession).not.toContain("accessToken");
      await expect(bob.locator('nav[aria-label="Workspaces"]')).toBeVisible();
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });
});
