// Temporary: loads map.fo.umich.edu in headless Chromium and prints the data
// requests it makes, to find where its layers come from. Removed after use.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const seen = new Map();
page.on("request", (req) => {
  const type = req.resourceType();
  if (["image", "font", "stylesheet", "media"].includes(type) && !/\.pbf|tile|MapServer|VectorTile/i.test(req.url())) return;
  if (!seen.has(req.url())) seen.set(req.url(), type);
});
await page.goto("https://map.fo.umich.edu/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);
console.log("TITLE", await page.title());
const texts = await page.locator("button, [role=button], label, a").allInnerTexts();
console.log("CONTROLS", JSON.stringify([...new Set(texts.map((t) => t.trim()).filter(Boolean))].slice(0, 120)));
for (const label of [/layers?/i, /accessib/i, /entrance/i, /door/i]) {
  const el = page.getByText(label).first();
  if (await el.count()) {
    try {
      await el.click({ timeout: 3000 });
      console.log("CLICKED", label);
      await page.waitForTimeout(4000);
    } catch (error) {
      console.log("CLICK FAILED", label, error.message.split("\n")[0]);
    }
  }
}
await page.mouse.wheel(0, -600);
await page.waitForTimeout(4000);
for (const [url, type] of seen) console.log("REQ", type, url.length > 400 ? url.slice(0, 400) + "…" : url);
await browser.close();
