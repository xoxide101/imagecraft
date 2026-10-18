# ImageCraft

Convert pictures between formats old and new, change their colour depth, clean up and modernise classic pictures, take backgrounds away, make pictures bigger, and turn them into SVG outlines or ASCII and ANSI art.

It runs in your browser, on your own computer: open `index.html` (no install, no account, nothing uploaded). The optional AI tools download their models once and then work offline too.

## Getting started

1. Open `index.html` in Chrome, Edge or Firefox.
2. Open pictures (Home › Open), drop them on the middle, or paste one. Or try a sample: a noisy photo, pixel art, or an old 16-colour screen.
3. Pick a tool on the ribbon. Its settings appear on the right with a live preview. Tick **Compare** and drag the line to see before and after; **Apply** makes it a step.
4. **Save as** (Ctrl+S): choose a format and colour depth, and see exactly how the file will look and how big it will be.

Every change is a step in **History** (left panel): click any step to go back to it, or undo with Ctrl+Z. Nothing changes your file until you save.

## What it does

### Formats

| | Opens | Saves |
| --- | --- | --- |
| Everyday | PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, SVG, TIFF | PNG (1, 2, 4, 8, 24 or 32-bit), JPEG, WebP, GIF, BMP (1, 4, 8, 16, 24, 32-bit), TIFF, ICO (all sizes 16–256), PDF |
| Classic | TGA, PCX, IFF ILBM and PBM (Amiga Deluxe Paint, including HAM and Extra Half-Brite), Degas and Degas Elite (Atari ST), NEOchrome, Koala Painter (C64), ZX Spectrum screens, MacPaint, PBM / PGM / PPM | TGA (8, 16, 24, 32-bit), PCX (1, 4, 8, 24-bit), IFF ILBM (2 to 256 colours, or 24-bit), Degas low / medium / high, NEOchrome, Koala Painter, ZX Spectrum screen, MacPaint, PBM / PGM / PPM |
| Vector and text | | SVG (smooth outlines, or exact squares for pixel art), text (.txt), ANSI art (.ans), web page (.html) |

Classic formats fit the picture to that machine's screen and colours for you (the Atari ST's palette of 512, the C64's colours four to a square, the ZX Spectrum's two to a square).

**Batch convert** saves every open picture at once into a ZIP, in any format, with an optional size limit.

### Colours

- **Colour depth**: 1, 2, 3, 4, 5, 6, 7 or 8 bits (2 to 256 colours), or high colour (15 and 16 bits); greys only if you like.
- **Palettes**: the best colours for the picture, or a classic one: black and white, greys, CGA, EGA, Windows 16, web-safe, C64, ZX Spectrum, Amstrad CPC, Game Boy, Apple II, Macintosh, PICO-8, Teletext. Colours can also be chosen from an old computer's range (Atari ST 512, Amiga / STE 4,096, EGA 64, VGA 262,144).
- **Dithering**: Floyd–Steinberg, Atkinson, Jarvis, Stucki, Burkes, Sierra, Sierra Lite, ordered 2 × 2 / 4 × 4 / 8 × 8, and noise, with a strength slider.
- **Computer looks**: Atari ST, Amiga, Commodore 64, ZX Spectrum, Amstrad CPC, CGA, EGA, VGA, Macintosh, Game Boy, Apple II, PICO-8 and Teletext, at the real screen size (with tall or wide pixels where the machine had them) or kept at your picture's size.

### Restore old photos

- **Restore old photo** (Clean up tab): one click. It measures the picture's noise and blur, then takes out dust, removes grain and colour blotches, gently undoes blur, fixes a colour cast (only nearly-grey things are made neutral, so a sunset stays warm), levels and brings back faded detail.
- **Remove noise**: non-local means. Each pixel is averaged with others nearby whose surroundings look alike, so texture and edges stay while grain goes; grain and colour blotches are handled separately. It opens already set to the noise measured in the picture.
- **Deblur**: undoes soft focus, out of focus or camera shake. A degraded picture is the sharp one spread by a blur plus noise (*g = h ∗ f + n*); Deblur inverts that with a Wiener filter plus a gradient prior, with mirrored edges and no halos. **Measure the blur** reads the blur size from the picture's sharpest edges. **Careful** alternates undoing the blur with removing noise (plug-and-play restoration): slower, cleaner on grainy pictures.
- **Faded detail**: adaptive histogram equalisation (CLAHE), each area of the picture getting its own contrast back.
- **Fix a colour cast**: greys to grey, average to grey (grey world), brightest to white (white patch), or click something white.
- **Where the noise is**: a noise map, which also shows whether a picture was already smoothed and sharpened.

