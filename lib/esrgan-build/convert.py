# Real-ESRGAN general v3 (SRVGGNetCompact, BSD-3) -> one ONNX file with both weight sets (general and the weak-denoise
# "wdn" one) stored as float16, blended at run time by a "strength" input (Real-ESRGAN's own denoise_strength:
# weights = s * general + (1 - s) * wdn). Input x: float32 [1, 3, h, w] in 0..1; output [1, 3, 4h, 4w].
import sys, base64, json
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F

D = sys.argv[1]; OUT = sys.argv[2]
def load(name):
    sd = torch.load(f'{D}/{name}', map_location='cpu', weights_only=True)
    return sd.get('params', sd.get('params_ema', sd))
A, B = load('realesr-general-x4v3.pth'), load('realesr-general-wdn-x4v3.pth')
keys = sorted(A.keys(), key=lambda k: (int(k.split('.')[1]), k))
print(len(keys), 'tensors;', sum(v.numel() for v in A.values()), 'parameters each')

class Blend(nn.Module):
    def __init__(self):
        super().__init__()
        self.names = []
        for i, k in enumerate(keys):
            self.register_buffer(f'a{i}', A[k].half()); self.register_buffer(f'b{i}', B[k].half()); self.names.append(k)
    def w(self, i, s):
        return s * getattr(self, f'a{i}').float() + (1 - s) * getattr(self, f'b{i}').float()
    def forward(self, x, strength):
        s = strength.reshape(())
        h = x; i = 0
        idx = {k: j for j, k in enumerate(self.names)}
        layers = sorted({int(k.split('.')[1]) for k in self.names})
        for L in layers:
            if f'body.{L}.bias' in idx:  # a convolution
                h = F.conv2d(h, self.w(idx[f'body.{L}.weight'], s), self.w(idx[f'body.{L}.bias'], s), padding=1)
            else:                         # PReLU
                a = self.w(idx[f'body.{L}.weight'], s).reshape(1, -1, 1, 1)
                h = torch.where(h >= 0, h, a * h)
        h = F.pixel_shuffle(h, 4)
        return h + F.interpolate(x, scale_factor=4, mode='nearest')

m = Blend().eval()
x = torch.rand(1, 3, 24, 32)
with torch.no_grad():
    ref = {s: m(x, torch.tensor([s])) for s in (0.0, 0.5, 1.0)}
# check against a plain float32 build of the original network (strength 1 = general)
def plain(sd, x):
    h = x
    for L in sorted({int(k.split('.')[1]) for k in sd}):
        if f'body.{L}.bias' in sd: h = F.conv2d(h, sd[f'body.{L}.weight'].float(), sd[f'body.{L}.bias'].float(), padding=1)
        else: a = sd[f'body.{L}.weight'].float().reshape(1, -1, 1, 1); h = torch.where(h >= 0, h, a * h)
    return F.pixel_shuffle(h, 4) + F.interpolate(x, scale_factor=4, mode='nearest')
with torch.no_grad():
    print('fp16 storage vs original (general): max diff', float((ref[1.0] - plain(A, x)).abs().max()), ' (wdn):', float((ref[0.0] - plain(B, x)).abs().max()))
torch.onnx.export(m, (x, torch.tensor([0.5])), OUT, input_names=['x', 'strength'], output_names=['y'], dynamic_axes={'x': {2: 'h', 3: 'w'}, 'y': {2: 'H', 3: 'W'}}, opset_version=17, dynamo=False, do_constant_folding=False)
import onnx; onnx.checker.check_model(OUT); print('onnx ok', round(len(open(OUT, 'rb').read()) / 1e6, 2), 'MB')
# a test case for the browser: input and expected outputs at three strengths
json.dump({'x': x.flatten().tolist(), 'shape': list(x.shape), **{f'y{s}': ref[s].flatten()[::7].tolist() for s in ref}}, open(OUT + '.test.json', 'w'))
