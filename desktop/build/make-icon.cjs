// Run with Electron: electron build/make-icon.cjs
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app
  .whenReady()
  .then(() => {
    const original = nativeImage.createFromPath(
      path.join(
        __dirname,
        '../vendor/lnreader/assets/native/ic_launcher.png',
      ),
    );
    if (original.isEmpty()) throw new Error('Original icon not found');
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = sizes.map(size =>
      original.resize({ width: size, height: size, quality: 'best' }).toPNG(),
    );
    const directory = Buffer.alloc(6 + 16 * sizes.length);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(sizes.length, 4);
    let offset = directory.length;
    images.forEach((png, index) => {
      const entry = 6 + index * 16;
      directory[entry] = sizes[index] % 256;
      directory[entry + 1] = sizes[index] % 256;
      directory.writeUInt16LE(1, entry + 4);
      directory.writeUInt16LE(32, entry + 6);
      directory.writeUInt32LE(png.length, entry + 8);
      directory.writeUInt32LE(offset, entry + 12);
      offset += png.length;
    });
    fs.writeFileSync(
      path.join(__dirname, 'icon.ico'),
      Buffer.concat([directory, ...images]),
    );
    fs.writeFileSync(path.join(__dirname, 'icon-256.png'), images.at(-1));
    console.log(
      'PASS: original LNReader release icon, seven Windows resolutions.',
    );
    app.exit(0);
  })
  .catch(error => {
    console.error(error);
    app.exit(1);
  });
