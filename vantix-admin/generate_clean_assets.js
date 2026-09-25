import sharp from 'sharp';
import fs from 'fs';

const inputPath = 'C:/Users/visha/.gemini/antigravity-ide/brain/c3dc8b93-5c5b-4015-9516-d9919c8dbe1b/.user_uploaded/media_1790302445086.png';

async function generateCleanAssets() {
  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const rgba = Buffer.alloc(width * height * 4);

  // Background removal with smooth color-keying for outer background
  // 1. Flood fill to mark background vs inside object
  const visited = new Uint8Array(width * height);
  const queue = [];
  const getIdx = (x, y) => y * width + x;

  const isDarkThreshold = (r, g, b) => {
    // Original background is black. Check brightness.
    return (r * 0.299 + g * 0.587 + b * 0.114) < 16;
  };

  // Enqueue 4 borders
  for (let x = 0; x < width; x++) {
    let p = (0 * width + x) * channels;
    if (isDarkThreshold(data[p], data[p+1], data[p+2])) { visited[getIdx(x, 0)] = 1; queue.push(x, 0); }
    p = ((height - 1) * width + x) * channels;
    if (isDarkThreshold(data[p], data[p+1], data[p+2])) { visited[getIdx(x, height - 1)] = 1; queue.push(x, height - 1); }
  }
  for (let y = 0; y < height; y++) {
    let p = (y * width + 0) * channels;
    if (!visited[getIdx(0, y)] && isDarkThreshold(data[p], data[p+1], data[p+2])) { visited[getIdx(0, y)] = 1; queue.push(0, y); }
    p = (y * width + (width - 1)) * channels;
    if (!visited[getIdx(width - 1, y)] && isDarkThreshold(data[p], data[p+1], data[p+2])) { visited[getIdx(width - 1, y)] = 1; queue.push(width - 1, y); }
  }

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
          if (isDarkThreshold(data[p], data[p+1], data[p+2])) {
            visited[nIdx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  // Calculate distance transform from non-visited to smoothly anti-alias background edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = (y * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const isBg = visited[getIdx(x, y)];

      rgba[dstIdx] = r;
      rgba[dstIdx + 1] = g;
      rgba[dstIdx + 2] = b;

      if (isBg) {
        rgba[dstIdx + 3] = 0;
      } else {
        // Lum-based alpha ramp near outer boundary
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        if (lum < 24) {
          let nearBg = false;
          for (let d = 0; d < 4; d++) {
            const nx = x + dx[d], ny = y + dy[d];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[getIdx(nx, ny)]) {
              nearBg = true;
              break;
            }
          }
          if (nearBg) {
            rgba[dstIdx + 3] = Math.min(255, Math.max(0, Math.floor(((lum - 10) / 14) * 255)));
          } else {
            rgba[dstIdx + 3] = 255;
          }
        } else {
          rgba[dstIdx + 3] = 255;
        }
      }
    }
  }

  // Trim and produce final master image
  const masterRaw = sharp(rgba, { raw: { width, height, channels: 4 } });
  const trimmed = await masterRaw.trim().png().toBuffer();
  const meta = await sharp(trimmed).metadata();

  console.log(`Trimmed master logo: ${meta.width}x${meta.height}`);

  // Write full logo
  const logoTargets = [
    'src/assets/vantix-logo.png',
    'public/vantix-logo.png',
    'public/assets/vantix-logo.png',
    'dist/assets/vantix-logo.png',
  ];
  logoTargets.forEach(t => {
    try { fs.writeFileSync(t, trimmed); } catch(e){}
  });

  // Extract emblem (eagle only)
  const emblemHeight = Math.floor(meta.height * 0.74);
  const emblemBuffer = await sharp(trimmed)
    .extract({ left: 0, top: 0, width: meta.width, height: emblemHeight })
    .trim()
    .png()
    .toBuffer();

  const iconTargets = [
    'src/assets/vantix-icon.png',
    'public/vantix-icon.png',
    'public/assets/vantix-icon.png',
    'dist/assets/vantix-icon.png',
  ];
  iconTargets.forEach(t => {
    try { fs.writeFileSync(t, emblemBuffer); } catch(e){}
  });

  // Favicon (64x64 and 128x128)
  const favBuffer = await sharp(emblemBuffer)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync('public/favicon.png', favBuffer);

  console.log('Successfully generated all clean transparent assets!');
}

generateCleanAssets().catch(console.error);
