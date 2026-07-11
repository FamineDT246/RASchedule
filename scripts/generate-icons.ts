/**
 * Generate all app icons from a source image.
 * Run with: bun run scripts/generate-icons.ts
 *
 * Reads:  upload/Gemini_Generated_Image_cmlfrfcmlfrfcmlf.png (2816x1536 landscape)
 * Writes: public/logo.png, public/icon-192.png, public/icon-512.png,
 *         public/apple-touch-icon.png, public/favicon-32.png, public/favicon-16.png
 *
 * Source is center-cropped to square (1536x1536) then resized to each target.
 * Filenames use a v2 suffix so already-installed PWAs re-fetch (cache bust).
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'

const SRC = 'upload/Gemini_Generated_Image_cmlfrfcmlfrfcmlf.png'
const OUT = 'public'

async function main() {
  const img = sharp(readFileSync(SRC))
  const meta = await img.metadata()
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`)

  // Center-crop to square (smallest dimension)
  const size = Math.min(meta.width!, meta.height!)
  const left = Math.round(((meta.width! - size) / 2))
  const top = Math.round(((meta.height! - size) / 2))
  const square = sharp(readFileSync(SRC)).extract({ left, top, width: size, height: size })

  // Generate all the sizes
  const targets = [
    { name: 'logo.png', size: 512 },              // Header logo (used as h-8 w-8)
    { name: 'icon-192.png', size: 192 },           // PWA icon
    { name: 'icon-512.png', size: 512 },           // PWA icon
    { name: 'apple-touch-icon.png', size: 180 },   // iOS home screen
    { name: 'favicon-32.png', size: 32 },          // Browser tab favicon
    { name: 'favicon-16.png', size: 16 },          // Browser tab favicon (small)
  ]

  for (const t of targets) {
    await square
      .clone()
      .resize(t.size, t.size, { fit: 'cover', position: 'center' })
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(`${OUT}/${t.name}`)
    console.log(`  ✓ ${t.name} (${t.size}x${t.size})`)
  }

  // Build a multi-size favicon.ico from the 32 and 16 PNGs
  // ICO format: header (6 bytes) + N entries (16 bytes each) + N image blobs
  const png32 = readFileSync(`${OUT}/favicon-32.png`)
  const png16 = readFileSync(`${OUT}/favicon-16.png`)
  const ico = buildIco([
    { width: 32, height: 32, png: png32 },
    { width: 16, height: 16, png: png16 },
  ])
  writeFileSync(`${OUT}/favicon.ico`, ico)
  console.log('  ✓ favicon.ico (multi-size: 32x32, 16x16)')

  console.log('\n✓ All icons generated.')
}

/** Build a Windows .ico file containing multiple PNG-encoded images. */
function buildIco(images: { width: number; height: number; png: Buffer }[]): Buffer {
  const HEADER_SIZE = 6
  const ENTRY_SIZE = 16
  const count = images.length
  const offset = HEADER_SIZE + ENTRY_SIZE * count

  // Header: reserved(2)=0, type(2)=1, count(2)
  const header = Buffer.alloc(HEADER_SIZE)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let cursor = offset
  const entries: Buffer[] = []
  for (const img of images) {
    const entry = Buffer.alloc(ENTRY_SIZE)
    entry.writeUInt8(img.width === 256 ? 0 : img.width, 0)   // width (0 = 256)
    entry.writeUInt8(img.height === 256 ? 0 : img.height, 1) // height
    entry.writeUInt8(0, 2)  // color palette count (0 = no palette)
    entry.writeUInt8(0, 3)  // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(img.png.length, 8) // image size
    entry.writeUInt32LE(cursor, 12) // image offset
    entries.push(entry)
    cursor += img.png.length
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.png)])
}

main().catch(e => { console.error(e); process.exit(1) })
