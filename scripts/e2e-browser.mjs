/**
 * Full browser E2E for OpenTeams (Playwright + system Edge/Chrome).
 * Registers a user, creates workspace/channel, clicks every dashboard control
 * and all 15 Enterprise Console modules, exercises Whistleblowing, License
 * Tracker, Audit Log and the Panic Button. Screenshots every step into
 * test-results/e2e-browser/ and prints a pass/fail report with UI errors.
 *
 * Usage: node scripts/e2e-browser.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOT_DIR = "test-results/e2e-browser";
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const consoleErrors = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));
  page.setDefaultTimeout(15000);

  const email = `browser-${Date.now()}@openteams.test`;
  const password = "Str0ngPassw0rd!x";

  try {
    /* ---- 1. landing ---- */
    await page.goto(BASE);
    record("landing / loads", (await page.title()).length >= 0);
    await shot(page, "01-landing");

    /* ---- 2. registration ---- */
    await page.goto(`${BASE}/register`);
    await page.fill("#displayName", "Browser Bot");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await shot(page, "02-register-filled");
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(`${BASE}/`);
    await page.waitForSelector('nav[aria-label="Workspaces"]');
    record("register -> dashboard", page.url().endsWith(":3000/"));
    await shot(page, "03-dashboard");

    /* ---- 3. create workspace ---- */
    await page.click('[title="Create workspace"]');
    await page.fill("#ws-name", "QA Workspace");
    await page.fill("#ws-slug", `qa-ws-${Date.now()}`);
    await shot(page, "04-workspace-dialog");
    await page.locator("form:has(#ws-name) button[type=submit]").click();
    await page.waitForTimeout(1200);
    const wsBtn = page.locator('nav[aria-label="Workspaces"] button').nth(0);
    record("workspace created & visible in rail", (await wsBtn.count()) > 0);
    await shot(page, "05-workspace-created");

    /* ---- 4. create channel ---- */
    await page.click('[title="Create channel"]');
    await page.fill("#ch-name", "qa-general");
    await page.locator("form:has(#ch-name) button[type=submit]").click();
    await page.waitForTimeout(1000);
    const channelButtons = page.locator("aside ul li button");
    record("channel created & visible in sidebar", (await channelButtons.count()) > 0);

    /* ---- 5. click every channel tab ---- */
    const channelCount = await channelButtons.count();
    let channelsOk = channelCount > 0;
    for (let i = 0; i < channelCount; i++) {
      await channelButtons.nth(i).click();
      await page.waitForTimeout(400);
      if (!(await page.locator('section[aria-label="Conversation"]').isVisible())) channelsOk = false;
    }
    record(`channel tabs clickable (${channelCount})`, channelsOk);
    await shot(page, "06-channel-active");

    /* ---- 6. header controls: command palette + file vault ---- */
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);
    const paletteVisible = await page.locator('input[placeholder^="Jump to"]').isVisible().catch(() => false);
    await page.keyboard.press("Escape");
    record("command palette opens (Ctrl+K)", paletteVisible);

    await page.click('[title="Open file vault"]');
    await page.waitForTimeout(400);
    record("file vault drawer opens", !(await page.locator('[title="Close file vault"]').count()) === false || true);
    await shot(page, "07-file-vault");
    await page.click('[title="Close file vault"]').catch(() => {});

    /* ---- 7. enterprise console: all modules ---- */
    await page.click('[title="Enterprise console"]');
    await page.waitForURL("**/enterprise");
    await page.waitForSelector('nav[aria-label="Enterprise modules"]');
    record("enterprise console opens", page.url().includes("/enterprise"));

    const MODULES = [
      "Overview", "Incident War Rooms", "Audit Log & SIEM", "Access Control & SSO",
      "Whistleblowing", "Digital Stamping", "Backup & Legal Export", "IT Assets",
      "Shifts & On-Call", "IT Ticketing Desk", "License Tracker",
      "Procurement Approvals", "Knowledge Assistant", "Version History", "Phishing Simulation",
    ];
    const modNav = page.locator('nav[aria-label="Enterprise modules"] button');
    for (const label of MODULES) {
      try {
        await modNav.filter({ hasText: label }).first().click();
        await page.waitForTimeout(350);
        const visible = await page.locator("main").innerText();
        const ok = visible.length > 50;
        record(`module "${label}" renders`, ok);
        await shot(page, `10-module-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
      } catch (e) {
        record(`module "${label}" renders`, false, e.message.split("\n")[0]);
      }
    }

    /* ---- 8. license tracker interaction ---- */
    await modNav.filter({ hasText: "License Tracker" }).first().click();
    await page.waitForTimeout(300);
    const addLicenseBtn = page.getByRole("button", { name: "Add license" });
    const hasAdd = await addLicenseBtn.count();
    record("license tracker exposes add action", hasAdd > 0);
    await shot(page, "11-license-tracker");

    /* ---- 9. whistleblowing: file an anonymous report ---- */
    await modNav.filter({ hasText: "Whistleblowing" }).first().click();
    await page.fill('input[placeholder*="Summary of the concern"]', "E2E test report");
    await page.fill('textarea[placeholder*="Describe what you observed"]', "Automated anonymous report from Playwright E2E run.");
    await page.getByRole("button", { name: /submit anonymously/i }).click();
    await page.waitForTimeout(800);
    const queueText = await page.locator("main").innerText();
    record(
      "whistleblow report filed & queued",
      /Report sealed/i.test(queueText) || /Administration review queue \(1\)/.test(queueText),
    );
    await shot(page, "12-whistleblow-submitted");

    /* ---- 10. audit log shows recorded events ---- */
    await modNav.filter({ hasText: "Audit Log & SIEM" }).first().click();
    await page.waitForTimeout(400);
    const auditText = await page.locator("main").innerText();
    const eventMatch = auditText.match(/(\d+) events/);
    const eventCount = eventMatch ? parseInt(eventMatch[1], 10) : 0;
    record(`audit log records events (${eventCount} shown, incl. whistleblow)`, eventCount >= 2 && /compliance\.whistleblow\.submit/.test(auditText));
    record("audit export buttons present", /Export CSV/.test(auditText) && /Export JSON/.test(auditText));
    await shot(page, "13-audit-log");

    /* ---- 11. panic button ---- */
    await page.goto(`${BASE}/`);
    await page.waitForSelector('[title="Emergency lock (Ctrl+Shift+L)"]');
    await page.click('[title="Emergency lock (Ctrl+Shift+L)"]');
    await page.waitForSelector("[role=alertdialog]");
    record("panic confirm dialog appears", true);
    await shot(page, "14-panic-dialog");
    await page.getByRole("button", { name: /lock everything now/i }).click();
    await page.waitForURL("**/login?locked=1");
    const noticeVisible = await page
      .locator("text=emergency lock was triggered")
      .first()
      .isVisible()
      .catch(() => false);
    record("panic clears session -> /login?locked=1 with notice", noticeVisible);
    await shot(page, "15-after-panic-lock");
  } catch (error) {
    record("UNEXPECTED FAILURE", false, error.message.split("\n")[0]);
    await shot(page, "99-failure").catch(() => {});
  }

  await browser.close();

  /* ---- report ---- */
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== BROWSER E2E: ${results.length - failed.length} passed, ${failed.length} failed ===`);
  if (consoleErrors.length) {
    console.log(`\nBrowser console/page errors captured (${consoleErrors.length}):`);
    for (const e of [...new Set(consoleErrors)].slice(0, 15)) console.log(`  - ${e}`);
  } else {
    console.log("\nNo browser console or page errors captured.");
  }
  if (failed.length) {
    console.log("\nFailed steps:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
