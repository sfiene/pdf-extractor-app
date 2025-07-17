// This function now uses Puppeteer to control a headless browser.
// It can render JavaScript-heavy pages before finding the links.

const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

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

    // Launch the headless browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Go to the URL and wait for the network to be idle
    await page.goto(url, { waitUntil: 'networkidle2' });

    // IMPORTANT: Wait for the specific table element to be rendered on the page.
    // This is the key step to ensure the JavaScript has finished running.
    await page.waitForSelector('#gvLoisSubmittals');

    // Now that the table exists, extract all the PDF links from it.
    const pdfUrls = await page.evaluate(() => {
      // This code runs inside the browser context
      const links = Array.from(document.querySelectorAll('#gvLoisSubmittals td.k-command-cell > a'));
      const urls = new Set(); // Use a Set to avoid duplicates
      
      links.forEach(link => {
        if (link.href && link.href.toLowerCase().includes('.pdf')) {
          // The 'href' is already an absolute URL in this context
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
