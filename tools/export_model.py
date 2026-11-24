#!/usr/bin/env python3
"""Laddar ner BioCLIP (MIT-licens, imageomics/bioclip) och exporterar bildkodaren till ONNX (int8)
för att köras på telefonen med onnxruntime-web.

  pip install torch open_clip_torch onnx onnxruntime onnxscript
  python3 tools/export_model.py     # -> app/model/bioclip_visual_int8.onnx (~87 MB)
"""
import os, subprocess, torch, open_clip
from onnxruntime.quantization import quantize_dynamic, QuantType
from onnxruntime.quantization.shape_inference import quant_pre_process

HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.join(HERE, "cache", "bioclip.bin")
OUT = os.path.join(HERE, "..", "app", "model")
URL = "https://huggingface.co/imageomics/bioclip/resolve/main/open_clip_pytorch_model.bin"


def load_model():
    if not os.path.exists(W):
        os.makedirs(os.path.dirname(W), exist_ok=True)
        subprocess.run(["curl", "-L", "-o", W, URL], check=True)
    m, _, _ = open_clip.create_model_and_transforms("ViT-B-16", pretrained=W)
    return m.eval()


class Visual(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.v = m.visual

    def forward(self, x):
        f = self.v(x)
        return f / f.norm(dim=-1, keepdim=True)


if __name__ == "__main__":
    m = load_model()
    os.makedirs(OUT, exist_ok=True)
    fp32 = os.path.join(HERE, "cache", "visual_fp32.onnx")
    pre = os.path.join(HERE, "cache", "visual_pre.onnx")
    torch.onnx.export(Visual(m), (torch.randn(1, 3, 224, 224),), fp32, input_names=["pixel_values"],
                      output_names=["embedding"], opset_version=17, dynamo=False)
    quant_pre_process(fp32, pre)
    quantize_dynamic(pre, os.path.join(OUT, "bioclip_visual_int8.onnx"), weight_type=QuantType.QUInt8)
    print("klart")
