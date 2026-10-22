# Extracts the text of an interface-document PDF (the NextZXOS/esxDOS API document: the D4 rule allows it)
# without poppler: inflates the content streams and maps glyphs through each font's ToUnicode CMap.
# Usage: python3 .ai/rom-annotations/tools/pdf-text.py _input/NextZXOS_and_esxDOS_APIs.pdf <scratchpad>/api.txt
import re,zlib,sys
d=open(sys.argv[1],'rb').read()
objs={}
for m in re.finditer(rb'(\d+) 0 obj(.*?)endobj',d,re.S):
    objs[int(m.group(1))]=m.group(2)
def stream(body):
    m=re.search(rb'stream\r?\n',body)
    if not m: return None
    raw=body[m.end():body.rfind(b'endstream')]
    try: return zlib.decompress(raw)
    except Exception: return raw
def cmap(n):
    s=stream(objs[n]); mp={}
    for blk in re.findall(rb'beginbfchar(.*?)endbfchar',s,re.S):
        for a,b in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',blk):
            mp[int(a,16)]=bytes.fromhex(b.decode()).decode('utf-16-be','replace')
    for blk in re.findall(rb'beginbfrange(.*?)endbfrange',s,re.S):
        for a,b,c in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',blk):
            st=int(c,16)
            for i in range(int(a,16),int(b,16)+1): mp[i]=chr(st+i-int(a,16))
    return mp
fontmap={}
for n,b in objs.items():
    m=re.search(rb'/ToUnicode (\d+) 0 R',b)
    if m: fontmap[n]=cmap(int(m.group(1)))
pages=[]
for n,b in objs.items():
    if re.search(rb'/Type\s*/Page[^s]',b): pages.append(n)
def resfonts(b):
    m=re.search(rb'/Resources\s*(\d+) 0 R',b)
    if m: b=objs[int(m.group(1))]
    m=re.search(rb'/Font\s*<<(.*?)>>',b,re.S)
    if not m:
        m2=re.search(rb'/Font\s*(\d+) 0 R',b)
        if m2: return dict((k,int(v)) for k,v in re.findall(rb'/(\w+)\s+(\d+) 0 R',objs[int(m2.group(1))]))
        return {}
    return dict((k,int(v)) for k,v in re.findall(rb'/(\w+)\s+(\d+) 0 R',m.group(1)))
out=[]
for i,p in enumerate(sorted(pages)):
    b=objs[p]; fonts=resfonts(b)
    cs=re.search(rb'/Contents\s*(\d+) 0 R',b)
    if not cs: continue
    s=stream(objs[int(cs.group(1))]); cur={}
    txt=[]
    for tok in re.finditer(rb'/(\w+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>|\((.*?)(?<!\\)\)|(T\*|Td|TD|ET|Tm)\b|(-?\d+\.?\d*)\s*(?=[^\d])',s,re.S):
        if tok.group(1): cur=fontmap.get(fonts.get(tok.group(1)),{}); w=4 if cur and max(cur)>255 else 2; continue
        if tok.group(2) is not None:
            h=tok.group(2).decode(); w=4 if len(cur)>0 and max(cur)>255 else 2
            for k in range(0,len(h),w): txt.append(cur.get(int(h[k:k+w],16),'?'))
        elif tok.group(3) is not None:
            txt.append(''.join(cur.get(c,chr(c)) for c in tok.group(3)))
        elif tok.group(4): txt.append('\n' if tok.group(4)!=b'Td' else ' ')
    out.append('==== page %d\n'%(i+1)+''.join(txt))
open(sys.argv[2],'w').write('\n'.join(out))
print(len(pages),len(fontmap))
