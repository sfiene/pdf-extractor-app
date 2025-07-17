// This version includes fixes for browser stability in a serverless environment.

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer');

// Add recommended flags for serverless environments
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let browser = null;

  try {
    const { url } = JSON.parse(event.body);
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'URL is required' }) };
    }

    // Add more robust arguments for a restricted serverless environment
    const browserArgs = [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // '--single-process' // Removing this flag as it can sometimes cause instability.
    ];

    // Launch the headless browser with the compatibility flags
    browser = await puppeteer.launch({
      args: browserArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Corrected a typo in the User-Agent string (5.G -> 5.0)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('#gvLoisSubmittals', { timeout: 60000 });

    // Now that the table exists, extract all the PDF links from it using the new, more accurate selector.
    const pdfUrls = await page.evaluate(() => {
      // This code runs inside the browser context
      // This selector finds the 'a' tag inside the first 'td' of each row in the table body.
      const links = Array.from(document.querySelectorAll('#gvLoisSubmittals table tbody tr td:first-child a'));
      const urls = new Set();
      
      links.forEach(link => {
        // The 'href' attribute should be a complete URL.
        if (link.href) {
          urls.add(link.href);
        }
      });
      
      return Array.from(urls);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ pdfUrls }),
    };
  } catch (error) {
    console.error('Crawl Error:', error);
    if (error.name === 'TimeoutError') {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `The page took too long to load or the required table (#gvLoisSubmittals) did not appear within 60 seconds.` }),
        };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to crawl the specified URL. Error: ${error.message}` }),
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};
