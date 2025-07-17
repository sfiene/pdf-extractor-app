// This function needs two dependencies: 'axios' for fetching the URL
// and 'cheerio' for parsing the HTML. You'll need to add a 'package.json'
// file to your project to manage these dependencies.

const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'URL is required' }) };
    }

    // Fetch the HTML content of the page
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const pdfUrls = new Set(); // Use a Set to avoid duplicates

    // Find all links and filter for PDFs
    $('a').each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.toLowerCase().endsWith('.pdf')) {
        // Resolve relative URLs to absolute URLs
        const absoluteUrl = new URL(href, url).href;
        pdfUrls.add(absoluteUrl);
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ pdfUrls: Array.from(pdfUrls) }),
    };
  } catch (error) {
    console.error('Crawl Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to crawl the specified URL.' }),
    };
  }
};
