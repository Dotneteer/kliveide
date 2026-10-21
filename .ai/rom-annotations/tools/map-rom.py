# Maps a ROM sidecar's entries onto another version of the ROM by aligning the two listings
# instruction by instruction (address operands masked): labels and lines move with the code, data
# regions are placed by their bytes or by position, ROM addresses in the text are remapped (not
# constants followed by a unit, not addresses of other ROMs, not ports), moved RAM variables are
# remapped where consistent, inline words after CALL $3E80 are translated (INLINE_CTX env: 'ROM ?1'
# for an editor ROM, 'ROM ?0' for a syntax ROM).
# Usage: python3 .ai/rom-annotations/tools/map-rom.py <workdir> <src.dis> <src.rom> <target.rom> <out-prefix> [<target-with-regions.dis>]
# Writes <out-prefix>-mapped.json and <out-prefix>-tgtraw.lst; run twice, the second time with the
# first build's sidecar as the last argument. Then build-mapped.py.
import re,sys,json,difflib,subprocess,collections
S,srcdis,srcrom,tgtrom,out=sys.argv[1:6]
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..')); ROMS=ROOT+'/src/public/roms/'
# --- SRC_PAGE / PAGE: the source's and the target's page in their files (a Next ROM file has four)
SRC_PAGE=int(os.environ.get('SRC_PAGE','0')); TGT_PAGE=int(os.environ.get('PAGE','0'))
def lst(args,env):
  return subprocess.run(['node',ROOT+'/.ai/rom-annotations/tools/sp48-dis.cjs','0000','3FFF']+args,capture_output=True,text=True,env={**os.environ,**env},cwd=ROOT).stdout
A=open(ROMS+srcrom,'rb').read()[SRC_PAGE*0x4000:(SRC_PAGE+1)*0x4000]; E=open(ROMS+tgtrom,'rb').read()[TGT_PAGE*0x4000:(TGT_PAGE+1)*0x4000]
la_txt=lst([srcdis],{'PAGE':str(SRC_PAGE)}); lb_txt=lst([sys.argv[6]],{'PAGE':str(TGT_PAGE)}) if len(sys.argv)>6 else lst([],{'ROM':tgtrom,'PAGE':str(TGT_PAGE)})
open(out+'-tgtraw.lst','w').write(lb_txt)
def parse(t):
  d={}
  for l in t.splitlines():
    m=re.match(r'^([0-9A-F]{4}) +((?:[0-9A-F]{2} )+) +(.*)$',l.rstrip())
    if m: d[int(m.group(1),16)]=m.group(3).split(';')[0].strip()
  return d
a=parse(la_txt); b=parse(lb_txt)
norm=lambda s: re.sub(r'\$[0-9A-F]{4}','N',re.sub(r'L[0-9A-F]{4}','L',s))
aa=sorted(a); bb=sorted(b)
sm=difflib.SequenceMatcher(None,[norm(a[x]) for x in aa],[norm(b[x]) for x in bb],autojunk=False)
M={}; ramdiff=collections.Counter(); ramsame=0; samep=set()
for blk in sm.get_matching_blocks():
  if blk.size<4: continue
  for k in range(blk.size):
    x=aa[blk.a+k]; y=bb[blk.b+k]; M[x]=y
    for p,q in zip(re.findall(r'\$([0-9A-F]{4})',a[x]),re.findall(r'\$([0-9A-F]{4})',b[y])):
      p=int(p,16);q=int(q,16)
      if p>=0x4000: 
        if p==q: ramsame+=1; samep.add(hex(p))
        else: ramdiff[(hex(p),hex(q))]+=1
# --- Fill small gaps: carry the nearest shift where the instruction there is the same
for _ in range(2):
  d=None
  for x in aa:
    if x in M: d=M[x]-x; continue
    if d is not None and (x+d) in b and norm(a[x])==norm(b[x+d]): M[x]=x+d
  d=None
  for x in reversed(aa):
    if x in M: d=M[x]-x; continue
    if d is not None and (x+d) in b and norm(a[x])==norm(b[x+d]): M[x]=x+d
src=json.load(open(srcdis)); sb=src['banks'][str(SRC_PAGE)]
R=[]; lost_regions=[]
for r in sb['regions']:
  if r['type']=='disassemble': continue
  blob=A[r['start']:r['end']+1]
  if r.get('decode')=='fill':
    before=[x for x in aa if x<r['start'] and x in M]
    if before:
      dd=M[before[-1]]-before[-1]; o=r['start']+dd; n=r['end']-r['start']+1
      if 0<=o and o+n<=0x4000 and E[o:o+n]==blob: R.append({**r,'start':o,'end':o+n-1})
    continue
  hits=[m.start() for m in re.finditer(re.escape(blob),E)]
  if len(hits)==1 or (hits and r['start'] in hits):
    o=r['start'] if r['start'] in hits else hits[0]
    R.append({**r,'start':o,'end':o+len(blob)-1})
    for k in range(len(blob)): M.setdefault(r['start']+k,o+k)
  else:
    # --- By position: the instructions on both sides moved by the same amount
    before=[x for x in aa if x<r['start'] and x in M]; after=[x for x in aa if x>r['end'] and x in M]
    placed=False
    if before and after:
      p0=before[-1]; n0=after[0]; d0=M[p0]-p0; d1=M[n0]-n0
      if d0==d1 and r['start']+d0>=0 and r['end']+d0<0x4000:
        o=r['start']+d0; R.append({**r,'start':o,'end':r['end']+d0}); placed=True
        for k in range(r['end']-r['start']+1): M.setdefault(r['start']+k,o+k)
    if not placed: lost_regions.append((hex(r['start']),hex(r['end']),len(hits)))
