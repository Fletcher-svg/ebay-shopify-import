// axios - take page from eBay text HTML code
const axios = require('axios');
// cheerio - to photos from eBay, looking for an element in
const cheerio = require('cheerio');

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
  "392883840156",
  "392913557833"
];

// function delay - helps to take breaks for eBay query
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// fuction asynk (inside it will wait for answers from the service)
async function getEbayImages(itemId)
{
  const url = `https://www.ebay.com/itm/${itemId}`;
// it's a secuiry if lose the internet or eBay falls
try
{
  const response = await axios.get(url,
    { headers:
       { // the request is coming from chrome
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'

       }
    });
    // $ - can search for tags on the page
    const $ = cheerio.load(response.data);
    const imageUrls = [];
    // searches for tag
    const selectors = '.ux-image-filmstrip-carousal-item img, .image-container img, .vertical-filmstrip img';
    // i - is the number of a picture. el - the tag in HTML
    $(selectors).each((i, el) =>
    {
      let src = $(el).attr('src') || $(el).attr('data-src');
      // eBay - links lead to small images like (/s-l34.jpg). Use 1600 it give us the image in the highest resolution.  
      if (src)
      {
        src = src.replace(/s-l\d+\./, 's-l1600.');
        // Check if this photo is already in array
        if (!imageUrls.includes(src) && src.startsWith('http'))
        {
          imageUrls.push(src);
        }
      }
    });
    return imageUrls;

} catch (err)
 {
  console.log(`Error parsing ID ${itemId}:`, err.message);
  return [];
 }
}

// handles all id list
async function run()
{
  console.log(`Starting import for ${ebayId.length} items`);
  const result = [];
  // cycle
  for (const id of ebayId)
  {
    // create object
    console.log(`Processing ID: ${id}`);
    const images = await getEbayImages(id);
    console.log(`Found ${images.length} images`);
    result.push({id, images});
    await delay(1500);
  }
  console.log('Done! All items processed')
  return result;
}
run(); 

