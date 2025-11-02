import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface DownloadedImage {
  originalUrl: string;
  localPath: string;
  filename: string;
}

/**
 * Downloads an image from a URL and saves it locally
 */
async function downloadImage(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err: Error) => {
        fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Sanitizes article number to prevent directory traversal attacks
 * @param articleNumber Raw article number from user input
 * @returns Safe article number (only alphanumeric, underscore, hyphen)
 */
function sanitizeArticleNumber(articleNumber: string): string {
  // Remove any characters that could cause path traversal
  // Allow only: A-Z, a-z, 0-9, underscore, hyphen
  const sanitized = articleNumber.replace(/[^A-Za-z0-9_-]/g, '_');
  
  // Prevent empty or dangerous patterns
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'unknown_product';
  }
  
  return sanitized;
}

/**
 * Downloads all product images and saves them locally
 * @param imageUrls Array of image URLs to download
 * @param articleNumber Product article number (used for folder name) - will be sanitized
 * @returns Array of downloaded image info (original URL + local path)
 */
export async function downloadProductImages(
  imageUrls: string[],
  articleNumber: string
): Promise<DownloadedImage[]> {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }

  // CRITICAL: Sanitize article number to prevent directory traversal attacks
  const safeArticleNumber = sanitizeArticleNumber(articleNumber);
  console.log(`[Image Download] Sanitized article number: "${articleNumber}" → "${safeArticleNumber}"`);

  // Create product-specific folder
  const productFolder = path.join('attached_assets', 'product_images', safeArticleNumber);
  await fs.mkdir(productFolder, { recursive: true });

  const downloadedImages: DownloadedImage[] = [];

  // Download each image with loop
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    
    try {
      // Detect file extension from URL
      const urlPath = new URL(imageUrl).pathname;
      const ext = path.extname(urlPath) || '.jpg';
      const filename = `bild_${i + 1}${ext}`;
      const localPath = path.join(productFolder, filename);

      console.log(`[Image Download] Downloading image ${i + 1}/${imageUrls.length}: ${imageUrl}`);
      await downloadImage(imageUrl, localPath);

      downloadedImages.push({
        originalUrl: imageUrl,
        localPath: localPath.replace(/\\/g, '/'), // Normalize path separators
        filename
      });

      console.log(`[Image Download] ✅ Saved: ${localPath}`);
    } catch (error) {
      console.error(`[Image Download] ❌ Failed to download image ${i + 1}: ${error}`);
      // Continue with next image even if one fails
    }
  }

  return downloadedImages;
}
