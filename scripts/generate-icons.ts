/**
 * Generate all app icons from a source image.
 *
 * Two variants per size:
 * - Transparent (for logo.png + "any" purpose icons) — checkerboard removed
 * - Opaque (for "maskable" purpose icons) — solid background, required by PWA spec
 *
 * Run with: bun run scripts/generate-icons.ts
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const SRC = 'upload/Gemini_Generated_Image_amghq3amghq3amgh.png'
const OUT = 'public'

const COLOR_TOLERANCE = 15
const GREY_TOLERANCE = 8
const Bg_COLOR = { r: 10, g: 10, b: 10 } // #0a0a0a — matches manifest background_color

async function main() {
  const raw = readFileSync(SRC)
  const meta = await sharp(raw).metadata()
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`)

  // Detect checkerboard greys
  const { data, info } = await sharp(raw).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
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

  const buckets = new Map<string, number[]>()
  for (const [r, g, b] of cornerSamples) {
    const isGrey = Math.abs(r-g) < GREY_TOLERANCE && Math.abs(g-b) < GREY_TOLERANCE && Math.abs(r-b) < GREY_TOLERANCE
    if (!isGrey) continue
    const key = `${Math.round(r/25)*25}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(r)
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)
  const grey1 = sorted.length > 0 ? Math.round(sorted[0][1].reduce((s, v) => s + v, 0) / sorted[0][1].length) : null
  const grey2 = sorted.length > 1 ? Math.round(sorted[1][1].reduce((s, v) => s + v, 0) / sorted[1][1].length) : null
  console.log(`Detected checkerboard greys: ${grey1} and ${grey2}`)

  // Center-crop to square
  const size = Math.min(meta.width!, meta.height!)
  const left = Math.round((meta.width! - size) / 2)
  const top = Math.round((meta.height! - size) / 2)
  const cropped = sharp(raw).extract({ left, top, width: size, height: size })

  // Build transparent version (checkerboard removed → alpha=0)
  const transparentBuffer = await removeCheckerboard(cropped, grey1, grey2)

  // Build opaque version (checkerboard replaced with solid background color)
  const opaqueBuffer = await replaceCheckerboardWithBg(cropped, grey1, grey2)

  // ── Generate all target sizes ──
  // Transparent icons (for UI + "any" purpose)
  const transparentTargets = [
    { name: 'logo.png', size: 512 },           // in-app header logo
    { name: 'icon-any-192.png', size: 192 },    // PWA "any" purpose
    { name: 'icon-any-512.png', size: 512 },    // PWA "any" purpose
    { name: 'apple-touch-icon.png', size: 180 }, // iOS (opaque on iOS, but keep transparent for consistency)
    { name: 'favicon-32.png', size: 32 },
    { name: 'favicon-16.png', size: 16 },
  ]

  // Opaque icons (for "maskable" purpose — must be fully opaque)
  const opaqueTargets = [
    { name: 'icon-maskable-192.png', size: 192 },
    { name: 'icon-maskable-512.png', size: 512 },
  ]

  console.log('\nTransparent icons:')
  for (const t of transparentTargets) {
    await sharp(transparentBuffer)
      .resize(t.size, t.size, { fit: 'cover', position: 'center' })
      .png({ palette: false, compressionLevel: 9 })  // force RGBA, not palette
      .toFile(`${OUT}/${t.name}`)
    console.log(`  ✓ ${t.name} (${t.size}x${t.size})`)
  }

  console.log('\nOpaque (maskable) icons:')
  for (const t of opaqueTargets) {
    await sharp(opaqueBuffer)
      .resize(t.size, t.size, { fit: 'cover', position: 'center' })
      .png({ palette: false, compressionLevel: 9 })  // force RGBA
      .flatten({ background: `rgb(${Bg_COLOR.r},${Bg_COLOR.g},${Bg_COLOR.b})` }) // ensure no alpha
      .toFile(`${OUT}/${t.name}`)
    console.log(`  ✓ ${t.name} (${t.size}x${t.size})`)
  }

  // Also generate the legacy-named icons for backward compat
  // icon-192.png and icon-512.png → use the opaque (maskable) versions
  // since the manifest references them for "any maskable" purpose
  await sharp(opaqueBuffer).resize(192, 192, { fit: 'cover' }).png({ palette: false }).flatten({ background: `rgb(${Bg_COLOR.r},${Bg_COLOR.g},${Bg_COLOR.b})` }).toFile(`${OUT}/icon-192.png`)
  await sharp(opaqueBuffer).resize(512, 512, { fit: 'cover' }).png({ palette: false }).flatten({ background: `rgb(${Bg_COLOR.r},${Bg_COLOR.g},${Bg_COLOR.b})` }).toFile(`${OUT}/icon-512.png`)
  console.log('  ✓ icon-192.png (opaque, for backward compat)')
  console.log('  ✓ icon-512.png (opaque, for backward compat)')

  // Build favicon.ico
  const png32 = readFileSync(`${OUT}/favicon-32.png`)
  const png16 = readFileSync(`${OUT}/favicon-16.png`)
  const ico = buildIco([
    { width: 32, height: 32, png: png32 },
    { width: 16, height: 16, png: png16 },
  ])
  writeFileSync(`${OUT}/favicon.ico`, ico)
  console.log('  ✓ favicon.ico')

  console.log('\n✓ All icons generated.')
}

async function removeCheckerboard(cropped: sharp.Sharp, grey1: number | null, grey2: number | null): Promise<Buffer> {
  if (grey1 === null || grey2 === null) {
    return cropped.raw().ensureAlpha().png().toBuffer()
  }
  const { data, info } = await cropped.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2]
    const isGrey = Math.abs(r-g) < GREY_TOLERANCE && Math.abs(g-b) < GREY_TOLERANCE && Math.abs(r-b) < GREY_TOLERANCE
    if (!isGrey) continue
    const m1 = Math.abs(r-grey1) < COLOR_TOLERANCE && Math.abs(g-grey1) < COLOR_TOLERANCE && Math.abs(b-grey1) < COLOR_TOLERANCE
    const m2 = Math.abs(r-grey2) < COLOR_TOLERANCE && Math.abs(g-grey2) < COLOR_TOLERANCE && Math.abs(b-grey2) < COLOR_TOLERANCE
    if (m1 || m2) out[i+3] = 0
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

async function replaceCheckerboardWithBg(cropped: sharp.Sharp, grey1: number | null, grey2: number | null): Promise<Buffer> {
  if (grey1 === null || grey2 === null) {
    return cropped.flatten({ background: `rgb(${Bg_COLOR.r},${Bg_COLOR.g},${Bg_COLOR.b})` }).png().toBuffer()
  }
  const { data, info } = await cropped.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2]
    const isGrey = Math.abs(r-g) < GREY_TOLERANCE && Math.abs(g-b) < GREY_TOLERANCE && Math.abs(r-b) < GREY_TOLERANCE
    if (!isGrey) continue
    const m1 = Math.abs(r-grey1) < COLOR_TOLERANCE && Math.abs(g-grey1) < COLOR_TOLERANCE && Math.abs(b-grey1) < COLOR_TOLERANCE
    const m2 = Math.abs(r-grey2) < COLOR_TOLERANCE && Math.abs(g-grey2) < COLOR_TOLERANCE && Math.abs(b-grey2) < COLOR_TOLERANCE
    if (m1 || m2) {
      out[i] = Bg_COLOR.r
      out[i+1] = Bg_COLOR.g
      out[i+2] = Bg_COLOR.b
      out[i+3] = 255 // fully opaque
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
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
