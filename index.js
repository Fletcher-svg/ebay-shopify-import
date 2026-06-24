require("dotenv").config();
const axios = require("axios");
// File System - create and save the CSV file to your hard drive.
const fs = require("fs");


const ebayId = 
[
  "392877624101",
  "392877624103",
  "392877624104",
  "392877624106",
  "392877624108",
  "392877624113",
  "392877629804",
  "392877630797",
  "392877631633",
  "392877633610",
  "392877637944",
  "392877640790",
  "392877641675",
  "392879571274",
  "392883796265",
  "39288340156",
  "392913557833",
];

async function getEbayAccessToken() 
{
  const clienId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

// Checking fill in .env
if (!clienId || !clientSecret)
{
  console.error("Error missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in .env");
  return null;
}

// Encryption method in Node.js for eBay
const credentials = Buffer.from(`${clienId}:${clientSecret}`).toString('base64');

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
  return null;
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

  // Reviews the data collected for all goods.
  data.forEach(item => {
    if (item.images.length === 0)
    {
      csvContent += `${item.id},Product ${item.id},,\n`;
      return;
    }

    item.images.forEach((imgUrl, idx) => {
      // idx starts 0
      const pos = idx + 1;

      // Shopify request
      if (idx === 0)
      {
        csvContent += `${item.id},Product ${item.id},"${imgUrl}",${pos}\n`;
      } else
      {
        csvContent += `${item.id},,"${imgUrl}",${pos}\n`;
      }
    });
  });

  // Wtite it into the file
  fs.writeFileSync('shopify_import.csv', csvContent, 'utf8');
  console.log('CSV report generated shopify_import.csv');
}

// Entry point
async function run() 
{
  console.log('Starting eBay API scraper');
  
  const token = await getEbayAccessToken();
  if (!token)
  {
    console.error('Process aborted auth failed');
    return;
  }

  const result = [];

  // Send each ID to the API
  for (const id of ebayId)
  {
    console.log(`Fetching ID: ${id} `);
    const images = await getEbayImagesViaAPI(id, token);

    console.log(`-> Found ${images.length} images.`);
    result.push({id, images});
  }

  console.log('All data from eBay API fetched successfully');
  saveToShopifyCSV(result);
}

run();