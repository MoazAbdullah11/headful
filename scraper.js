import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

// ✅ delay helper
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// ✅ Detect blocked page
const isBlocked = async (page) => {
  const title = await page.title();
  const content = await page.content();

  const blockedSigns = [
    "access denied",
    "forbidden",
    "captcha",
    "bot detection"
  ];

  return blockedSigns.some(sign =>
    title.toLowerCase().includes(sign) ||
    content.toLowerCase().includes(sign)
  );
};

// ✅ Extract metadata + fallback logic
const extractData = async (page) => {
  return await page.evaluate(() => {
    const getMeta = (name) =>
      document.querySelector(`meta[property='${name}']`)?.content ||
      document.querySelector(`meta[name='${name}']`)?.content ||
      "";

    // 🔥 fallback image (VERY IMPORTANT)
    const getFirstImage = () => {
      const imgs = Array.from(document.images || []);
      return imgs.length ? imgs[0].src : "";
    };

    return {
      title: document.title || "",
      description:
        getMeta("og:description") ||
        getMeta("description") ||
        "",
      image:
        getMeta("og:image") ||
        getFirstImage(),
      url: window.location.href
    };
  });
};

export async function fetchMetadata(url, retries = 2) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false, // 🔥 headful
      defaultViewport: null,
      args: [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled"
      ]
    });

    const page = await browser.newPage();

    // ✅ Real user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9"
    });

    // ✅ Hide webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false
      });
    });

    // ✅ Go to page
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // ✅ Human behavior
    await delay(2000);
    await page.mouse.move(100, 200);
    await page.mouse.move(400, 500);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(2000);

    // ✅ Wait for meta tags (if exist)
    try {
      await page.waitForSelector("meta", { timeout: 5000 });
    } catch (e) {}

    // ❗ Check block
    if (await isBlocked(page)) {
      throw new Error("Blocked by website");
    }

    // ✅ Extract data
    const data = await extractData(page);

    // ✅ Debug HTML
    const html = await page.content();
    fs.writeFileSync("debug.html", html);

    await browser.close();

    return {
      success: true,
      data
    };

  } catch (error) {
    if (browser) await browser.close();

    // 🔁 Retry logic
    if (retries > 0) {
      console.log("Retrying...", retries);
      return fetchMetadata(url, retries - 1);
    }

    return {
      success: false,
      error: error.message
    };
  }
}
