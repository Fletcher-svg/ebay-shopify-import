require("dotenv").config();
const axios = require("axios");
// File System - create and save the CSV file to your hard drive
const fs = require("fs");
// csv-parser - converts table rows to objects
const csv = require("csv-parser");

const INPUT_CSV_FILE = "eBay-all-active-listings-report.csv";
// JSON database file (cache)
const CACHE_FILE = "ebay_images_cache.json"; 
const OUTPUT_CSV_FILE = "shopify_import_first_800.csv"; 

// Handle the first 800 items from the general list
const TEST_LIMIT_ITEMS = 800; 
// Delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Read the file
function parseEbayCsv(filePath) 
{
   // Promis is needed that the program knows when the reading will be finished or bad 
  return new Promise((resolve, reject) => 
    {
    // Avoid duplicate ID
    const idSet = new Set(); // set - it cannot physically store duplicates

    // The file physically exists in the specified path
    if (!fs.existsSync(filePath)) 
    {
      return reject(new Error(`Input file missing: ${filePath}`));
    }
    // Starts streaming the file from the disk in parts    
    fs.createReadStream(filePath)
       // Redirects the read flow to a csv-parser    
      .pipe(
        csv({
          separator: ";",
          // Clear hidden BOM characters
          mapHeaders: ({ header }) => header.replace(/^\uFEFF/, "").trim(),
        }),
      )
      // The processes a row from a table
      .on("data", (row) => {
        const rawId = row["Item number"];
        if (rawId) {
          //Removes random invisible spaces or row transfer characters
          const cleanId = rawId.trim();
          if (cleanId && !isNaN(cleanId)) 
          {
            idSet.add(cleanId);
          }
        }
      })
       // Listener event, when the file is read to the end
      .on("end", () => 
      {
        console.log(`Parsed input CSV total unique ID found: ${idSet.size}`);
        // Returns Set to a regular array 
        resolve(Array.from(idSet));
      })
      .on("error", reject);
  });
}

async function getEbayAccessToken() 
{
  // API
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  // Checking fill in .env
  if (!clientId || !clientSecret) 
  {
    // Force stop the script
    throw new Error("Error missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in .env");
  }

  // Combines the OAuth eBay security keys
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const response = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      {
        headers: 
        {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
      },
    );
    return response.data.access_token;
  } catch (err) {
    console.error("Token generation failed:", err.response?.data || err.message);
    throw err;
  }
}

// Request Images through API
async function getEbayImagesViaAPI(itemId, token) 
{
  const url = `https://api.ebay.com/buy/browse/v1/item/v1|${itemId}|0`;
  try {
    const response = await axios.get(url, {
      headers: 
      {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const images = [];
    const data = response.data;

    // Checks if the server returned the image object
    if (data.image?.imageUrl) 
    { // If photo exists add 
      images.push(data.image.imageUrl);
    }

    // Checks if eBay has sent a mass of additional images from the Lot gallery
    if (Array.isArray(data.additionalImages)) 
    {
      data.additionalImages.forEach((img) => {
        //  That the add-on image has a link and that this link is not yet in array 
        if (img.imageUrl && !images.includes(img.imageUrl)) 
        {
          images.push(img.imageUrl);
        }
      });
    }
    return images;
  } catch (err) {
    // Function returns an empty mass 
    return [];
  }
}

function generateShopifyCSV(ebayIds, imagesMap, limit) 
{
  // Header 
  let csvContent = "Handle,Title,Image Src,Image Position\n";
  // Limit
  const itemsToProcess = ebayIds.slice(0, limit);

  itemsToProcess.forEach((id) => 
    {
    // Checks if we have a cache for this ID in  map
    const images = imagesMap[id] && imagesMap[id].length > 0 
      ? imagesMap[id] 
      : [`https://thumbs.ebaystatic.com/images/g/O~0AAOSw~-~${id}/s-l1600.jpg`];

    images.forEach((url, idx) => 
    { // Shopify import structures for grouping images under a single product.
      const title = idx === 0 ? `Product ${id}` : "";
      csvContent += `${id},"${title}","${url}",${idx + 1}\n`;
    });
  });

  // Save data 
  fs.writeFileSync(OUTPUT_CSV_FILE, csvContent, "utf8");
  // Counts the actual number of rows in the resulting file
  const totalRows = csvContent.split("\n").length - 2;
  console.log(`\n File ready: ${OUTPUT_CSV_FILE}`);
  console.log(` Items precessed: ${itemsToProcess.length}`);
  console.log(` Total number of rows in CSV: ${totalRows}`);
}

async function run() 
{
  console.log("Starting sync process");
  try {
    // Wait for it to finish and retains the cleaned ID array
    const ebayIds = await parseEbayCsv(INPUT_CSV_FILE);
    // the key-value structure (where the key is the ID of the item and the value is the mass of its image)
    let imagesMap = {};

    // Checks if the finished file is already in the folder
    if (fs.existsSync(CACHE_FILE)) 
      {
      console.log("Local photo database (cache) found skipping API polling");
      // Reads the cache file from the disk and instantly transforms it from text back
      imagesMap = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    } else {
      console.log("Cache does not exist. We start downloading from Browse API");
      // Turn on OAuth token generation
      const token = await getEbayAccessToken();
      console.log("OAuth token generated successfully. Starting loop...");

      // Only charge what we need (Limit)
      const maxToFetch = Math.min(ebayIds.length, TEST_LIMIT_ITEMS);

      for (let i = 0; i < maxToFetch; i++) 
      {
        // Get the ID of the current product by index 
        const id = ebayIds[i];
        // Progress bar in the console
        console.log(`Processing item ${i + 1}/${maxToFetch}: ${id}`);
        // Send a request to the eBay API
        const images = await getEbayImagesViaAPI(id, token);
        // How many pictures has the server returned for the current lot
        console.log(`-> Found ${images.length} images`);
        
        imagesMap[id] = images;
        
        // Delay
        await sleep(150);
      }

      // Save the work result to a file JSON
      fs.writeFileSync(CACHE_FILE, JSON.stringify(imagesMap, null, 2), "utf8");
      console.log(`Full cache saved to: ${CACHE_FILE}`);
    }

    // Generate the target CSV file
    generateShopifyCSV(ebayIds, imagesMap, TEST_LIMIT_ITEMS);

  } catch (err) {
    console.error("Critical process error:", err.message);
  }
}

run();