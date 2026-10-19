# ImageCraft – development notes

How ImageCraft is built and what to keep in mind when changing it. For what it does and how to use it, see [README.md](README.md).

## How it is built

- **Debug log:** `js/debug.js` loads first (`window.ICLOG`): page errors, failed promises, console errors and warnings, messages shown to the user, tools run (with timings and settings), files opened and saved, AI model load failures. Last 300 kept in localStorage; the Debug tab (left panel) shows, copies and saves it with the browser and computer at the top; a red error count in the status bar opens it.
- **Gotcha:** current Chrome gives every `File`/`Blob` a `.bytes()` method, so never test `file.bytes` to tell a File from a `{ name, bytes }` object (`formats.read` checks `instanceof Blob`).
- **AI on the graphics card:** the Swin2SR upscalers fail in fp16 on WebGPU (an error number thrown from inside ONNX Runtime), and a failed WebGPU load leaves the runtime unable to load the processor version afterwards; they are set to fp32 on the graphics card (`gpuDtype`), where a 152-pixel tile took 1.4 s against 22.5 s on the processor (Nvidia Lovelace). Tiles are 160 pixels, overlapping by 24 and faded into each other (weights ramp over the overlap); only the tile's own part of the model's (padded) output is used, at exactly the model's scale.
- **Real-ESRGAN** (`esrgan`, `esrgan2` in craft-ai.js): plain ONNX files (SceneWorks/real-esrgan-onnx, RRDBNet x4plus / x2plus, input [1,3,h,w] RGB 0–1, dynamic size), run with ONNX Runtime directly on WebGPU (or wasm), through the same overlapping tiles. On the test it was much crisper than Swin2SR's real-world model and removed JPEG blocks; fine texture (skin, gravel) comes out a little smooth, which the AI strength slider tempers. Modernise uses it for photos and JPEGs.
- **Previewing in the app's browser pane:** serve with a no-cache server (the plain Python server let the pane keep old scripts).
- **No build step.** `index.html` loads `fonts/fonts.css`, `css/imagecraft.css` and the scripts in order: `js/craft-titlebar.js`, `js/range-type.js`, `lib/imagetracer.js`, `js/tracer.js`, `js/craft-ai.js`, `js/bgremove.js`, `js/formats.js`, `js/resample.js`, `js/restore.js`, `js/colour.js`, `js/filters.js`, `js/ascii.js`, `js/ui.js`.
- Works from `file://`: nothing is fetched from the app's own folder (the AI library is a classic script loaded with a `<script>` tag when first needed).
- **Shared parts are copies:** the title bar and ribbon (`craft-titlebar.js`), the slider number boxes (`range-type.js`), the tracer, the background remover and the AI helpers started from the other Craft apps' copies and are changed here on their own; changes are not copied between apps.
- `lib/craft-ai-libs.js` is the same Transformers.js 3.8.1 bundle as 3DCraft's (it exports `pipeline`, which the upscalers use as `image-to-image`).

## Files

