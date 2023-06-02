const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");
const { scrollPageToBottom } = require("puppeteer-autoscroll-down");
const prettier = require("prettier");
var md5 = require('md5');


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const filenameFromPath = function (str) {
  return str.substring(str.lastIndexOf("/") + 1).split("?")[0];
};

const fileExtensionFromFilename = function (filename) {
  return filename.substring(filename.lastIndexOf(".") + 1);
};

function isBase64ImageString(url) {
  // Regular expression to match the pattern of a base64 image string
  const base64ImageRegex = /^data:image\/(jpeg|jpg|png|gif|bmp);base64,/;
  return base64ImageRegex.test(url);
}

function createBase64ImageWithExtension(base64String, extension) {
  const mimeType = `image/${extension}`;
  const base64ImageWithExtension = `data:${mimeType};base64,${base64String}`;
  return base64ImageWithExtension;
}

// Function to download a resource

// Function to concatenate resources into a single file

// Function to download a CSS file

// Function to extract and download resources from HTML
async function downloadWebsiteResources(websiteUrl, outputDirectory) {
  const browser = await puppeteer.launch({ headless: "new" });

  try {
    const page = await browser.newPage();

    // Enable request interception to capture resource URLs
    await page.setRequestInterception(true);

    const resources = [];

    page.on("request", (interceptedRequest) => {
      // Capture resource URLs and abort the requests
      interceptedRequest.continue();
    });

    page.on("response", async (response) => {
      const status = response.status();
      console.log(response.url());
      if (status >= 300 && status <= 399) {
        console.log(
          "Redirect from ",
          response.url(),
          " to ",
          response.headers().location
        );
        return;
      }
      if (response.request().resourceType() === "stylesheet") {
        const content = await response.text();
        resources.push({
          url: response.url(),
          type: "stylesheet",
          replaceWith: content,
          md5: md5(content)
        });
      }
      if (response.request().resourceType() === "image") {
        const buffer = await response.buffer();
        const base64Image = buffer.toString("base64");
        const filename = filenameFromPath(response.url());
        let extension = fileExtensionFromFilename(filename);
        if (extension === "svg") {
          extension = "svg+xml";
        }
        if (isBase64ImageString(response.url())) {
          return;
        }
        if (filename.length) {
          const bs64 = createBase64ImageWithExtension(base64Image, extension)
          resources.push({
            url: response.url(),
            type: "image",
            replaceWith: bs64,
            extension,
            md5: md5(bs64)
          });
          return;
        }
      }

      if (response.request().resourceType() === "script") {
        const content = await response.text();
        resources.push({
          url: response.url(),
          type: "script",
          content,
          md5: md5(content)
        });
      }
    });

    await page.goto(websiteUrl, {
      waitUntil: ["domcontentloaded", "networkidle2"],
    });

    const scrollStep = 250; // default
    const scrollDelay = 100; // default
    await scrollPageToBottom(page, scrollStep, scrollDelay);

    await sleep(1000);

    let htmlContent = await page.content();

    const $ = cheerio.load(htmlContent);

    resources.forEach((resource) => {
      const pathname = new URL(resource.url).pathname;
      const resourceUrl = resource.url;
      if (resource.type === "image") {
        $(`img[src="${resourceUrl}"]`).attr("src", resource.replaceWith);
        $(`img[src="${pathname}"]`).attr("src", resource.replaceWith);
      } else if (resource.type === "stylesheet") {
        $(`link[href="${resourceUrl}"]`).replaceWith(
          `<style>${resource.md5}</style>`
        );
        $(`link[href="${pathname}"]`).replaceWith(
          `<style>${resource.md5}</style>`
        );
        $(`link[data-href="${resourceUrl}"]`).replaceWith(
          `<style>${resource.md5}</style>`
        );
        $(`link[data-href="${pathname}"]`).replaceWith(
          `<style>${resource.md5}</style>`
        );
      } else if (resource.type === "script") {
        $(`script[src="${resourceUrl}"]`).replaceWith(
          `<script>${resource.md5}</script>`
        );
        $(`script[src="${pathname}"]`).replaceWith(
          `<script>${resource.md5}</script>`
        );
      }
    });

    fs.writeFileSync("./website/index2.json", JSON.stringify({
      resources,
      html: $.html()
    }), {
      encoding: "utf8",
      flag: "w",
    });

    return await browser.close();
  } catch (error) {
    console.error("Error downloading website resources:", error.message);
    return await browser.close();
  }
}

// Usage example
const websiteUrl = "https://baomoi.com";
const outputDirectory = "website";

downloadWebsiteResources(websiteUrl, outputDirectory);
