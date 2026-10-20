# Wraps the ONNX file as a script (window.CRAFT_ESRGAN_V3 = base64), because a page opened from a file cannot
# fetch() the files beside it. Usage: python convert.py <folder with the two .pth files> esrgan_v3.onnx
#                                     python make_js.py esrgan_v3.onnx ../craft-esrgan-v3.js
import sys, base64
data = open(sys.argv[1], 'rb').read()
open(sys.argv[2], 'w').write('/* Real-ESRGAN general v3 (SRVGGNetCompact, x4), general and weak-denoise weights blended by a strength input.\n'
  '   BSD-3-Clause, (c) 2021 Xintao Wang (github.com/xinntao/Real-ESRGAN). Converted by lib/esrgan-build. */\n'
  'window.CRAFT_ESRGAN_V3 = "' + base64.b64encode(data).decode() + '";\n')
print(round(len(data) / 1e6, 2), 'MB model ->', sys.argv[2])
