import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { start } from "../server/index.js";

const shots = process.env.SHOTS ?? "/opt/cursor/artifacts";
const chrome = process.env.CHROME ?? "/usr/local/bin/google-chrome";

const running = await start({ port: 0, host: "127.0.0.1" });
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  protocolTimeout: 120000,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});

try {
  const alice = await open(browser, running.port);
  await fill(alice.page, "Your name", "Alice");
  await click(alice.page, "Continue");
  await waitFor(alice.page, "Create room");
  await mkdir(shots, { recursive: true });
  await alice.page.screenshot({ path: path.join(shots, "slapjack-lobby-name.png") });
  await click(alice.page, "Create room");
  await waitFor(alice.page, "Copy link");
  const code = await roomCode(alice.page);
  await waitFor(alice.page, `Room link http://127.0.0.1:${running.port}/?room=${code}`);
  await click(alice.page, "Copy link");
  await waitFor(alice.page, "Link copied");
  await alice.page.screenshot({ path: path.join(shots, "slapjack-lobby-room.png") });

  const bob = await open(browser, running.port, `/?room=${code}`);
  await bob.page.screenshot({ path: path.join(shots, "slapjack-lobby-invite.png") });
  const body = await text(bob.page);
  if (body.includes("Create room")) throw new Error("invite skipped the name step");
  await fill(bob.page, "Your name", "Bob");
  await click(bob.page, "Continue");
  await waitFor(bob.page, "Bob");

  const cara = await open(browser, running.port, `/?room=${code}`);
  await fill(cara.page, "Your name", "Cara");
  await click(cara.page, "Continue");
  const dan = await open(browser, running.port, `/?room=${code}`);
  await fill(dan.page, "Your name", "Dan");
  await click(dan.page, "Continue");
  await waitFor(alice.page, "Dan");
  await click(alice.page, "Start");

  await waitFor(alice.page, "South Alice");
  await waitFor(alice.page, "North Cara");
  await waitFor(alice.page, "West Bob");
  await waitFor(alice.page, "East Dan");
  await waitFor(bob.page, "South Bob");
  await waitFor(bob.page, "North Dan");
  await waitFor(cara.page, "South Cara");
  await waitFor(dan.page, "South Dan");
  const before = await seatBox(alice.page, "North Cara");
  await mkdir(shots, { recursive: true });
  await alice.page.screenshot({ path: path.join(shots, "slapjack-four-alice.png") });
  await bob.page.screenshot({ path: path.join(shots, "slapjack-four-bob.png") });
  await cara.page.screenshot({ path: path.join(shots, "slapjack-four-cara.png") });
  await dan.page.screenshot({ path: path.join(shots, "slapjack-four-dan.png") });

  await dan.context.close();
  await waitFor(alice.page, "Offline");
  await alice.page.screenshot({ path: path.join(shots, "slapjack-four-offline.png") });
  await waitFor(alice.page, "Pile 1", 12000);
  const after = await seatBox(alice.page, "North Cara");
  if (Math.abs(before.y - after.y) > 3 || Math.abs(before.x - after.x) > 3) {
    throw new Error(`the north seat moved ${JSON.stringify({ before, after })}`);
  }
  await alice.page.screenshot({ path: path.join(shots, "slapjack-four-dealt.png") });

  await alice.page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await alice.page.waitForSelector("flutter-view, flt-glass-pane", { timeout: 60000 });
  const placeholder = await alice.page.$("flt-semantics-placeholder");
  if (placeholder) await placeholder.click();
  await waitFor(alice.page, "South Alice");
  await waitFor(alice.page, `Room ${code}`);
  await alice.page.screenshot({ path: path.join(shots, "slapjack-refresh.png") });
  await click(alice.page, "Leave");
  await waitFor(alice.page, "Leave this room?");
  await alice.page.screenshot({ path: path.join(shots, "slapjack-leave.png") });
  await click(alice.page, "Stay");
  const stayStarted = Date.now();
  while (Date.now() - stayStarted < 5000) {
    const stayed = await text(alice.page);
    if (stayed.includes("South Alice") && !stayed.includes("Leave this room?")) break;
    await delay(200);
  }
  const stayed = await text(alice.page);
  if (!stayed.includes("South Alice") || stayed.includes("Leave this room?")) {
    throw new Error(`Stay did not close the prompt\n${stayed}`);
  }
  await click(alice.page, "Leave");
  await click(alice.page, "Sure");
  await waitFor(alice.page, "Create room");

  console.log(JSON.stringify({
    ok: true,
    code,
    north: { before, after },
    url: `http://127.0.0.1:${running.port}/?room=${code}`,
  }));
} finally {
  await browser.close();
  await running.close();
}

