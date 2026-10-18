# ImageCraft – development notes

How ImageCraft is built and what to keep in mind when changing it. For what it does and how to use it, see [README.md](README.md).

## How it is built

- **No build step.** `index.html` loads `fonts/fonts.css`, `css/imagecraft.css` and the scripts in order: `js/craft-titlebar.js`, `js/range-type.js`, `lib/imagetracer.js`, `js/tracer.js`, `js/craft-ai.js`, `js/bgremove.js`, `js/formats.js`, `js/colour.js`, `js/filters.js`, `js/ascii.js`, `js/ui.js`.
- Works from `file://`: nothing is fetched from the app's own folder (the AI library is a classic script loaded with a `<script>` tag when first needed).
- **Shared parts are copies:** the title bar and ribbon (`craft-titlebar.js`), the slider number boxes (`range-type.js`), the tracer, the background remover and the AI helpers started from the other Craft apps' copies and are changed here on their own; changes are not copied between apps.
- `lib/craft-ai-libs.js` is the same Transformers.js 3.8.1 bundle as 3DCraft's (it exports `pipeline`, which the upscalers use as `image-to-image`).

## Files

| File | What is in it |
| --- | --- |
| `js/formats.js` (`IC.formats`) | `read(file)` → `{ img: ImageData, info: { format, bits, colours, note } }`, `write(img, fmt, opts)` → Blob, `FORMATS` (name, ext, group, depths, fit, levels, palette/cells rules, writer), `indexed`, `countColours`, `zip`, `crc32`. |
| `js/colour.js` (`IC.colour`) | `reduce(img, opts)`, `quantize` (median cut on a 5-bit histogram + 4 k-means rounds, optional snapping to a hardware grid), `PALETTES`, `DITHERS`, `mapPixels` (error diffusion, serpentine, or ordered/noise), `zxCells`, `c64Cells`, `LOOKS` and `look(img, id, { keep, fit, dither })`, `colours(img)`. |
| `js/filters.js` (`IC.filters`) | Pure functions picture → picture: light, colour, autoLevels, autoFix, whiteBalance, greyscale, sepia, invert, threshold, posterize, blur (3 box passes), sharpen (unsharp mask with threshold), denoise (bilateral), median, despeckle, deblock, undither, pixelate, resize (halving steps for big shrinks; nearest; Scale2x/3x; smooth pixel art), rotate, rotate90, flip, crop, trimBox, canvasSize, makeClear, flatten. |
| `js/ascii.js` (`IC.ascii`) | `make(img, opts)` → character cells (chars / shade / halfblock modes), `text`, `ansi` (cp437 with SAUCE, or UTF-8 with 16/256/true colour), `html`, `render` (8 × 16 cells on a canvas). |
| `js/ui.js` | Pictures and steps, the view (zoom, pan, compare split, pixel grid, crop box), the tool panel (built from short field lists in `TOOLS`), Save as, Batch convert, samples, help, theme, ribbon, menus, title bar, keyboard. `window.ImageCraft` exposes the same actions for testing and the command layer. |

## Model

- A picture: `{ name, info, size, steps: [{ label, img: ImageData, colours? }], at, dirty }`. Steps keep whole pictures (simple and exact); at most 24 (the oldest after the original is dropped).
- A tool: `{ title, icon, s (settings, or a function of the picture), fields, run(img, s, say) → ImageData | Promise, live (bool or function of s), pick(s, rgb, u, v), change(s, key, img), report(preview) → html, enter/leave, applyLabel }`. Live tools re-run 140 ms after a change (320 ms for pictures over 2 MP); a token drops stale results. Apply pushes the preview as a step.
- Field types: range, num, select, seg, check, colour, swatch, note, btns, row, out (the tool's report), looks (the computer-look tiles).

## Formats: details worth knowing

- **PNG** is written here (CompressionStream 'deflate' = zlib) so it can be indexed at 1/2/4/8 bits with tRNS; true colour rows use filter 1 (sub).
- **GIF** LZW: code size grows when the code being added equals 1 << size; a clear code at 4096.
- **BMP** 16-bit is 5-6-5 with BITMAPV4 masks; 32-bit has an alpha mask; reading handles BI_RGB and BI_BITFIELDS (RLE BMPs go to the browser).
- **IFF**: ByteRun1, interleaved planes, mask plane skipped, HAM6/HAM8, EHB (palette halves), PBM chunky; writing uses mask type 2 (transparent colour) when there is see-through.
- **Atari ST**: palette words 0x0RGB; STE files set the extra (top) bit of a nibble for the low step. Writing uses plain 3-bit words when every colour is on the ST's 8 levels, STE nibbles otherwise. Degas Elite (PC1–3) lines are packed plane by plane and re-interleaved into 16-pixel word groups. High resolution: 1 = black.
- **Koala**: 2-byte load address, bitmap (40 × 25 cells × 8 bytes), screen RAM (two colours in nibbles), colour RAM, background; read as 320 × 200 with doubled pixels.
- **ZX Spectrum**: the famous third/row/line address order (`zxAddr`), attributes `flash bright paper ink`.
- **TIFF** reading: strips, none/PackBits/LZW (MSB, early change)/Deflate, horizontal predictor, grey/RGB/palette, 1–16 bits; tiles and JPEG-in-TIFF give a message. Writing: uncompressed RGB(A).
- Formats without see-through (and 24-bit PNG/TIFF, BMP below 32, TGA below 32) are filled with the chosen colour first (`noClear` in ui.js).

## Testing

- Headless Chrome over the DevTools protocol, loading `index.html` from `file://`. Round trip: every format and depth written and read back from the samples (lossless formats must match exactly).
- Click through the real ribbon buttons and tool panels; check for page errors.

## Ideas noted

- **Touch-up tools** (retouching by hand: brush, clone, heal, erase): wanted, but how they should work is still to be decided — talk first.
- Animated GIF frames (open, save), more classic formats (Spectrum 512, Amiga HAM writing, C64 Art Studio, MSX, Apple IIgs), colour cycling preview, 16-bit-per-channel PNG.
