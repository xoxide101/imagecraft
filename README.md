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

### Compare (View › Compare) and Duplicate picture

Any versions together, chosen from any open picture and any step in its History: **Side by side**, a **Grid** of up to four (for example the original, CodeFormer, GFPGAN and Regenerate), a **Split** with a movable line, or **Differences** (how much each pixel changed, as heat, with a slider to make small changes stand out, and the average change in levels). They are drawn as one picture, so zooming and moving the view moves them all together. **Duplicate picture** opens a copy of the picture as it is now, to try a different set of steps on and then compare the two flows. (Before / after is the quick dragging line between the picture and its original.)

### Zoom

Click the zoom percentage in the status bar for a menu: Fit, 25% to 800%, or type any size and press Enter.

### Colour under the mouse

A small table beside the mouse shows the colour under it in **HEX, RGB, CMYK, HSL and Lab**, with the nearest CSS colour name (View › Colour info turns it on or off). The status bar keeps the swatch, HEX and name of the last colour pointed at; click it to copy the HEX. Pantone's colour values are licensed by Pantone, so no Pantone table can come with ImageCraft; the Lab values match any swatch book.

### Local AI / Cloud AI / Both (status bar, left of the zoom)

**Local AI**: nothing leaves this computer (Ask AI uses only Ollama models on this computer, Regenerate is off, Ollama's cloud models are hidden). **Cloud AI**: Ask AI uses your cloud services and Regenerate is on. **Both** (the default): everything is offered and you choose per tool. Most tools always run on this computer. Four can also use the cloud when the switch allows it and a key is saved, and each one's panel lets you choose: **Repair damage** (fill large tears with OpenAI or Gemini; only the marked area is sent and only it changes), **Colourise** (Gemini or OpenAI colours a copy, and only its colours are joined to your photo's own detail), **Restore faces** (each face crop is redrawn by Gemini or OpenAI; the Closeness slider mixes some of the original back), and **Find** in the Maps tab (Gemini outlines what you name). With Local AI chosen, the cloud choices are hidden. With **Cloud AI** chosen, Repair damage, Colourise and Restore faces start on their cloud version wherever they run (their own panels, Process a photo, Modernise, recipes); the steps with no cloud version (Make bigger, noise, deblur and the plain adjustments) run on this computer. A service that says it is unpaid is passed over for the rest of the session. The 16-bit finishing pass never calls the cloud again (a cloud step is kept in 8 bits). Also, the AI maps that would otherwise download a built-in finder (Scene › Sky, Trees, People…, Main subject, Background, and Find) are outlined by the cloud instead, once per picture; a service whose account is unpaid is passed over for the next one.

**Let the cloud map this photo** (Maps tab): the cloud AI outlines the sky, skin, greenery, main subject (and so the background), hair, clothing and damage to the print, in one go. Gemini draws the outlines itself; OpenAI or Claude say where each thing is and the built-in outliner traces its edges on this computer. Each layer is kept as this picture's corrected map, so every built-in tool (Where, Process a photo, repair, colour, faces) then uses it, offline, as often as you like. The picture is sent once. Any layer can be corrected by hand like any other map. Afterwards **Built-in and cloud layers** opens by itself: every cloud layer in its own colour over the picture, then each layer beside ImageCraft's own measured version with how much they agree (also the **Compare built-in and cloud** button).

**The status bar**: [computer] Local AI | Both | Cloud AI [cloud] [bug]. The computer button opens **Local activity**: every AI model run on this computer (graphics card or processor, how long, whether it downloaded first) and every step that changed a picture, with before and after. The bug button opens the **Debug log** (it turns red with the number of errors). **Cloud activity** (the cloud button, which pulses while something is being sent; also AI settings › Cloud AI): every call this session, newest first, with the service, model, time and size, the picture exactly as it was sent (and the mask), the instructions, and what came back (pictures, outlines and text). Keys are never shown or kept there, and the list is forgotten when the page is closed.

### AI settings (the AI button in the status bar)

The **AI** button at the left of the status bar shows what is available (e.g. "AI: graphics card · Ollama ✓ · Cloud: Gemini") and opens **AI settings**: **Local AI** (the built-in models: download, switch on or off; Ollama: connected or not, its picture models, the address, and whether its cloud models are offered) and **Cloud AI** (your keys). Also View › AI settings.

### Cloud AI (your own keys; optional)

**AI settings › Cloud AI** (the AI button in the status bar, or View › AI settings) takes your own Claude (Anthropic), Gemini (Google) and OpenAI keys (and, for a Claude key not tied to one workspace, its workspace ID from the Anthropic Console). They are kept only in this browser and sent only to their own company, with each request you make (billed to your account there). **Test them** shows how many of each service's models can look at pictures and how many can draw. **Try the cloud tools** makes one small call of each cloud tool on a small built-in picture (a few cents in all) and shows a timed report with no keys in it, to copy. The newest suitable model of each service is picked by itself, and an account with no paid credit gets a plain message saying where to add it.
- **Ask AI** can then use Claude, Gemini or GPT (or Ollama's cloud models, such as kimi-k3, when you allow them) to describe a photo instead of a local model. The panel says where the picture is sent.
- **Regenerate** (Clean up › Cloud) sends the photo, with the description, to Gemini's or OpenAI's image model and gets back a redrawn, restored version: tears, scratches, blur and fading fixed, missing parts drawn in. **Everything in it is drawn by the AI**, so faces and details can change. It opens as a new picture at the original's size, to compare or to blend parts back with Detail › Blend a version.
- Checked without real keys: all three services answer a page opened as a file, and a wrong key gives a clear message.

### Process a photo (Home › Plan)

Say what you are doing: **Repair**, **Colour correction**, **Make bigger** (2× or 4×) and/or **Edits** (your own crop, straighten, curves and colour). ImageCraft measures the photo (noise, blur, JPEG blocks, printing dots, light and fading, haze, colour cast or toning, specks, and faces if you ask; about 3 seconds) and lays out a plan in the order that works best: repair first (printing dots, JPEG blocks, specks, then tears you mark yourself), then noise and blur, light and colour, your own edits, faces, making bigger (photos are made 4× with the AI and averaged down to 2×), and a light final sharpen. Each step says why, with the measurement behind it, and roughly how long it takes on this computer; untick any, open any to adjust it, then run the ticked ones (each goes into History). Steps that need you (marking tears, crop, curves) are listed as "your turn". On the motorbike test: blocks 2.3×, dark (29%), soft (1.6 px), one small face; the plan of eight automatic steps was estimated at 14 seconds and took 13.4.

### The details box (bottom of the left panel)

Four tabs, folded away with **–**: **Original** (the file as opened: format, bits, size, colours, and its measurements on request), **Current** (the picture now: size, colours, 8 or 16 bits per colour, steps, saved or not), **Saved** (the steps from the original to what was last saved, and the file it went to) and **Working** (what has been done since, not in a file yet, and any tool that is open but not applied).

### Helping the AI see: correcting maps, pointing at faces

Any map can be corrected by hand: view it (Maps tab), press **Correct it**, then **Paint in** or **Paint out** with the brush (the left button adds, the right button takes away), or **Click: AI outlines it** to add a whole object with one click. Your version of the map belongs to that picture and is used everywhere a map is used: every tool's Where, Face refine and the face tools, Repair. **Back to measured** drops it. On the face maps there is also **Point at a missed face**: click the middle of a face the finder missed, and it searches close-ups round that point (at several sizes, and with the contrast brought up) and adds the face it finds, so the face maps and face tools include it.

### Deep colour (16 bits per colour)

Every picture is expanded to full colour when it opens, so a palette never limits what the tools can do. Beyond that, each History step keeps **16 bits per colour** (65,536 levels instead of 256), so a chain of edits doesn't round away detail or band smooth skies. The status bar shows **16-bit** when a step has it.

- **How**: a tool written for 8 bits runs eight times on copies of the picture nudged by up to one level, and the results are averaged. The fractions each run rounds away come back. In a test of five tone edits on a dark gradient, the sky kept 30 levels instead of 15 and the largest jump between rows fell from 4 levels to 3. It only happens when you press Apply (previews stay quick). A tool too slow to run eight times carries the in-between levels through instead.
- **On screen** and in 8-bit files the 16 bits are shown through a fine ordered dither, so gradients stay smooth.
- **Files**: 16-bit PNG and TIFF open with all 16 bits (tested value for value against Pillow and against hand-made files using every PNG filter). PNG and TIFF save as 48-bit or 64-bit (16 bits per colour, with see-through), the default when the picture has 16 bits.
- **Smooth out banding** (Clean up › Clean › Banding): stripes in skies and shadows, from too few levels or from brightening a dark picture, are smoothed where four pixels a little way off are all within a level or two (after the f3kdb idea). Edges and texture stay, and with 16 bits the bands don't come back. On the test: 125 levels instead of 21 down the sky, and the largest jump fell to 2 levels.
- Only the latest 6 steps keep 16 bits, to save memory (a 12-megapixel step takes about 96 MB at 16 bits).

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

### Recipes (do it once, repeat it on a whole box of photos)

The **History** tab can save the steps that made a picture as a **recipe**: each tool with its settings, masks included, as a small `.json` file. **Run a recipe…** repeats it on the open picture; **These steps on all open pictures** runs the same steps on every other open picture, each into its own History. The tools measure each picture themselves (noise, blur, JPEG blocks, faces), so one recipe suits a set of similar photos. Painted repairs and clicked cut-outs belong to one picture, so they are left out (ImageCraft says how many). The same works from the command layer: `ImageCraft.recipeOf()` and `ImageCraft.runRecipe(recipe)`.

### How long things take

Heavy work says how far it has got and roughly how long is left, worked out from the first steps: AI enlarging ("square 12 of 80 · about 40 s left"), the 16-bit passes, and any tool that reports progress. **Make bigger** with an AI method estimates the time before you start, from how fast this computer ran that model last time (the first run is timed).

### Printing dots, red eye, flash shadows

- **Descreen** (Clean up › Clean): a photo printed in a newspaper, yearbook or magazine is a grid of dots, which shows as sharp spikes in the frequency spectrum. Their spacing is measured (6.03 pixels found on a 6-pixel test screen), the dots are smoothed away by that much, and the edges are sharpened back. Notching out just the spikes was tried first, but it left the rosette that colour screens make with each other. The JPEG block grid also makes spikes, so those are ignored: the three test photos are left alone.
- **Red eye** (Detail › Faces): the face finder finds each iris, and only there, where red is far above green and blue, the red is taken down. On a test with painted red pupils, none were left red.
- **Lift a shadow** (Adjust › Light): paint over a hard shadow, such as a flash shadow on a wall. What is painted, plus a ring round it, is split into dark and light (Otsu's method), so sloppy painting either way doesn't matter. Only the dark part is brightened, by the light-to-dark ratio colour by colour, with the edge following the picture. On a test wall the shadow came back to within one level of the lit wall.

### Colourise (AI, a guess)

**Clean up › Colour › Colourise** gives a black-and-white, sepia or badly faded photo likely colours with DDColor-tiny (Apache-2.0). Only the colour is guessed: the photo's own lightness is kept at full size, so every detail stays the photo's own. The model knows what skin, sky, grass, trees and clothes usually look like, not what colour a particular dress was. On the sepia test group it gave green grass and trees, coloured flowers and clothes, and natural skin. It takes about 10 seconds a photo on the processor (one step of the model fails on the graphics-card runtime, so it runs on the processor). About 135 MB the first time. Repair damage first: torn or stained areas get invented colours.

### Restore faces (AI, redrawn; non-commercial)

**Detail › Faces › Restore faces** redraws small, blurred, grainy or damaged faces with **CodeFormer** (with a closeness slider) or **GFPGAN 1.4** (Tencent ARC; natural skin and colour, about 340 MB once; 0.1 s a face on a graphics card, about 15 s on the processor). Each face is straightened onto the model's 512 × 512 layout (eyes, nose tip and mouth corners from the face finder, by a similarity transform), restored there, and laid back with a soft edge, so the rest of the picture is untouched. **Keep to the original** sets how closely it follows the real face; lower is cleaner but more invented. On the test group photo, all six faces went from soft blurs to clear faces; on a toddler, the expression around the eyes changed at 70%, so check closely and raise the slider when likeness matters most. It is a large download (about 377 MB, once). The first run is timed and later runs are estimated. CodeFormer is under the S-Lab License 1.0: **non-commercial use only**. ImageCraft downloads it from huggingface.co when asked and does not include it.

### Repair damage

**Clean up › Repair › Repair damage** marks the damage and fills it in from what is around it.
- **Scratches, cracks and dust (AI)**: the scratch finder from Microsoft's *Bringing Old Photos Back to Life* (MIT; about 75 MB once), on by default. On the test photos it marked 1.5% of the damaged portrait (flakes and cracks along the tears) and 0.2% of the group, and left faces alone; large torn areas are still marked by hand.
- **Found by themselves**: specks and dust (from the speck finder), and optionally white or black flecks and thin scratches, and an orange date stamp near the bottom. On test photos the automatic marks cover about 0.2% of the picture. An earlier, looser finder marked 20–67% (hair and faces too), so it was made strict.
- **Marked by you**: tears, flaking and stains. **Paint** over them (left button; the right button takes marks away), or **click** one and the AI picker outlines it. Red shows what will be filled.
- **Fill with**: **AI** (MI-GAN, MIT, about 28 MB the first time, a few seconds on a graphics card), or **Fill from the edges** (Telea's fast marching) for specks, scratches and thin cracks. On thin cracks drawn over a photo it came closest to the real pixels: 38.0 dB, against 36.0 for a plain smooth fill and 30.2 for the AI. Only the marked pixels change. Over large areas the AI invents what is there, so ImageCraft warns when more than 15% is marked.
- **JPEG blocks**: photos passed round online are often heavily compressed. Modernise › Old photo and Ask AI now measure the 8 × 8 blocks (edges across the block borders against edges elsewhere: about 1 for a clean picture, 1.8–2.4 on the test photos, colour 6) and smooth them first, back to 1.1–1.3.

### Clean up and modernise

- **Smooth out noise** (edges stay sharp), **Dust and scratches**, **Remove JPEG blocks**, **Undither** (blends dithering dots back into smooth colour).
- **Make bigger** and **Resize**: Best (sharp edges without halos), Pixel averaging (every pixel counted by how much it covers), Lanczos, Cubic, Soft (Mitchell), Linear, square pixels, Scale2x and Scale3x for pixel art, smooth pixel art (grown with Scale2x and averaged back down), or **AI upscaling**: Real-ESRGAN 2× and 4× (the standard for real-world photos: crisp edges, JPEG blocks cleaned), and Swin2SR 2× for clean pictures, 4× for old photos and 4× JPEG clean-up with an AI strength slider that mixes in the classic enlargement. Averaging is done in linear light, as light really adds up, so fine detail and edges keep their brightness.
- **Rebuild colour detail** (Clean up › Restore): a JPEG keeps brightness in full but colour at half size in 8 × 8 blocks, and old scans smear colour. The colour is made to follow the brightness edges that are really there (a guided filter); nothing is invented and brightness is untouched. On a test JPEG the colour error fell by 2.2 dB (heavily compressed) and 0.9 dB (normal), where a plain blur made it worse.
- **Pixel art, style kept (MMPX)** (Make bigger): Morgan McGuire and Mara Gagiu's style-preserving magnifier, in 2× steps. It has rules for 1:1 and 2:1 slopes and for crossing lines, so thin lines, corners and dithering keep their look and no new colours are made. On a test drawing, shallow lines came out as clean slopes where Scale2x leaves steps.
- **AI 4× Real-ESRGAN compact** (Make bigger; also what Modernise uses with AI): a small, fast Real-ESRGAN (BSD-3) that comes with ImageCraft (nothing to download), with a **Noise removal** slider that blends its two published versions, the same as Real-ESRGAN's own denoise strength. Converted here from the original PyTorch weights to one ONNX file (lib/esrgan-build), and checked against PyTorch to 0.00001. On a 160 × 160 crop: about 0.1 s against 8.5 s for the big Real-ESRGAN, softer but more faithful (the big one reshaped a toddler's face).
- **Combine photos** (Clean up › Bigger): several shots of the same scene (a handheld burst, or the same print scanned a few times) are lined up to a fraction of a pixel and merged. **Super-resolution** uses the tiny shifts between the shots to fill in detail between the pixels, the way phone cameras and DLSS-style game upscalers use several frames. **Average** removes noise, and **Median** also drops things that moved (passers-by). Each part can be lined up on its own, for handheld shots. On a test with 8 shots at half size, Super 2× scored 33.7 dB against 30.8 for the best single-shot enlargement (4 shots: 33.4).
- **Sharpen › Smart (CAS)**: contrast-adaptive sharpening after AMD FidelityFX CAS (the FSR 1 sharpener, MIT). Each pixel is sharpened by how much room its neighbours leave, so there are no halos or clipping, and flat areas are left alone.
- **Modernise › Old photo** can also **colourise** and **restore faces** (both optional and labelled AI), so the whole chain runs from one button: JPEG blocks, specks, noise, deblur, light and colour, colourising, faces, then the compact Real-ESRGAN. On the sepia group test it gave a colour photo with clear faces; it took 6 minutes on the processor, and colours were turned down to 80% because full strength came out too vivid.
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

### If an AI model disappears

The AI models come from Hugging Face and Google. Copies of every one ImageCraft uses are kept in the [craft-models](https://github.com/xoxide101/craft-models) repository, each with its licence. If an original download fails (the file was moved or deleted, or the site is down), ImageCraft uses the copy instead: it rejoins the parts, checks the SHA-256 fingerprint, and only then uses it. It was tested with Hugging Face and Google blocked: the repair model, the finder and the face finder all loaded from the copies. The originals are always tried first.

## When something goes wrong

The red badge in the status bar counts faults in the program in this session (the Debug log keeps earlier sessions' entries, dated, for reference). A tool saying what it needs ("No faces found", "Paint over the shadow first") is shown as a message and kept in the Debug log as a note, not counted as an error.

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
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) general v3 (BSD-3-Clause, © 2021 Xintao Wang) is included as lib/craft-esrgan-v3.js, converted by lib/esrgan-build.
- [MMPX](https://casual-effects.com/research/McGuire2021PixelArt/) pixel-art magnification, ported to JavaScript from the MIT reference code (© 2020 Morgan McGuire & Mara Gagiu).
- [DDColor](https://github.com/piddnad/DDColor) (Apache-2.0), the tiny model as exported for the browser at huggingface.co/edgetools/ddcolor, colourises.
- [CodeFormer](https://github.com/sczhou/CodeFormer) (S-Lab License 1.0, non-commercial), downloaded on request as an ONNX file from huggingface.co/bluefoxcreation/Codeformer-ONNX.
- Scratch finder: Microsoft's [Bringing Old Photos Back to Life](https://github.com/microsoft/Bringing-Old-Photos-Back-to-Life) (MIT), as exported for the browser at huggingface.co/Saimon8420/old-photo-scratch-detection-web.
- [GFPGAN](https://github.com/TencentARC/GFPGAN) 1.4 (Tencent ARC; Apache-2.0 code, FFHQ-trained weights, non-commercial), downloaded on request from huggingface.co/neurobytemind/GFPGANv1.4.onnx.
- [MI-GAN](https://github.com/Picsart-AI-Research/MI-GAN) (MIT) fills in damage; the ONNX pipeline file is from huggingface.co/andraniksargsyan/migan.
- [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) and its Face Landmarker model (Apache-2.0), bundled as `lib/craft-face-libs.js` (built from `lib/face-build`).
- Smart sharpen follows AMD FidelityFX CAS (MIT); the method was re-written here from its published description, not copied.
- [Instrument Sans](https://github.com/Instrument/instrument-sans) (SIL Open Font License) for the interface.

## Development notes

How ImageCraft is built is described in [NOTES.md](NOTES.md).