| File | What is in it |
| --- | --- |
| `js/formats.js` (`IC.formats`) | `read(file)` → `{ img: ImageData, info: { format, bits, colours, note } }`, `write(img, fmt, opts)` → Blob, `FORMATS` (name, ext, group, depths, fit, levels, palette/cells rules, writer), `indexed`, `countColours`, `zip`, `crc32`. |
| `js/colour.js` (`IC.colour`) | `reduce(img, opts)`, `quantize` (median cut on a 5-bit histogram + 4 k-means rounds, optional snapping to a hardware grid), `PALETTES`, `DITHERS`, `mapPixels` (error diffusion, serpentine, or ordered/noise), `zxCells`, `c64Cells`, `LOOKS` and `look(img, id, { keep, fit, dither })`, `colours(img)`. |
| `js/filters.js` (`IC.filters`) | Pure functions picture → picture: light, colour, autoLevels, autoFix, whiteBalance, greyscale, sepia, invert, threshold, posterize, blur (3 box passes), sharpen (unsharp mask with threshold), denoise (bilateral), median, despeckle, deblock, undither, pixelate, resize (halving steps for big shrinks; nearest; Scale2x/3x; smooth pixel art), rotate, rotate90, flip, crop, trimBox, canvasSize, makeClear, flatten. |
| `js/resample.js` (`IC.resample`) | `resize(img, W, H, { method, linear })`: separable two-pass resampling in Float32, premultiplied alpha, linear light (sRGB LUTs). Kernels: Catmull-Rom, Mitchell (B = C = ⅓), Lanczos 3, linear, widened by the shrink factor so shrinking averages; 'area' = exact coverage weights (both ways); 'nohalo' = Lanczos clamped to the min/max of the 2 × 2 source pixels around each output; 'auto' = nohalo up, Mitchell down. `filters.resize` uses it up to 60 MP, the browser's scaling above. |
| `js/restore.js` (`IC.restore`) | Radix-2 FFT (`fft`, `fft2`); `psfTaps` (Gaussian, disk, motion line); `deblur` = Wiener + gradient prior (`F = conj(H)G / (|H|² + K + λ|∇|²)`), linear light, 384-pixel tiles with mirrored padding, then clamped to the local min/max (radius from the blur) with a relative margin; `deblurCareful` = half-quadratic-splitting plug-and-play (FFT solve with μ, then `nlm`; μ 0.25 → ×0.3, denoiser σ 1.6σn → ×0.4 over 6 rounds; whole picture up to 2048² FFT); `nlm` = non-local means in YCbCr with separate luma/chroma strengths, integral-image patch distances; `clahe`; `measure` (10–90% edge width → Gaussian σ); `noiseLevel` (Immerkær, strong edges left out); `noiseMap`; `blurWith` (the forward model, for tests). |
| (colour and detail in `filters.js`) | `autoColour` (per-channel levels at 0.3% clip; midtone gammas from near-grey midtones so their log means match; skin protection: warm skin-like pixels must keep r > g > b after the curves, else the gammas are eased in steps; toned pictures (little colour variation) keep their tone and get shared levels; faded saturation brought back toward an average of 0.22), `clarity` (luminance minus a wide blur, weighted 4m(1−m) toward the midtones, applied as a brightness ratio so colours do not shift). `shadowRecover` (log luminance split by a self-guided filter, radius 2% of the size, eps 0.08; the base pulled toward its median below it, gently down above it; gain limited; applied to linear light so hues hold). Skin protection uses a common RGB skin rule and needs 85% of skin pixels to stay warm; it eases the whole correction (levels and curves) toward one shared stretch, because on a print that lost its blue the per-colour levels, not the curves, cool the skin. Foliage protection keeps plainly green pixels green. Toned or colour: `hueSpread` = share of coloured midtone pixels (40 < max < 205, chroma > 10) more than 60° from the circular-mean hue; under 1% toned, 10%+ colour, graded between (the colour correction is blended with one shared stretch). The old colour-variance test called faded colour prints toned. `dehaze`: dark channel (min over a square 1% of the size), veil colour from the brightest of the 0.1% thickest places (grey for toned pictures), t = 1 − 0.95·s·dark(I/A) refined with a guided filter on luminance, floor 0.1–0.4. Restore old photo: specks, NLM (measured), gentle deblur (measured), dehaze when the dark channel averages over 0.22, shadow recovery, auto colour (tone decided on the original), clarity. |
| (more in `filters.js`) | `aliasCheck` (structure-tensor edge direction over a window; a slanted edge pixel is jagged when it differs from the average of its neighbours along the edge by over 22% of the local contrast), `antialias` (blend with bilinear samples along the edge, reach 2–4 from the check), `pyramidBlend(a, b, mask, levels)` (Laplacian pyramids, binomial down, bilinear up). |
| (more in `restore.js`) | `impulse` (decision-based adaptive median after AMF + MDBMF: specks = isolated pure black/white pixels, or 3 × 3 outliers beyond all but one neighbour by `threshold`; above 4% pure black/white the picture is treated as salt and pepper; repair = median of clean pixels in a window growing 3 → 11). |
| `snapShapes(svg)` in ui.js | Traced paths with one outline: 64 points evenly by length; ellipse fit from their spread (PCA, radius √(2λ)); mean \|r − 1\| < 0.045 → `<circle>` / `<ellipse>`; otherwise Douglas–Peucker (tolerance 0.12 √λ₁, loop split at the farthest point) → `<polygon>` when 3–8 corners. Remaster traces a smoothly enlarged copy (~900 px) and keeps every colour when the picture has 16 or fewer. |
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