### Clean up and modernise

- **Smooth out noise** (edges stay sharp), **Dust and scratches**, **Remove JPEG blocks**, **Undither** (blends dithering dots back into smooth colour).
- **Make bigger** and **Resize**: Best (sharp edges without halos), Pixel averaging (every pixel counted by how much it covers), Lanczos, Cubic, Soft (Mitchell), Linear, square pixels, Scale2x and Scale3x for pixel art, smooth pixel art (grown with Scale2x and averaged back down), or **AI upscaling** (2× for clean pictures, 4× for old photos, 4× JPEG clean-up) with an AI strength slider that mixes in the classic enlargement. Averaging is done in linear light, as light really adds up, so fine detail and edges keep their brightness.
- **Modernise** in one go: pixel art, a dithered screen, an old photo or scan, or a blocky JPEG.
- **Remove background**: by colour from the edges (click leftovers to take them too), or an **AI cut-out** for photos. Make a colour see-through, or fill see-through parts.

### Adjust and image

Auto fix, auto levels, brightness, contrast, midtones, shadows and highlights; saturation, vibrance, hue, warmth and tint; fix a colour cast; greyscale, sepia, invert, threshold, posterize; sharpen, blur, pixelate. Resize, crop (with shapes and Trim plain borders), canvas size, turn, flip and straighten.

### SVG and text art

- **SVG outlines**: a picture traced into smooth filled outlines (best match or 2–32 colours), or exact squares for pixel art.
- **Text art**: ASCII characters (several sets, including Braille dots), shaded blocks ░▒▓█ or half blocks ▀ (two pixels in each character), plain or with ANSI colour (16, 256 or true colour), for a dark screen or white paper. Save as text, a classic .ANS file (DOS characters, 16 colours, with a SAUCE record) for ANSI viewers and BBSes, ANSI for today's terminals, or a web page.

### AI helpers

Small AI models that run inside the browser, on the graphics card if there is one: the background cut-out (U²-Net, or BEN2 for finer edges), object picking (SlimSAM) and upscaling (Swin2SR). Each downloads once from Hugging Face when first used (or with Download now in Convert › AI helpers) and is kept by the browser for offline use. The computer is checked automatically.

## Keyboard shortcuts

| Keys | Does |
| --- | --- |
| Ctrl+O | Open |
| Ctrl+S | Save as |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+C / Ctrl+V | Copy the picture / paste one in |
| + / − | Zoom in / out |
| 0 / 1 | Fit / 100% |
| Enter / Esc | Apply / cancel the open tool |
| Alt+Q | Search commands |

Drag (or middle-drag) to move around a big picture; the mouse wheel zooms.

## Requirements

A current Chrome, Edge or Firefox. The AI tools are fastest with WebGPU (Chrome and Edge); without it they run on the processor.

## How this was made

This app is **vibe coded**: its author designed and directed it in plain conversation, feature by feature, and an AI coding assistant (Claude, by Anthropic) wrote the code.

It is a **genuine clean-room build**, not a decompiled or AI-rebuilt copy of anything:
- Nothing was decompiled, disassembled or reverse-engineered, in whole or in part.
- No code, artwork, fonts, icons or data files from any original program were used, and none were given to the AI to work from.
- The classic file formats are read and written from their publicly documented layouts; the picture-editing ideas are the general, well-known ones. Every line of ImageCraft's own code was made new.

Open-source libraries it uses are listed with their licences in Credits.

## Credits

- [ImageTracer](https://github.com/jankovicsandras/imagetracerjs) (public domain / Unlicense) for SVG outlines.
- [Transformers.js](https://github.com/huggingface/transformers.js) and ONNX Runtime Web (Apache-2.0) for the AI helpers, in `lib/craft-ai-libs.js`. Models: U²-Net (Apache-2.0), BEN2 (MIT), SlimSAM (Apache-2.0), Swin2SR (Apache-2.0).
- [Instrument Sans](https://github.com/Instrument/instrument-sans) (SIL Open Font License) for the interface.

## Development notes

How ImageCraft is built is described in [NOTES.md](NOTES.md).
