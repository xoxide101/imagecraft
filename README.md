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

### Maps, channels and masks

- **Maps** (left panel, Maps tab): the picture measured into maps, one shown at a time: edges, texture, smooth areas, noise, specks and damage, skin, greenery, sky, shadows, midtones, highlights, colourfulness, haze, sharp or blurred, and clipped. Shown as heat maps or as grey masks (white = most).
- **Channels**: red, green, blue; cyan, magenta, yellow and black (CMYK separations); Lab lightness and its two colour axes; **extreme greyscale** (contrast pushed to the limit area by area, so scratches, creases and faint detail show) and **black and white** (split automatically, Otsu's method). Damage and detail often live in different channels. Any map can be **opened as a picture** of its own, or used to **make the picture see-through**.
- **Stretched channels and False colour**: a sepia or faded print holds almost nothing in its colour separations (magenta 0–9% on a sepia test print). The stretched channels and **False colour** (Detail › Maps) stretch each one to its own full range, like telescope pictures, so stains, uneven toning, fading and JPEG colour blocks show. They are for looking and masking, not the real colour.
- **Scene (AI)**: sky, trees and bushes, grass, flowers, people, clothes, hair, buildings, road and ground, cars and bikes, and water, recognised by what they are (CLIPSeg, Apache-2.0, about 139 MB the first time; about 15 seconds a picture). The colour rules (Skin, Greenery, Sky) judge by colour, so on a sepia or colour-cast print they mark the wrong things. ImageCraft now warns when a picture's colours all lean one way. **Find…** at the top of the Maps tab maps anything you name ("the motorbike", "flowers"). The finder's coarse answer is snapped to the picture's own edges.
- **Skin (learned from the faces)**: the skin colour of the faces the face finder found, looked for again on necks, arms and hands nearby, so a cast or tone doesn't matter.
- **Main subject / Background (AI)**: from the cut-out AI, so any tool can work on the subject only (with care) or on the background only (more freely). **Split subject and background** (Clean up › Old photo) makes them two pictures, like layers: the subject cut out, and the background with the gap filled smoothly from around it (a guess, for colour hints). Restore each one, then put them back with Detail › Blend a version.
- **Where** (in every tool that keeps the picture's size): apply the tool only where a map says, with a level, softness and feather (like Levels on a mask), inverted, or **combined with a second map** (Calculations: multiply, add, subtract, difference, lighter, darker). For example: sharpen only the texture but not the skin; take noise out of the smooth areas only; deepen the colour of the sky alone. Press Show the mask to see it.

### Detail tab: curves, layers of detail, light

- **Curves**: a curve you shape by dragging points, for brightness (colours keep their hue), RGB, or red, green or blue alone, with presets (S-curve, lift shadows, soft highlights, faded film). With **Where**, a curve works like a curves layer with a mask.
- **Detail equaliser**: the picture split into bands by the size of its detail (finest, small, medium, large, broad light), each with its own amount, and put back together. Small changes are lifted more than strong edges, so no halos. Presets: bring out texture, local contrast, soften texture, flatten the lighting.
- **Even the light** (gradient domain): every change in brightness measured; big jumps made smaller and faint ones bigger; the picture rebuilt from them by solving the Poisson equation.
- **Crisp edges**: a shock filter that pulls soft edges into clean steps with nothing overshooting; best after enlarging, kept to the edges by default.
- **Edge-keeping smooth**: Perona–Malik diffusion, which smooths grain but never across an edge.
- **Blend a version**: mix an earlier step, or **another open picture**, back in (normal, multiply, screen, overlay, soft light, lighten, darken, difference, brightness only, colour only), anywhere or through a map. With **Remove background › Cut out to a new picture**, a subject becomes a picture of its own: repair it, then blend it back; its see-through parts leave the rest untouched.

### Faces (no redrawing)

- **Face refine** (Detail tab): each face is found with MediaPipe Face Landmarker (478 points a face) and its parts treated on their own: skin smoothed, eyes cleared, iris contrast, brighter neutral eye whites, lip colour, whiter teeth. Nothing is redrawn or invented, so every face stays the person's own. Small faces in group photos are searched in overlapping tiles on a contrast-boosted copy, and a face counts only when it is found more than once (a face-like pattern on a shirt is not).
- **Face part maps** (Maps tab): faces, face skin, eyes, irises, eye whites, lips, mouth and teeth, eyebrows: masks for any tool.
- **Fix a colour cast › Eye whites and teeth**: they are nearly neutral in life, a grey card already in the photo.
- The face finder (about 150 KB here, plus a 4 MB model and its runtime downloaded once) loads only when first used.

### Restore old photos

- **Auto colour** (Adjust tab): corrects a faded print the way a photo lab would: each colour's own black and white points, the midtones made neutral with a curve, and faded colour brought back by how much is missing. Skin tones and greenery are protected (the correction eases off rather than turning faces grey or grass brown), and a sepia or toned picture keeps its tone: a picture with almost no colour other than its main hue is treated as toned, a very faded colour print gets part of the correction, and Make neutral forces a full one.
- **Dehaze** (Adjust tab): takes away a foggy or faded grey-white veil. How thick the veil is gets measured everywhere (a clear photo always has something dark in each small area: the dark channel prior) and removed; a toned print keeps its tone. Restore old photo dehazes when it measures a veil.
- **Recover shadows** (Adjust tab): lifts dark areas (an underexposed subject, deep shade) with their texture, leaving the sky alone: the picture's broad lighting is evened out by an edge-keeping (guided) filter and its detail put back, with a limit so shadow noise is not blown up.
- **Clarity** (Adjust tab): local contrast that brings out texture and detail (faces, fabric, leaves) without the hard edges of sharpening.

- **Restore old photo** (Clean up tab): one click. It measures the picture's noise and blur, then takes out dust, removes grain and colour blotches, gently undoes blur, fixes a colour cast (only nearly-grey things are made neutral, so a sunset stays warm), levels and brings back faded detail.
- **Remove noise**: non-local means. Each pixel is averaged with others nearby whose surroundings look alike, so texture and edges stay while grain goes; grain and colour blotches are handled separately. It opens already set to the noise measured in the picture.
- **Deblur**: undoes soft focus, out of focus or camera shake. A degraded picture is the sharp one spread by a blur plus noise (*g = h ∗ f + n*); Deblur inverts that with a Wiener filter plus a gradient prior, with mirrored edges and no halos. **Measure the blur** reads the blur size from the picture's sharpest edges. **Careful** alternates undoing the blur with removing noise (plug-and-play restoration): slower, cleaner on grainy pictures.
- **Faded detail**: adaptive histogram equalisation (CLAHE), each area of the picture getting its own contrast back.
- **Fix a colour cast**: greys to grey, average to grey (grey world), brightest to white (white patch), or click something white.
- **Where the noise is**: a noise map, which also shows whether a picture was already smoothed and sharpened.
- **Dust and scratches** (Smart): finds the specks first (dust, dropouts, salt-and-pepper dots), then repairs only those, each from the clean pixels around it in a window that grows until there are enough; everything else is left exactly as it was.

### Edges and shapes

- **Smooth jagged edges**: an edge check marks staircase edges in red and smooth ones in green; smoothing works along each edge, never across it. Also in Resize, Make bigger, and in **Save as**, which checks the edges of what is about to be saved and suggests smoothing when they are jagged.
- **Remaster shapes**: the picture's shapes are recognised as clean outlines (near-circles and ellipses become perfect ones, near-polygons get straight sides), drawn again crisply at the new size, then blended with the enlarged original band by band (multi-band pyramid blending), at the edges only (keeping the original's texture) or everywhere. For logos, clip art, icons, pixel art and drawings.

### Clean up and modernise

- **Smooth out noise** (edges stay sharp), **Dust and scratches**, **Remove JPEG blocks**, **Undither** (blends dithering dots back into smooth colour).
- **Make bigger** and **Resize**: Best (sharp edges without halos), Pixel averaging (every pixel counted by how much it covers), Lanczos, Cubic, Soft (Mitchell), Linear, square pixels, Scale2x and Scale3x for pixel art, smooth pixel art (grown with Scale2x and averaged back down), or **AI upscaling**: Real-ESRGAN 2× and 4× (the standard for real-world photos: crisp edges, JPEG blocks cleaned), and Swin2SR 2× for clean pictures, 4× for old photos and 4× JPEG clean-up with an AI strength slider that mixes in the classic enlargement. Averaging is done in linear light, as light really adds up, so fine detail and edges keep their brightness.
- **Rebuild colour detail** (Clean up › Restore): a JPEG keeps brightness in full but colour at half size in 8 × 8 blocks, and old scans smear colour. The colour is made to follow the brightness edges that are really there (a guided filter); nothing is invented and brightness is untouched. On a test JPEG the colour error fell by 2.2 dB (heavily compressed) and 0.9 dB (normal), where a plain blur made it worse.
- **Combine photos** (Clean up › Bigger): several shots of the same scene (a handheld burst, or the same print scanned a few times) are lined up to a fraction of a pixel and merged. **Super-resolution** uses the tiny shifts between the shots to fill in detail between the pixels, the way phone cameras and DLSS-style game upscalers use several frames. **Average** removes noise, and **Median** also drops things that moved (passers-by). Each part can be lined up on its own, for handheld shots. On a test with 8 shots at half size, Super 2× scored 33.7 dB against 30.8 for the best single-shot enlargement (4 shots: 33.4).
- **Sharpen › Smart (CAS)**: contrast-adaptive sharpening after AMD FidelityFX CAS (the FSR 1 sharpener, MIT). Each pixel is sharpened by how much room its neighbours leave, so there are no halos or clipping, and flat areas are left alone.
- **Modernise** in one go: pixel art, a dithered screen, an old photo or scan, or a blocky JPEG.
- **Remove background**: by colour from the edges (click leftovers to take them too), or an **AI cut-out** for photos. Make a colour see-through, or fill see-through parts.

### Adjust and image

Auto fix, auto levels, brightness, contrast, midtones, shadows and highlights; saturation, vibrance, hue, warmth and tint; fix a colour cast; greyscale, sepia, invert, threshold, posterize; sharpen, blur, pixelate. Resize, crop (with shapes and Trim plain borders), canvas size, turn, flip and straighten.

### SVG and text art

- **SVG outlines**: a picture traced into smooth filled outlines (best match or 2–32 colours), or exact squares for pixel art.
- **Text art**: ASCII characters (several sets, including Braille dots), shaded blocks ░▒▓█ or half blocks ▀ (two pixels in each character), plain or with ANSI colour (16, 256 or true colour), for a dark screen or white paper. Save as text, a classic .ANS file (DOS characters, 16 colours, with a SAUCE record) for ANSI viewers and BBSes, ANSI for today's terminals, or a web page.

### AI helpers

Small AI models that run inside the browser, on the graphics card if there is one (the upscalers run there about 16 times faster than on the processor): the background cut-out (U²-Net, or BEN2 for finer edges), object picking (SlimSAM) and upscaling (Swin2SR). Each downloads once from Hugging Face when first used (or with Download now in Convert › AI helpers) and is kept by the browser for offline use. The computer is checked automatically.

### Ask AI what it needs (Ollama, optional)

**Clean up › Ask AI what it needs**: if [Ollama](https://ollama.com) runs on the same computer with a vision model, the model looks at the picture. It says what the picture is (subject, era, kind, colour or toned, how many faces, the materials and colours) and what damage it can see. ImageCraft turns that into ticked steps with its own tools, such as Dust and scratches, Remove noise, Deblur, Dehaze, Auto colour keeping a sepia tone, Fix a colour cast and Face refine, and runs them one by one into History. The model only describes; nothing is redrawn, and nothing leaves the computer (cloud models are not offered). The description of how the picture should look can be copied, to guide later steps.

- Best model in tests: **qwen3.5** (`ollama pull qwen3.5`, 6.6 GB). It counted all 7 faces in a group photo, named real colours and materials, and listed only damage that was there. Smaller gemma3 and gemma4 tended to list creases and stains on a clean picture.
- It takes about 10 to 30 seconds on a mid-range graphics card once the model is loaded (the first look loads it). ImageCraft asks for a short context (8k), so the model fits on the card.
- **Opened as a file?** Ollama refuses pages without a web address until it is told to allow them: `setx OLLAMA_ORIGINS *` in a command prompt, then quit and restart Ollama. `*` lets any page use Ollama, websites included, so you may prefer to set it only while you use ImageCraft. (Ollama does not accept the narrower "null".) A page served from `localhost` works without it.

## When something goes wrong

The **Debug** tab (left panel, or View › Debug log) lists errors and what happened: files opened and saved, tools run and how long they took, AI models that would not load. A red error count appears in the status bar when there is one. **Copy** or **Save** the log to send it along with a question.

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
- [Transformers.js](https://github.com/huggingface/transformers.js) and ONNX Runtime Web (Apache-2.0) for the AI helpers, in `lib/craft-ai-libs.js`. Models: U²-Net (Apache-2.0), BEN2 (MIT), SlimSAM (Apache-2.0), Swin2SR (Apache-2.0), Real-ESRGAN (BSD-3-Clause; the ONNX export by SceneWorks).
- [CLIPSeg](https://huggingface.co/CIDAS/clipseg-rd64-refined) (Apache-2.0), run through Transformers.js, finds things by name.
- [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) and its Face Landmarker model (Apache-2.0), bundled as `lib/craft-face-libs.js` (built from `lib/face-build`).
- Smart sharpen follows AMD FidelityFX CAS (MIT); the method was re-written here from its published description, not copied.
- [Instrument Sans](https://github.com/Instrument/instrument-sans) (SIL Open Font License) for the interface.

## Development notes

How ImageCraft is built is described in [NOTES.md](NOTES.md).
