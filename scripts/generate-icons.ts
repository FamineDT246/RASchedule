/**
 * Generate all app icons from a source image, removing the "transparency
 * checkerboard" pattern that AI image generators (Gemini, etc.) sometimes
 * bake in as actual pixels instead of real transparency.
 *
 * Run with: bun run scripts/generate-icons.ts
 *
 * Source: upload/Gemini_Generated_Image_amghq3amghq3amgh.png
 * Output: public/logo.png, icon-192.png, icon-512.png, apple-touch-icon.png,
 *         favicon.ico, favicon-32.png, favicon-16.png
 *
 * The checkerboard is detected by sampling corner pixels — any pixel matching
 * the two grey shades (within tolerance) AND being near-pure-grey (R≈G≈B)
 * is replaced with transparent alpha. This preserves colorful logo content.
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const SRC = 'upload/Gemini_Generated_Image_amghq3amghq3amgh.png'
const OUT = 'public'

// Tolerance for matching checkerboard greys
const COLOR_TOLERANCE = 15  // how close R/G/B must be to the target grey
const GREY_TOLERANCE = 8    // how close R, G, B must be to each other (pure grey check)

async function main() {
  const raw = readFileSync(SRC)
  const img = sharp(raw)
  const meta = await img.metadata()
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`)

  // ── Step 1: Detect the two checkerboard colours from the corner pixels ──
  // Sample a grid of pixels from each corner and find the two most common greys
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const cornerSamples: number[][] = []
  const sampleSize = 20
  for (const [cx, cy] of [[0,0], [info.width-1,0], [0,info.height-1], [info.width-1,info.height-1]]) {
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        const x = Math.min(info.width-1, Math.max(0, cx - sampleSize/2 + dx))
        const y = Math.min(info.height-1, Math.max(0, cy - sampleSize/2 + dy))
        const idx = (y * info.width + x) * 4
        cornerSamples.push([data[idx], data[idx+1], data[idx+2]])
      }
    }
  }

  // Find the two most common grey shades (cluster by rounding to nearest 25)
  const buckets = new Map<string, number[]>()
  for (const [r, g, b] of cornerSamples) {
    const isGrey = Math.abs(r-g) < GREY_TOLERANCE && Math.abs(g-b) < GREY_TOLERANCE && Math.abs(r-b) < GREY_TOLERANCE
    if (!isGrey) continue
    const key = `${Math.round(r/25)*25}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(r)
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)
  if (sorted.length < 2) {
    console.log('Could not detect checkerboard pattern — no greys found in corners')
    console.log('Generating icons without transparency removal')
    return generate(raw, meta, null, null)
  }
  const grey1 = Math.round(sorted[0][1].reduce((s, v) => s + v, 0) / sorted[0][1].length)
  const grey2 = Math.round(sorted[1][1].reduce((s, v) => s + v, 0) / sorted[1][1].length)
  console.log(`Detected checkerboard greys: ${grey1} and ${grey2}`)

  return generate(raw, meta, grey1, grey2)
}

async function generate(raw: Buffer, meta: sharp.Metadata, grey1: number | null, grey2: number | null) {
  // ── Step 2: Process the image — remove checkerboard, center-crop to square ──
  const size = Math.min(meta.width!, meta.height!)
  const left = Math.round((meta.width! - size) / 2)
  const top = Math.round((meta.height! - size) / 2)

  let pipeline = sharp(raw).extract({ left, top, width: size, height: size })

  // If we detected checkerboard greys, remove them (make transparent)
  if (grey1 !== null && grey2 !== null) {
    pipeline = pipeline.raw().ensureAlpha().toBuffer({ resolveWithObject: true }).then(async ({ data, info }) => {
      const out = Buffer.from(data)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2]
        // Check if pixel is near-pure-grey (R≈G≈B within tolerance)
        const isGrey = Math.abs(r-g) < GREY_TOLERANCE && Math.abs(g-b) < GREY_TOLERANCE && Math.abs(r-b) < GREY_TOLERANCE
        if (!isGrey) continue
        // Check if it matches either checkerboard grey
        const matchesGrey1 = Math.abs(r - grey1) < COLOR_TOLERANCE && Math.abs(g - grey1) < COLOR_TOLERANCE && Math.abs(b - grey1) < COLOR_TOLERANCE
        const matchesGrey2 = Math.abs(r - grey2) < COLOR_TOLERANCE && Math.abs(g - grey2) < COLOR_TOLERANCE && Math.abs(b - grey2) < COLOR_TOLERANCE
        if (matchesGrey1 || matchesGrey2) {
          out[i+3] = 0  // Make transparent
        }
      }
      return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    }) as any
  }

  // ── Step 3: Generate all target sizes ──
  const targets = [
    { name: 'logo.png', size: 512 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'favicon-16.png', size: 16 },
  ]

  for (const t of targets) {
    const src = grey1 !== null ? await (pipeline as any) : pipeline
    await src
      .clone()
      .resize(t.size, t.size, { fit: 'cover', position: 'center' })
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(`${OUT}/${t.name}`)
    console.log(`  ✓ ${t.name} (${t.size}x${t.size})`)
  }

  // ── Step 4: Build multi-size favicon.ico ──
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

function buildIco(images: { width: number; height: number; png: Buffer }[]): Buffer {
  const HEADER_SIZE = 6
  const ENTRY_SIZE = 16
  const count = images.length
  const offset = HEADER_SIZE + ENTRY_SIZE * count

  const header = Buffer.alloc(HEADER_SIZE)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let cursor = offset
  const entries: Buffer[] = []
  for (const img of images) {
    const entry = Buffer.alloc(ENTRY_SIZE)
    entry.writeUInt8(img.width === 256 ? 0 : img.width, 0)
    entry.writeUInt8(img.height === 256 ? 0 : img.height, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(img.png.length, 8)
    entry.writeUInt32LE(cursor, 12)
    entries.push(entry)
    cursor += img.png.length
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.png)])
}

main().catch(e => { console.error(e); process.exit(1) })
