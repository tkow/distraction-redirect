// Generates PNG icons for the Distraction Redirect extension.
// Design: dark background (#1a1a2e) with a red right-pointing arrow (#e63946).
// Run: node scripts/generate-icons.js

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- CRC32 ---
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function createPNG(width, height, getPixel) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      row[1 + x * 4] = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = a;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // compression, filter, interlace = 0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Icon bitmap (16×16 base) ---
// 0 = dark background, 1 = red arrow
const BG    = [26,  26,  46,  255]; // #1a1a2e
const ARROW = [230, 57,  70,  255]; // #e63946

const bitmap16 = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], //  0
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], //  1
  [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0], //  2  tip
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0], //  3
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0], //  4
  [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0], //  5  shaft top
  [1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0], //  6
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0], //  7  widest (centre)
  [1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0], //  8
  [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0], //  9  shaft bottom
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0], // 10
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0], // 11
  [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0], // 12  tip
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 13
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 14
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 15
];

function getPixelScaled(x, y, _w, _h, scale) {
  const sx = Math.floor(x / scale);
  const sy = Math.floor(y / scale);
  return bitmap16[sy][sx] ? ARROW : BG;
}

const outDir = path.join(__dirname, '..', 'public');

fs.writeFileSync(
  path.join(outDir, 'icon-16.png'),
  createPNG(16, 16, (x, y) => (bitmap16[y][x] ? ARROW : BG))
);

fs.writeFileSync(
  path.join(outDir, 'icon-48.png'),
  createPNG(48, 48, (x, y, w, h) => getPixelScaled(x, y, w, h, 3))
);

fs.writeFileSync(
  path.join(outDir, 'icon.png'),
  createPNG(128, 128, (x, y, w, h) => getPixelScaled(x, y, w, h, 8))
);

console.log('Icons written to public/icon-16.png, icon-48.png, icon.png');
