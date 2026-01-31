import fs from 'fs'
import path from 'path'
import Jimp from 'jimp'
import pngToIco from 'png-to-ico'

async function ensureDir(p){
  await fs.promises.mkdir(p, { recursive: true })
}

async function main(){
  const root = process.cwd()
  const publicDir = path.resolve(root, 'public')
  const pngPath = path.join(publicDir, 'hospital_icon.png')
  const icoPath = path.join(publicDir, 'hospital_icon.ico')

  await ensureDir(publicDir)

  // If ICO already exists, skip
  try {
    await fs.promises.access(icoPath)
    console.log('Icon already exists:', icoPath)
    return
  } catch {}

  // Create a simple 256x256 PNG icon (purple background with white H)
  const size = 256
  const img = await new Jimp(size, size, '#4f46e5') // violet-700
  try {
    const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE)
    img.print(
      font,
      0,
      Math.floor((size - 128) / 2),
      { text: 'H', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE },
      size,
      128
    )
  } catch {}

  await img.writeAsync(pngPath)

  const icoBuffer = await pngToIco([pngPath])
  await fs.promises.writeFile(icoPath, icoBuffer)
  console.log('Generated icon at', icoPath)
}

main().catch(err => { console.error(err); process.exit(1) })
