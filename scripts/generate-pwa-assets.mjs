import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Static assets are available before JavaScript or authentication runs.
// Regenerate with `npm run pwa:assets` after changing the logo or screen list.
const root = new URL("../", import.meta.url);
const background = "#fbf4e7";
const logo = fileURLToPath(new URL("public/logo.png", root));
const screens = JSON.parse(await readFile(new URL("lib/pwa/apple-screens.json", root), "utf8"));
const output = new URL("public/splash/", root);
await mkdir(output, { recursive: true });

for (const { width, height, scale } of screens) {
  const mark = await sharp(logo).resize(128 * scale, 128 * scale).toBuffer();
  for (const orientation of ["portrait", "landscape"]) {
    const pixelWidth = (orientation === "portrait" ? width : height) * scale;
    const pixelHeight = (orientation === "portrait" ? height : width) * scale;
    await sharp({ create: { width: pixelWidth, height: pixelHeight, channels: 3, background } })
      .composite([{ input: mark, gravity: "centre" }])
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toFile(fileURLToPath(new URL(`${pixelWidth}x${pixelHeight}.png`, output)));
  }
}

// iOS expects an opaque icon; leave corner rounding to the operating system.
await sharp(logo).resize(140, 140).flatten({ background })
  .extend({ top: 20, bottom: 20, left: 20, right: 20, background })
  .png().toFile(fileURLToPath(new URL("app/apple-icon.png", root)));

console.log(`Generated ${screens.length * 2} iPhone/iPad launch images and the Apple icon.`);
