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
  const bob = await open(browser, running.port);
  await fill(alice, "Your name", "Alice");
  await click(alice, "Continue");
  await click(alice, "Create room");
  const code = await roomCode(alice);
  await fill(bob, "Your name", "Bob");
  await click(bob, "Continue");
  await fill(bob, "Room code", code);
  await click(bob, "Join room");
  await waitFor(alice, "Bob");
  await click(alice, "Start");
  await waitFor(alice, "North Bob");
  await waitFor(bob, "North Alice");
  await waitFor(alice, "Deal in");
  await waitFor(alice, "Play 26");
  await waitFor(bob, "Your cards 26");
  await waitFor(alice, /\d+ ms/);
  await waitFor(bob, /\d+ ms/);
  const aliceHand = await handButtons(alice);
  const bobHand = await handButtons(bob);
  assertHand(aliceHand);
  assertHand(bobHand);
  await mkdir(shots, { recursive: true });
  await alice.screenshot({ path: path.join(shots, "slapjack-hand.png") });
  const alicePing = await text(alice);
  const bobPing = await text(bob);
  if (!/\d+ ms/.test(alicePing) || !/\d+ ms/.test(bobPing)) {
    throw new Error("ping did not render");
  }
  await click(alice, "Play");
  await waitFor(alice, "Dealing");
  await alice.screenshot({ path: path.join(shots, "slapjack-deal.png") });
  await waitFor(alice, "Board ");
  await waitFor(bob, "Board ");
  await mkdir(shots, { recursive: true });
  await alice.screenshot({ path: path.join(shots, "slapjack-alice.png") });
  await bob.screenshot({ path: path.join(shots, "slapjack-bob.png") });
  await click(bob, "Slap");
  await waitFor(alice, "Slapping");
  await alice.screenshot({ path: path.join(shots, "slapjack-slap.png") });
  await waitFor(alice, "Gathering");
  await delay(420);
  await alice.screenshot({ path: path.join(shots, "slapjack-gather.png") });
  const after = await text(alice);
  if (!/too slow|Slapped the Wrong Card/.test(after)) {
    throw new Error(`slap did not resolve\n${after}`);
  }
  console.log(JSON.stringify({
    ok: true,
    code,
    url: `http://127.0.0.1:${running.port}`,
    alicePing: alicePing.match(/\d+ ms/)[0],
    bobPing: bobPing.match(/\d+ ms/)[0],
    aliceHand,
    bobHand,
    resolution: /too slow/.test(after) ? "late" : "wrong",
  }));
} finally {
  await browser.close();
  await running.close();
}

async function open(browser, port) {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("flutter-view, flt-glass-pane", { timeout: 60000 });
  const placeholder = await page.$("flt-semantics-placeholder");
  if (placeholder) await placeholder.click();
  await waitFor(page, "Your name");
  page._errors = errors;
  return page;
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
  const pattern = needle instanceof RegExp ? needle : null;
  const exact = pattern ? null : String(needle);
  while (Date.now() - started < timeout) {
    const body = await text(page);
    if (pattern ? pattern.test(body) : body.includes(exact)) return;
    await delay(200);
  }
  await page.screenshot({ path: "/tmp/slapjack-timeout.png" }).catch(() => {});
  throw new Error(`timed out waiting for ${needle}\n${await text(page)}\n${(page._errors ?? []).join("\n")}`);
}

async function click(page, label) {
  await page.bringToFront();
  await waitFor(page, label);
  const box = await page.evaluate((wanted) => {
    const nodes = [...document.querySelectorAll("[aria-label], button, input")];
    const hits = nodes.filter((item) => (item.getAttribute("aria-label") ?? "") === wanted);
    const pool = hits.length ? hits : nodes.filter((item) => (item.getAttribute("aria-label") ?? "").includes(wanted));
    pool.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    let node = pool.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && rect.width < window.innerWidth * 0.95;
    }) ?? pool[0];
    if (!node) {
      const leaves = [...document.querySelectorAll("flt-semantics, span, button")].filter((item) => {
        return (item.textContent ?? "").trim() === wanted;
      });
      leaves.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return ra.width * ra.height - rb.width * rb.height;
      });
      node = leaves.find((item) => item.getBoundingClientRect().height > 1) ?? null;
    }
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
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, label);
  if (!box || box.width < 2 || box.height < 2) throw new Error(`missing ${label}`);
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
  await waitFor(page, /Room [A-Z0-9]{4}/);
  const body = await text(page);
  const match = body.match(/Room ([A-Z0-9]{4})/);
  if (!match) throw new Error(`no room code\n${body}`);
  return match[1];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handButtons(page) {
  await page.bringToFront();
  const layout = await page.evaluate(() => {
    function nameOf(node) {
      const aria = node.getAttribute("aria-label");
      if (aria) return aria;
      return (node.textContent ?? "").trim();
    }
    function box(match) {
      const nodes = [...document.querySelectorAll("[aria-label], [role='button']")].filter((item) => match(nameOf(item)));
      const fits = [];
      for (const node of nodes) {
        const seen = new Set();
        const queue = [node];
        while (queue.length) {
          const cursor = queue.shift();
          if (!cursor || seen.has(cursor)) continue;
          seen.add(cursor);
          const rect = cursor.getBoundingClientRect();
          if (rect.width >= 80 && rect.height >= 80 && rect.height <= 240 && rect.width <= 240) {
            fits.push({
              label: nameOf(node),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            });
            break;
          }
          if (cursor.parentElement) queue.push(cursor.parentElement);
          for (const child of cursor.children ?? []) queue.push(child);
        }
      }
      fits.sort((a, b) => Math.abs(a.width - a.height) - Math.abs(b.width - b.height) || b.width - a.width);
      return fits[0] ?? null;
    }
    return {
      viewport: window.innerWidth,
      play: box((label) => label.startsWith("Play ") || label.startsWith("Your cards ")),
      slap: box((label) => label === "Slap"),
    };
  });
  return layout;
}

function assertHand(layout) {
  if (layout.viewport !== 390) throw new Error(`expected a phone width, got ${layout.viewport}`);
  const { play, slap } = layout;
  if (!play || !slap) throw new Error(`hand is missing a button ${JSON.stringify(layout)}`);
  if (!/26/.test(play.label)) throw new Error(`card count is not on the hand button ${play.label}`);
  if (!(play.x + play.width <= slap.x + 8)) throw new Error(`play button is not left of slap ${JSON.stringify(layout)}`);
  if (Math.abs((play.y + play.height / 2) - (slap.y + slap.height / 2)) > 30) {
    throw new Error(`the two buttons are not on one row ${JSON.stringify(layout)}`);
  }
  if (Math.abs(play.width - play.height) > 12 || Math.abs(slap.width - slap.height) > 12) {
    throw new Error(`the buttons are not square ${JSON.stringify(layout)}`);
  }
  if (play.width < 150 || slap.width < 150) throw new Error(`the buttons do not fill the bottom ${JSON.stringify(layout)}`);
}
