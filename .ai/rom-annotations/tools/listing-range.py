# Prints address ranges of a zx81-dis.cjs listing.
# Usage: python3 .ai/rom-annotations/tools/listing-range.py <listing> 0419-0480 09D8-0A16 ...
import sys
lines=open(sys.argv[1]).read().splitlines()
for r in sys.argv[2:]:
    a,b=[int(x,16) for x in r.split("-")]
    print(f"-- {a:04X}")
    for l in lines:
        x=int(l[:4],16)
        if a<=x<=b: print(l)
