# Prints a listing range with the sidecar's labels, synopsis heads and end-of-line comments, for
# reading code before annotating it.
# Usage: python3 .ai/rom-annotations/tools/annotated-view.py <sidecar.dis> <listing> <from hex> <to hex>
#   <listing>: sp48-dis.cjs / zx81-dis.cjs output of the same sidecar (0000-3FFF), with or without
#   its .def lines. A label prints as "NAME:  ## its synopsis"; an existing comment as ";; text".
import json, sys

d = json.load(open(sys.argv[1]))
import os
b = d["banks"][os.environ.get("PAGE", "0")]  # PAGE=<n>: a page of a sidecar of several pages
A = b["lineAnnotations"]
labels = {l["value"]: l["name"] for l in b["localLabels"]}
a0, a1 = int(sys.argv[3], 16), int(sys.argv[4], 16)
for line in open(sys.argv[2]):
    x = int(line[:4], 16)
    if not a0 <= x <= a1:
        continue
    if x in labels:
        synopsis = " ".join(A.get(str(x), {}).get("synopsis", "").split("\n"))
        print(f"{labels[x]}:  ## {synopsis[:300]}")
    comment = A.get(str(x), {}).get("comment")
    print("   " + line.rstrip()[:70] + (f"   ;; {comment}" if comment else ""))
