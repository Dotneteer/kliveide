# Gives every byte after a CALL to the error routines (labels ERROR_128 and FILE_ERROR) a one-byte
# data region, and resolves overlapping data regions (the first wins). For ROMs whose error routine
# takes an inline code byte at a different address in each version (the +3's syntax ROM).
# Usage: python3 .ai/rom-annotations/tools/error-bytes.py <sidecar.dis> <rom file>
import json,sys,re,subprocess
dis,rom=sys.argv[1:3]; import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..')); T=ROOT+'/.ai/rom-annotations/tools'
run=lambda *a: subprocess.run(['node',*a],cwd=ROOT,capture_output=True,text=True).stdout
d=json.load(open(dis)); b=d['banks'][os.environ.get('PAGE','0')]
# --- Overlaps: keep the first of two overlapping data regions
data=sorted([r for r in b['regions'] if r['type']!='disassemble'],key=lambda r:(r['start'],-r['end']))
kept=[]
for r in data:
  if kept and r['start']<=kept[-1]['end']: print('drop overlapping',hex(r['start']),hex(r['end'])); continue
  kept.append(r)
regs=[];pos=0
for r in kept:
  if r['start']>pos: regs.append({'start':pos,'end':r['start']-1,'type':'disassemble'})
  regs.append(r); pos=r['end']+1
if pos<=0x3FFF: regs.append({'start':pos,'end':0x3FFF,'type':'disassemble'})
b['regions']=regs
json.dump(d,open(dis,'w'),indent=2)
names={l['name']:l['value'] for l in b['localLabels']}
targets={names[n] for n in ('ERROR_128','FILE_ERROR') if n in names}
print('error routines',[hex(t) for t in targets])
r=open(ROOT+'/src/public/roms/'+rom,'rb').read()
for _ in range(3):
  lst=run(T+'/sp48-dis.cjs','0000','3FFF',dis)
  ins={int(l[:4],16):l for l in lst.splitlines() if re.match(r'^[0-9A-F]{4} ',l)}
  data=[x for x in b['regions'] if x['type']!='disassemble']
  covered=lambda o: any(x['start']<=o<=x['end'] for x in data)
  sites=[a+3 for a,l in ins.items() if r[a]==0xCD and (r[a+1]|r[a+2]<<8) in targets and not covered(a+3)]
  if not sites: break
  batch={"labels":{},"lines":{},"dataLabels":{},"manualLines":[],"regions":[{"start":f"${o:04X}","end":f"${o:04X}","type":"bytes"} for o in sites]}
  json.dump(batch,open(dis+'.err.json','w'))
  d=json.load(open(dis)); la=d['banks'][os.environ.get('PAGE','0')]['lineAnnotations']
  for o in sites: la.pop(str(o),None)
  json.dump(d,open(dis,'w'),indent=2)
  print(run(T+'/apply-annotations.cjs',dis,dis+'.err.json','/dev/null').strip().splitlines()[-1], 'added',len(sites))
  d=json.load(open(dis)); b=d['banks'][os.environ.get('PAGE','0')]
