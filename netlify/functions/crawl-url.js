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

    // Go to the URL and wait for the network to be idle
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for the specific table element to be rendered on the page.
    await page.waitForSelector('#gvLoisSubmittals');

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
