# Builds a sidecar from map-rom.py's mapping: regions first, then labels and lines on instruction
# starts or data, provenance "derived", then the check (printed).
# Usage: python3 .ai/rom-annotations/tools/build-mapped.py <workdir> <out-prefix> <target.rom> "<page name>" <out.dis>
import json,sys,subprocess,re,os,zlib
S,pre,rom,name,out=sys.argv[1:6]
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..')); T=ROOT+'/.ai/rom-annotations/tools'
PG=os.environ.get('PAGE','0'); E=open(ROOT+'/src/public/roms/'+rom,'rb').read()[int(PG)*0x4000:(int(PG)+1)*0x4000]
m=json.load(open(pre+'-mapped.json'))
d={"schemaVersion":3,"machine":"rom","source":{"fileName":rom},"authoring":".ai/rom-annotations/README.md","level":0,
 "pages":{PG:{"crc32":"%08x"%zlib.crc32(E),"name":name}},
 "banks":{PG:{"offsetIndex":0,"regions":[{"start":0,"end":len(E)-1,"type":"disassemble"}],"localLabels":[],"lineAnnotations":{}}},"provenance":{}}
json.dump(d,open(out,'w'),indent=2)
H=lambda x:f'${x:04X}'
regs=[{**{k:v for k,v in r.items() if k not in('start','end','provenance','source')},'start':H(r['start']),'end':H(r['end'])} for r in m['regions']]
json.dump({"labels":{},"lines":{},"dataLabels":{},"manualLines":[],"regions":regs},open(pre+'-reg.json','w'))
run=lambda *a: subprocess.run(['node',*a],cwd=ROOT,capture_output=True,text=True)
print(run(T+'/apply-annotations.cjs',out,pre+'-reg.json','/dev/null').stdout.strip().splitlines()[-1])
full=run(T+'/sp48-dis.cjs','0000','3FFF',out).stdout; open(pre+'-full.lst','w').write(full)
code='\n'.join(l for l in full.splitlines() if '.def' not in l and '.fill' not in l)+'\n'; open(pre+'-code.lst','w').write(code)
ins={int(l[:4],16) for l in code.splitlines() if re.match(r'^[0-9A-F]{4} ',l)}
data=lambda o: any(r['start']<=o<=r['end'] and r.get('decode')!='fill' for r in m['regions'])
fill=lambda o: any(r['start']<=o<=r['end'] and r.get('decode')=='fill' for r in m['regions'])
lab={};dat={};L={};skipped=[];names=set()
for l in m['labels']:
  o=l['value']
  if l['name'] in names or fill(o): skipped.append((hex(o),l['name'])); continue
  if o in ins: lab[H(o)]=l['name']; names.add(l['name'])
  elif data(o): dat[H(o)]=l['name']; names.add(l['name'])
  else: skipped.append((hex(o),l['name']))
for k,v in m['lines'].items():
  o=int(k)
  if (o in ins or data(o)) and not fill(o): L[H(o)]=v
json.dump({"labels":lab,"dataLabels":dat,"lines":L,"regions":[],"manualLines":[]},open(pre+'-ent.json','w'))
r=run(T+'/apply-annotations.cjs',out,pre+'-ent.json',pre+'-code.lst'); print('\n'.join(x for x in r.stdout.splitlines() if 'LABEL IN DATA' not in x)[-600:])
d=json.load(open(out))
for k in list(d['provenance']):
  if not k.endswith(':region'): d['provenance'][k]='derived'
json.dump(d,open(out,'w'),indent=2)
open(pre+'-empty.json','w').write('{"labels":{},"lines":{},"regions":[],"dataLabels":{},"manualLines":[]}')
run(T+'/apply-annotations.cjs',out,pre+'-empty.json',pre+'-code.lst')
run(T+'/check-annotations.cjs',out,pre+'-check.json')
c=json.load(open(pre+'-check.json'))
print('(page',PG,') skipped labels',len(skipped),skipped[:10]); print('problems',c['problems'][:5],'labels',c['labels'],'nosyn',c['labelsWithoutSynopsis'],'unlabelled',len(c['unlabelledTargets'][PG]),[hex(x) for x in c['unlabelledTargets'][PG]][:30])