i=0
while i<len(E):
  if E[i] in (0,0xFF):
    j=i
    while j<len(E) and E[j]==E[i]: j+=1
    if j-i>=12 and not any(x['start']<=j-1 and i<=x['end'] for x in R): R.append({'start':i,'end':j-1,'type':'bytes','decode':'fill'})
    i=j
  else: i+=1
PORTS={0x1FFD,0x2FFD,0x3FFD,0x0FFD}
import os
INLINE_CTX=os.environ.get('INLINE_CTX','ROM ?1')
# --- ROM 1 addresses passed inline after CALL $3E80: the target's own word for the source's
ROM1MAP={}
for x in aa:
  if A[x:x+3]==bytes([0xCD,0x80,0x3E]) and x in M:
    y=M[x]
    if E[y:y+3]==bytes([0xCD,0x80,0x3E]):
      ROM1MAP[A[x+3]|A[x+4]<<8]=E[y+3]|E[y+4]<<8
RAMMAP={}
byp=collections.defaultdict(set)
for (p,q),n in ramdiff.items(): byp[p].add(q)
for p,qs in byp.items():
  if len(qs)==1 and p not in samep: RAMMAP[int(p,16)]=int(next(iter(qs)),16)
flag=[]
UNIT=re.compile(r'^\s*(half|misses|rounds|polls|bytes|cycles|times|frames|loops|counts|T-states|steps|ticks|x\b)')
def protected_spans(t):
  sp=[]
  for m in re.finditer(r"ROM ?[123]'s[^.;)]*",t): sp.append((m.start(),m.end()))
  for m in re.finditer(r"\(ROM ?[123]'s[^)]*\)",t): sp.append((m.start(),m.end()))
  return sp
def fix(t,where):
  bad=[]
  spans=protected_spans(t)
  def rp(g):
    pre=t[max(0,g.start()-10):g.start()]
    tok=g.group(0); hexs=g.group(2); v=int(hexs,16)
    ctx=t[max(0,g.start()-24):g.start()]
    after=t[g.end():g.end()+16]
    if UNIT.match(after) or re.match(r'^\s*in ROM ?[123]',after): return tok
    if any(a<=g.start()<b for a,b in spans):
      if re.search(INLINE_CTX,t[max(0,g.start()-60):g.start()]) and v in ROM1MAP: return f'{g.group(1)}{ROM1MAP[v]:04X}'
      return tok
    if re.search(INLINE_CTX,ctx) and v in ROM1MAP: return f'{g.group(1)}{ROM1MAP[v]:04X}'
    if re.search(r'ROM ?[123]|DOS',ctx): return tok
    if v in RAMMAP: return f'{g.group(1)}{RAMMAP[v]:04X}'
    if v>=0x4000 or v in PORTS or pre.endswith('DOS_JUMPS ') or pre.lower().endswith('port '): return tok
    if v in M: return f'{g.group(1)}{M[v]:04X}'
    bad.append(tok); return tok
  t2=re.sub(r'(\$|\bL)([0-9A-F]{4})\b',rp,t)
  if bad: flag.append((where,bad))
  return t2
labels=[]; L={}
for l in sorted(sb['localLabels'],key=lambda x:x['value']):
  if l['value'] in M: labels.append({'name':l['name'],'value':M[l['value']]})
for k,v in sb['lineAnnotations'].items():
  o=int(k)
  if o not in M: continue
  e={f:fix(v[f],M[o]) for f in ('synopsis','comment') if v.get(f)}
  if e: L[str(M[o])]=e
for r in R:
  if r['type'] in ('fill','text','defc'): r['decode']=r['type']; r['type']='bytes'
json.dump({'labels':labels,'lines':L,'regions':R,'flagged':flag},open(out+'-mapped.json','w'))
print(f'ROM 1 words {[(hex(a),hex(b)) for a,b in ROM1MAP.items()]}'); print(f'RAM remap {[(hex(a),hex(b)) for a,b in RAMMAP.items()]}'); print(f'{tgtrom}: mapped labels {len(labels)}/{len(sb["localLabels"])}, lines {len(L)}/{len(sb["lineAnnotations"])}, regions {len(R)}, lost regions {len(lost_regions)} {lost_regions[:12]}, flagged {len(flag)}, RAM same {ramsame} diff {sum(ramdiff.values())} {ramdiff.most_common(8)}')
