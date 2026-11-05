// Generate a new Reader Desktop book icon without depending on source Android artwork.
// Run with Node: node build/make-icon.cjs. build.mjs calls generate() as well.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const directory = __dirname;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 4, 'ascii');
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
  return Buffer.concat([header, data, check]);
}
function inside(x, y, vertices) {
  let result = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function pixel(x, y) {
  const edge = Math.min(x, y, 1 - x, 1 - y);
  const cornerX = Math.min(x, 1 - x), cornerY = Math.min(y, 1 - y);
  const rounded = (cornerX >= .15 || cornerY >= .15) || (cornerX - .15) ** 2 + (cornerY - .15) ** 2 < .15 ** 2;
  if (edge < 0 || !rounded) return [0, 0, 0, 0];
  let c = [30, 32, 46, 255];
  const leftBack = [[.10,.31],[.42,.36],[.49,.79],[.13,.73]];
  const rightBack = [[.51,.79],[.58,.36],[.90,.31],[.87,.73]];
  const left = [[.15,.22],[.45,.29],[.49,.75],[.14,.68]];
  const right = [[.51,.75],[.55,.29],[.85,.22],[.86,.68]];
  if (inside(x,y,leftBack) || inside(x,y,rightBack)) c = [95, 119, 175, 255];
  if (inside(x,y,left)) c = [170, 195, 252, 255];
  if (inside(x,y,right)) c = [227, 231, 255, 255];
  if (x > .488 && x < .512 && y > .28 && y < .80) c = [108, 135, 211, 255];
  // Subtle page lines on both leaves.
  if (inside(x,y,left) && y > .44 && y < .46 && x > .23 && x < .43) c = [122, 155, 225, 255];
  if (inside(x,y,right) && y > .44 && y < .46 && x > .57 && x < .77) c = [170, 184, 228, 255];
  return c;
}
function png(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      // Four subpixels approximate edge anti-aliasing.
      const colors = [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([dx,dy])=>pixel((x+dx)/size,(y+dy)/size));
      for (let i=0;i<4;i++) row[1+x*4+i] = Math.round(colors.reduce((sum,c)=>sum+c[i],0)/4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows),9)),chunk('IEND',Buffer.alloc(0))]);
}
function generate() {
  const sizes=[16,24,32,48,64,128,256];
  const images=sizes.map(png);
  const dir=Buffer.alloc(6+16*sizes.length);dir.writeUInt16LE(1,2);dir.writeUInt16LE(sizes.length,4);
  let offset=dir.length;
  images.forEach((data,i)=>{const pos=6+i*16;dir[pos]=sizes[i]%256;dir[pos+1]=sizes[i]%256;dir.writeUInt16LE(1,pos+4);dir.writeUInt16LE(32,pos+6);dir.writeUInt32LE(data.length,pos+8);dir.writeUInt32LE(offset,pos+12);offset+=data.length;});
  fs.writeFileSync(path.join(directory,'icon.ico'),Buffer.concat([dir,...images]));
  fs.writeFileSync(path.join(directory,'icon-256.png'),images[images.length-1]);
}
if (require.main === module) generate();
module.exports = generate;