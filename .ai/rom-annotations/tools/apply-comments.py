# Merges end-of-line comments written as "ADDR text" lines (hex address, house-style text: a capital
# first, no full stop) into a copy of a sidecar. An existing comment is never overwritten (it is
# reported); a missing line provenance is added as "observed". Then canonicalise the result with
# apply-annotations.cjs and an empty batch, and check it with check-annotations.cjs.
# Usage: python3 .ai/rom-annotations/tools/apply-comments.py <in.dis> <out.dis> <comments.txt>...
# Comments go on instruction starts in code regions (or a data region's row start); the canonicalising
# apply-annotations.cjs run rejects anything else - including a calculator-code .defb line after
# RST $28, which needs no comment: the decoder already names each code.
import json, sys

d = json.load(open(sys.argv[1]))
A = d["banks"]["0"]["lineAnnotations"]
pv = d["provenance"]
added = kept = 0
for path in sys.argv[3:]:
    for raw in open(path):
        raw = raw.rstrip("\n")
        if not raw.strip() or raw.startswith("#"):
            continue
        addr, text = raw.split(" ", 1)
        key = str(int(addr, 16))
        entry = A.setdefault(key, {})
        if entry.get("comment"):
            if entry["comment"] != text:
                print(f"kept existing comment at ${addr}: {entry['comment']!r} (draft: {text!r})")
            kept += 1
            continue
        entry["comment"] = text
        pv.setdefault(f"0:{key}:line", "observed")
        added += 1
json.dump(d, open(sys.argv[2], "w"))
print(f"added {added}, kept {kept} existing")
