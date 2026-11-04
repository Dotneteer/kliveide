import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
if a.size != b.size:
    print(f"SIZE DIFFERS: {a.size} vs {b.size}"); sys.exit(1)
diff = ImageChops.difference(a, b)
bbox = diff.getbbox()
if bbox is None:
    print("IDENTICAL (pixel-for-pixel)"); sys.exit(0)
px = diff.load(); w, h = diff.size
changed = 0; maxd = 0
rows = {}
for y in range(h):
    for x in range(w):
        r, g, bl = px[x, y]
        if r or g or bl:
            changed += 1
            maxd = max(maxd, r, g, bl)
            rows[y] = rows.get(y, 0) + 1
print(f"changed pixels: {changed} / {w*h} ({100*changed/(w*h):.4f}%)")
print(f"max channel delta: {maxd}")
print(f"bounding box (L,T,R,B): {bbox}")
top = sorted(rows.items(), key=lambda kv: -kv[1])[:6]
print("busiest rows (y: count):", top)
if len(sys.argv) > 3:
    diff.crop(bbox).save(sys.argv[3]); print("crop saved:", sys.argv[3])
