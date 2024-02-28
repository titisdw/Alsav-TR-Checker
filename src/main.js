const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const stealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(stealthPlugin());

async function delay(seconds) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

let stops = false;

const proccess = async (log, proggress, logToTable, data) => {
  const { connect } = await import("puppeteer-real-browser");
  const { page, browser } = await connect({
    headless: false,
  });

  try {
    await page.goto("https://ahrefs.com/traffic-checker", {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 120000,
    });

    const files = fs.readFileSync(data.files, "utf-8");
    const lines = files.split("\n").filter((line) => line !== "");
    for (let i = 0; i < lines.length; i++) {
      if (stops) {
        log("[INFO] STOP PROCCESS");
        break;
      }

      await core(page, lines[i], log, logToTable);

      const countProgress = parseInt(((i + 1) / lines.length) * 100);
      proggress(countProgress);

      if (stops) {
        log("[INFO] STOP PROCCESS");
        break;
      }
    }

    await browser.close();
  } catch (error) {
    console.error(error);
  }
};

const core = async (page, url, log, logToTable) => {
  try {
    const input = await page.waitForSelector(
      'input[placeholder="Enter domain or URL"]',
      {
        waitUntil: ["networkidle2", "domcontentloaded"],
        timeout: 120000,
      }
    );
    await input.type(url);

    const submit = await page.$('button[type="submit"]');
    await submit.click();
    await delay(5)

    var stat = await checkStat({
      page: page,
    });
    while (stat.code !== 0) {
      await sleep(500);
      stat = await checkStat({
        page: page,
      });
    }
    
    let elTraffic;

    try {
      elTraffic = await page.waitForSelector(
        "span[class='css-1hpl2vh css-pelz90 css-0 css-gylvem-textDisplay css-1x5n6ob']",
        {
          waitUntil: ["networkidle2", "domcontentloaded"],
          timeout: 10000,
        }
      );
    } catch (error) {
      await input.evaluate((e) => (e.value = ""))
      await core(page,url,log,logToTable)
    }

    log(`[INFO] GET DATA OF URL : ${url}`);

    const data = {
      organicTraffic: await page.evaluate((e) => e.innerText, elTraffic),
    };

    logToTable(url, data);

    const close = await page.$("button[class='css-190195q-closeButton']");
    await close.click();

    await input.evaluate((e) => (e.value = ""));
    await delay(3);
  } catch (error) {
    throw error;
  }
};

const sleep = (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
};

const checkStat = ({ page }) => {
  return new Promise(async (resolve, reject) => {
    var st = setTimeout(() => {
      resolve({
        code: 1,
      });
    }, 2000);
    try {
      var checkStat = await page.evaluate(() => {
        var stat = -1;
        if (document.querySelector("html")) {
          var html = document.querySelector("html").innerHTML;
          html = String(html).toLowerCase();
          if (html.indexOf("challenges.cloudflare.com/turnstile") > -1) {
            stat = 1;
          }
        } else {
          stat = 2;
        }

        return stat;
      });

      if (checkStat !== -1) {
        try {
          var frame = page.frames()[0];
          await page.click("iframe");
          frame = frame.childFrames()[0];
          if (frame) {
            await frame.hover('[type="checkbox"]').catch((err) => {});
            await frame.click('[type="checkbox"]').catch((err) => {});
          }
        } catch (err) {}
      }

      var checkCloudflare = await page.evaluate(() => {
        return document?.querySelector("html")?.innerHTML;
      });
      const checkIsBypassed = !String(checkCloudflare)?.includes(
        "<title>Just a moment...</title>"
      );

      if (checkIsBypassed) {
        clearInterval(st);
        resolve({
          code: 0,
        });
      }
    } catch (err) {
      clearInterval(st);
      resolve({
        code: 1,
      });
    }
  });
};

const stopProccess = () => (stops = true);

module.exports = {
  proccess,
  stopProccess,
};
