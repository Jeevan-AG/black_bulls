import sharp from 'sharp';
import fs from 'fs';

const inputPath = 'C:/Users/visha/.gemini/antigravity-ide/brain/c3dc8b93-5c5b-4015-9516-d9919c8dbe1b/.user_uploaded/media_1790302445086.png';

async function processLogo() {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log(`Original dimensions: ${metadata.width}x${metadata.height}, channels: ${metadata.channels}`);

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Create RGBA buffer
  const rgbaBuffer = Buffer.alloc(width * height * 4);

  // Check corner pixels
  console.log('Top-left pixel:', data[0], data[1], data[2]);
  console.log('Top-right pixel:', data[(width - 1) * channels], data[(width - 1) * channels + 1], data[(width - 1) * channels + 2]);

  // Flood fill from all border pixels to find connected background
  const visited = new Uint8Array(width * height);
  const queue = [];

  const getIdx = (x, y) => y * width + x;

  // Add all boundary pixels that are dark
  const isDarkBg = (r, g, b) => {
    // Background in dark themes is near pure black (max component < 18 or total < 40)
    return r <= 18 && g <= 18 && b <= 18;
  };

  for (let x = 0; x < width; x++) {
    // Top border
    let p = (0 * width + x) * channels;
    if (isDarkBg(data[p], data[p+1], data[p+2])) {
      visited[getIdx(x, 0)] = 1;
      queue.push(x, 0);
    }
    // Bottom border
    p = ((height - 1) * width + x) * channels;
    if (isDarkBg(data[p], data[p+1], data[p+2])) {
      visited[getIdx(x, height - 1)] = 1;
      queue.push(x, height - 1);
    }
  }

  for (let y = 0; y < height; y++) {
    // Left border
    let p = (y * width + 0) * channels;
    if (!visited[getIdx(0, y)] && isDarkBg(data[p], data[p+1], data[p+2])) {
      visited[getIdx(0, y)] = 1;
      queue.push(0, y);
    }
    // Right border
    p = (y * width + (width - 1)) * channels;
    if (!visited[getIdx(width - 1, y)] && isDarkBg(data[p], data[p+1], data[p+2])) {
      visited[getIdx(width - 1, y)] = 1;
      queue.push(width - 1, y);
    }
  }

  // BFS
  let head = 0;
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];

    for (let i = 0; i < 4; i++) {
      const nx = cx + dx[i];
      const ny = cy + dy[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = getIdx(nx, ny);
        if (!visited[nIdx]) {
          const p = (ny * width + nx) * channels;
          const r = data[p];
          const g = data[p+1];
          const b = data[p+2];
          if (isDarkBg(r, g, b)) {
            visited[nIdx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  console.log(`Flood filled ${queue.length / 2} background pixels out of ${width * height}`);

  // Now construct RGBA image:
  // For pixels marked as background, alpha = 0.
  // For near-background pixels on the edge of the fill, we can anti-alias / soften alpha.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = (y * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const isBg = visited[getIdx(x, y)];

      rgbaBuffer[dstIdx] = r;
      rgbaBuffer[dstIdx + 1] = g;
      rgbaBuffer[dstIdx + 2] = b;

      if (isBg) {
        rgbaBuffer[dstIdx + 3] = 0; // Completely transparent
      } else {
        // Also check if it's very dark and adjacent to background for soft anti-aliasing
        const maxVal = Math.max(r, g, b);
        if (maxVal < 30) {
          // Check if neighboring a visited pixel
          let hasVisitedNeighbor = false;
          for (let d = 0; d < 4; d++) {
            const nx = x + dx[d], ny = y + dy[d];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[getIdx(nx, ny)]) {
              hasVisitedNeighbor = true;
              break;
            }
          }
          if (hasVisitedNeighbor) {
            rgbaBuffer[dstIdx + 3] = Math.min(255, Math.floor((maxVal / 30) * 255));
          } else {
            rgbaBuffer[dstIdx + 3] = 255;
          }
        } else {
          rgbaBuffer[dstIdx + 3] = 255;
        }
      }
    }
  }

  // Save the full transparent logo
  const transparentSharp = sharp(rgbaBuffer, { raw: { width, height, channels: 4 } });
  
  // Trim transparent edges
  const trimmedBuffer = await transparentSharp.trim().png().toBuffer();
  const trimmedMetadata = await sharp(trimmedBuffer).metadata();
  console.log(`Trimmed dimensions: ${trimmedMetadata.width}x${trimmedMetadata.height}`);

  fs.writeFileSync('C:/Users/visha/OneDrive/Documents/HackfiniX/black_bulls/vantix-admin/src/assets/vantix-logo.png', trimmedBuffer);
  fs.writeFileSync('C:/Users/visha/OneDrive/Documents/HackfiniX/black_bulls/vantix-admin/public/vantix-logo.png', trimmedBuffer);
  fs.writeFileSync('C:/Users/visha/OneDrive/Documents/HackfiniX/black_bulls/vantix-admin/public/assets/vantix-logo.png', trimmedBuffer);

  // Let's also create an icon-only version (the eagle emblem without the bottom VANTIX text if needed, or square aspect ratio)
  // Let's find the bounding box of just the emblem
  // In a ~1024x1024 trimmed logo:
  // Text is at bottom ~15-20%
  const emblemHeight = Math.floor(trimmedMetadata.height * 0.76);
  const emblemBuffer = await sharp(trimmedBuffer)
    .extract({ left: 0, top: 0, width: trimmedMetadata.width, height: emblemHeight })
    .trim()
    .png()
    .toBuffer();

  fs.writeFileSync('C:/Users/visha/OneDrive/Documents/HackfiniX/black_bulls/vantix-admin/src/assets/vantix-icon.png', emblemBuffer);
  fs.writeFileSync('C:/Users/visha/OneDrive/Documents/HackfiniX/black_bulls/vantix-admin/public/vantix-icon.png', emblemBuffer);

  console.log('Saved transparent vantix-logo.png and vantix-icon.png!');
}

processLogo().catch(console.error);
