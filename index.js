require("dotenv").config();
const axios = require("axios");
// File System - create and save the CSV file to your hard drive
const fs = require("fs");
// csv-parser - converts table rows to objects
const csv = require('csv-parser');

const INPUT_CSV_FILE = 'eBay-all-active-listings-report-2026-04-21-11301581787.csv';
const OUTPUT_CSV_FILE = 'shopify_import.csv';

const TEST_MODE = true;
const TEST_LIMIT = 5;

function parseEbayCsv(filePath)
{
  // Promis is needed that the program knows when the reading will be finished or bad 
  return new Promise((resolve, reject) => {
    const ids = [];
    // The file physically exists in the specified path
    if (!fs.existsSync(filePath))
    {
      return reject(new Error(`Input file missing: ${filePath}`));
    }
    // Starts streaming the file from the disk in parts
    fs.createReadStream(filePath)
       // Redirects the read flow to a csv-parser
      .pipe(csv({ 
        separator: ';',
        mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim()
      }))
      // The processes a row from a table
      .on('data', (row) => {
        const rawId = row['Item number'];
        if (rawId)
        {
          //Removes random invisible spaces or row transfer characters
          const cleanId = rawId.trim();
          if(cleanId) ids.push(cleanId);
        }
      })
      // Listener event, when the file is read to the end
      .on('end', () => 
      {
        console.log(`Parsed input CSV total ID found: ${ids.length}`);
        // Completes Promis and returns a pre-populated ID array
        resolve(ids);
      })
      .on('error', reject);
  });  
}

async function getEbayAccessToken() 
{
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

// Checking fill in .env
if (!clientId || !clientSecret)
{
  // Force stop the script
  throw new Error('Error missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in .env');
}

// Encryption method in Node.js for eBay
const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

try
{
  // Send encrypted data
  const response = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', 
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    {
      headers: 
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      }
    }
  );

  return response.data.access_token;
  // If eBay rejects keys
} catch (err)
  {
  console.error('Token generation failed:', err.response?.data || err.message);
  throw err;
  }
}

// Request images through the Browse API
async function getEbayImagesViaAPI(itemId, token) 
{
  // v1|itemId|0 is a strict requirement of eBay Browse API for product id
  const url = `https://api.ebay.com/buy/browse/v1/item/v1|${itemId}|0`;

  try
  {
    // Query to created address
    const response = await axios.get(url,
      {
        headers:
        {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const images = [];
    const data = response.data;

    // Check if there is a main picture in the answer
    if (data.image?.imageUrl)
    {
      images.push(data.image.imageUrl);
    }

    // Check if the product has additional pictures 
    if (Array.isArray(data.additionalImages))
    {
      data.additionalImages.forEach(img => 
        {
        if (img.imageUrl && !images.includes(img.imageUrl))
        {
          images.push(img.imageUrl);
        }
      });
    }

    return images;
    // If product ID is not found
  } catch(err)
  {
    const errMsg = err.response?.data?.errors?.[0]?.message || err.message;
    console.error(`API error for ID ${itemId}`, errMsg);
    return [];
  }
}

// Build CSV for Shopify
function saveToShopifyCSV(data)
{
  let csvContent = "Handle,Title,Image Src,Image Position\n";

  // Reviews the data collected for all goods
  data.forEach(item => {
    if (item.images.length === 0)
    {
      csvContent += `${item.id},,,\n`;
      return;
    }
    // Shopify import images
    item.images.forEach((url, idx) => {
      // idx starts with 0
      const title = idx === 0 ? `Product ${item.id}` : '';
      csvContent += `${item.id},"${title}","${url}",${idx + 1}\n`;
    });
  });

  // Wtite it into the file
  fs.writeFileSync(OUTPUT_CSV_FILE, csvContent, 'utf8');
  console.log(`Import Shopify saved to ${OUTPUT_CSV_FILE}`);
}

// Entry point
async function run() 
{
  console.log('Starting sync process');

  try
  {
    // Parsing CSV report
    let ebayIds = await parseEbayCsv(INPUT_CSV_FILE);

    if (TEST_MODE)
    {
      console.log(`Test mode limiting to first ${TEST_LIMIT} items.`);
      ebayIds = ebayIds.slice(0, TEST_LIMIT);
    }

    const token = await getEbayAccessToken();
    console.log('OAuth token generated successfully');

    const result = []
    // EbayIds starts to read each ID one at a time
    for (const id of ebayIds)
    {
      console.log(`Processing item: ${id}`);
      const images = await getEbayImagesViaAPI(id, token);
      console.log(`Found ${images.length} images`);
      result.push({id, images});
    }
    saveToShopifyCSV(result);
    console.log('Sync finished seccessfully');
  } catch (err)
  {
    console.error('Critical process error:', err.message);
  }
}

run();