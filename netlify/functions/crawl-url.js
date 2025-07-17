// This function now uses the more reliable @sparticuz/chromium package.

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer');

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

    // Launch the headless browser using the new package
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Set a realistic User-Agent to avoid being blocked by simple bot detectors
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    // Go to the URL and wait for the network to be idle
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // Increased timeout for navigation

    // Wait for the specific table element to be rendered on the page.
    // Increased timeout to 60 seconds to allow for slow-loading pages.
    await page.waitForSelector('#gvLoisSubmittals', { timeout: 60000 });

    // Now that the table exists, extract all the PDF links from it.
    const pdfUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('#gvLoisSubmittals td.k-command-cell > a'));
      const urls = new Set();
      
      links.forEach(link => {
        if (link.href && link.href.toLowerCase().includes('.pdf')) {
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