async function open(browser, port, pathName = "/") {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}${pathName}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("flutter-view, flt-glass-pane", { timeout: 60000 });
  const placeholder = await page.$("flt-semantics-placeholder");
  if (placeholder) await placeholder.click();
  await waitFor(page, "Your name");
  page._errors = errors;
  return { context, page };
}

async function text(page) {
  return page.evaluate(() => {
    const parts = [document.body?.innerText ?? ""];
    for (const node of document.querySelectorAll("[aria-label]")) {
      parts.push(node.getAttribute("aria-label") ?? "");
    }
    return parts.join("\n");
  });
}

async function waitFor(page, needle, timeout = 30000) {
  await page.bringToFront();
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if ((await text(page)).includes(needle)) return;
    await delay(200);
  }
  await page.screenshot({ path: "/tmp/slapjack-timeout.png" }).catch(() => {});
  throw new Error(`timed out waiting for ${needle}\n${await text(page)}\n${(page._errors ?? []).join("\n")}`);
}

async function click(page, label) {
  await page.bringToFront();
  await waitFor(page, label);
  const box = await page.evaluate((wanted) => {
    const nodes = [...document.querySelectorAll("[aria-label], button, [role='button']")];
    const named = nodes.filter((item) => {
      const aria = item.getAttribute("aria-label") ?? "";
      const leaf = (item.textContent ?? "").trim();
      return aria === wanted || leaf === wanted;
    });
    named.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    const node = named.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && rect.width < window.innerWidth * 0.95;
    }) ?? named[0];
    if (!node) return null;
    let target = node;
    let cursor = node;
    while (cursor) {
      const role = cursor.getAttribute?.("role");
      if (role === "button" || cursor.hasAttribute?.("flt-tappable")) {
        target = cursor;
        break;
      }
      cursor = cursor.parentElement;
    }
    target.click();
    const rect = target.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, label);
  if (!box || box.width < 2) throw new Error(`missing ${label}`);
}

async function fill(page, label, value) {
  await page.bringToFront();
  await waitFor(page, label);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate((wanted) => {
      const input = [...document.querySelectorAll("input")].find((item) => item.getAttribute("aria-label") === wanted);
      input?.focus();
    }, label);
    await delay(80);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(value, { delay: 40 });
    await delay(80);
    const got = await page.evaluate((wanted) => {
      const input = [...document.querySelectorAll("input")].find((item) => item.getAttribute("aria-label") === wanted);
      return input?.value ?? "";
    }, label);
    if (got === value) return;
  }
  throw new Error(`could not fill ${label} with ${value}`);
}

async function roomCode(page) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const body = await text(page);
    const match = body.match(/Room ([A-Z0-9]{4})/);
    if (match) return match[1];
    await delay(200);
  }
  throw new Error(`no room code\n${await text(page)}`);
}

async function seatBox(page, label) {
  await page.bringToFront();
  const box = await page.evaluate((wanted) => {
    const nodes = [...document.querySelectorAll("flt-semantics, [aria-label], span, div")].filter((item) => {
      const aria = item.getAttribute("aria-label") ?? "";
      const own = [...item.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent.trim()).join(" ");
      return aria === wanted || own === wanted || own.startsWith(wanted);
    });
    const node = nodes.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
    if (!node) {
      const sample = [...document.querySelectorAll("flt-semantics, span")].map((item) => (item.getAttribute("aria-label") || item.textContent || "").trim()).filter(Boolean).slice(0, 30);
      return { missing: sample };
    }
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, label);
  if (!box || box.missing) throw new Error(`missing seat ${label} ${JSON.stringify(box)}`);
  return box;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