## Restoration: what was measured

On a test picture (sunset, pixel sprite, text and thin lines) blurred with a Gaussian (σ 1.6) plus noise (σ ≈ 7): blurred and noisy 23.9 dB PSNR; bilateral 24.4; non-local means 24.4; NLM then Deblur 26.2; Careful (plug-and-play) 27.2. Noise measured 6.4 (clean picture: 0.2). Blur measured 2.2 for σ 1.6 with noise, 2.75 for σ 2.5 without. Resampling: 0 overshoot pixels with no-halo against 528 with plain Lanczos on a hard edge; a black-and-white checker shrunk averages to 188 in linear light (the grey it looks like), 127–128 the usual way.

Sources read for ideas (no code taken): GIMP's documentation on its interpolation methods (linear light, LoHalo/NoHalo); Zisserman's Oxford lecture on image restoration (inverse and Wiener filters, MAP with a gradient prior, super-resolution, blind deblurring); Imatest on noise images (averaging frames, noise maps); Zhang and Timofte on plug-and-play restoration; Berisha and Nagy on iterative methods (boundary conditions, non-negativity); a survey of restoration techniques (Maru and Parikh, 2017); an article on white balancing (white patch, grey world, ground truth).

More measured: salt and pepper 10% / 30% / 60%: plain median 32.3 / 22.6 / 11.7 dB, Smart specks 34.3 / 29.4 / 17.1; grey dust 3%: 34.7 → 35.6; a clean picture is left at 40.6 dB (almost untouched). Shrinking (zone plate 1024 → 256, against the ideal): browser 24.1 dB (moiré 15.7), area 24.1, Mitchell 31.1, binomial 26.7 (moiré 2.4, but soft), Lanczos widened 1.25× and clamped to each footprint's min/max (now 'auto') 34.8 (moiré 2.9) with no halo at hard edges (plain Lanczos rang 40 levels into black in linear light). Overscale-then-shrink (the user's trick): no change for linear methods; for pixel art Scale2x overscaled 31.1 dB against Scale3x 30.3.

Jagged edges: a hard-edged drawing 30% jagged, the same drawn with 16× supersampling 6%, after smoothing 0%, and 1.8 dB closer to the supersampled drawing.

More sources: a hybrid adaptive / decision-based median filter paper (Scientific Reports); Torralba, Isola and Freeman, *Foundations of Computer Vision* (sampling and aliasing, image pyramids). The user's idea: recognise shapes, remaster them as an overlay, blend the two (Remaster shapes).

## Testing

- Headless Chrome over the DevTools protocol, loading `index.html` from `file://`. Round trip: every format and depth written and read back from the samples (lossless formats must match exactly).
- Click through the real ribbon buttons and tool panels; check for page errors.

## Ideas noted

- **Touch-up tools** (retouching by hand: brush, clone, heal, erase): wanted, but how they should work is still to be decided — talk first.
- **Colourise (AI)**: a colourisation model (DDColor, Apache-2.0, ONNX) would keep every pixel's brightness and only add colour (labelled as colourised). Asked the user before adding.
- **Ask box (WebLLM)**: the user's in-browser LLM could choose tools and settings from a description of the picture and its damage, through the same command layer.
- **Combine photos**: several shots of the same scene lined up by phase correlation (FFT), then averaged (noise falls by √N), median (moving things drop out) or super-resolution (shift-and-add on a 2× grid).
- Fourier pattern removal (halftone dots and paper texture on scanned prints); total variation smoothing; colourising and face repair with AI (talk first: model licences).
- Animated GIF frames (open, save), more classic formats (Spectrum 512, Amiga HAM writing, C64 Art Studio, MSX, Apple IIgs), colour cycling preview, 16-bit-per-channel PNG.
