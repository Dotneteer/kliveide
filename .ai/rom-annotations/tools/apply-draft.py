# Applies a draft's "fixes" first (synopsis/comment overwrites, label moves {"label": NAME}, removals
# {"remove": true}), then merges its new entries with merge-drafts.py.
# Usage: [PAGE=<n>] python3 .ai/rom-annotations/tools/apply-draft.py <workdir> <in.dis> <out.dis> <draft.json>[:replace=XXXX-YYYY,...]...
# ":replace=" ranges: every data region overlapping them is dropped first (the draft's regions replace them).
import json,sys,textwrap,re,subprocess
S,inp,out=sys.argv[1:4]
drafts=[]; replace=[]
for a in sys.argv[4:]:
  if ':replace=' in a:
    path,rngs=a.split(':replace='); drafts.append(path)
    for rng in rngs.split(','):
      lo,hi=[int(x.strip('$'),16) for x in rng.split('-')]; replace.append((lo,hi))
  else: drafts.append(a)
def W(t):
  o=[]
  for para in t.split('\n'): o+=textwrap.wrap(para,92,subsequent_indent='   ' if re.match(r'^\d+\. ',para) else '')
  return '\n'.join(o)
import os
PAGE=os.environ.get('PAGE','0')
d=json.load(open(inp)); b=d['banks'][PAGE]; la=b['lineAnnotations']
fixes={}
for p in drafts:
  for k,v in json.load(open(p)).get('fixes',{}).items(): fixes.setdefault(k.upper(),{}).update(v)
# --- Removals first: the label and the line at that address
for k,v in list(fixes.items()):
  if v.get('remove'):
    o=int(k[1:],16)
    b['localLabels']=[l for l in b['localLabels'] if l['value']!=o]; la.pop(str(o),None)
    for key in list(d['provenance']):
      if key.startswith(f'{PAGE}:{o}:') and not key.endswith(':region'): d['provenance'].pop(key)
    fixes.pop(k)
# --- Regions a draft replaces: every data region overlapping its range goes
for lo,hi in replace:
  b['regions']=[r for r in b['regions'] if r['type']=='disassemble' or r['end']<lo or r['start']>hi]
  for key in list(d['provenance']):
    if key.startswith(f'{PAGE}:') and key.endswith(':region') and lo<=int(key.split(':')[1])<=hi: d['provenance'].pop(key)
# --- Rebuild the disassemble regions around the data that is left
# --- The page ends where its last region ends ($3FFF for a 16K page, $2FFF for the HT-1080Z's 12K BASIC)
PAGE_END=max(r['end'] for r in b['regions'])
data=sorted([r for r in b['regions'] if r['type']!='disassemble'],key=lambda r:r['start'])
regs=[];pos=0
for r in data:
  if r['start']>pos: regs.append({'start':pos,'end':r['start']-1,'type':'disassemble'})
  regs.append(r); pos=r['end']+1
if pos<=PAGE_END: regs.append({'start':pos,'end':PAGE_END,'type':'disassemble'})
b['regions']=regs
moves={int(k[1:],16):v['label'] for k,v in fixes.items() if 'label' in v}
nn=set(moves.values())
b['localLabels']=[l for l in b['localLabels'] if l['value'] not in moves and l['name'] not in nn]
for o,n in moves.items(): b['localLabels'].append({'name':n,'value':o}); d['provenance'][f'{PAGE}:{o}:label']='observed'
for k,v in fixes.items():
  o=int(k[1:],16); e=la.setdefault(str(o),{})
  if 'synopsis' in v: e['synopsis']=W(v['synopsis'])
  if 'comment' in v: e['comment']=v['comment']
  d['provenance'][f'{PAGE}:{o}:line']='observed'
mid=out+'.fixed'; json.dump(d,open(mid,'w'),indent=2)
names={l['name'] for l in b['localLabels']}
prep=[]
for i,p in enumerate(drafts):
  dr=json.load(open(p)); dr.pop('fixes',None)
  dl=dr.pop('dataLabels',{}); dr['labels']={**dr.get('labels',{}),**(dl if isinstance(dl,dict) else {})}
  dr['labels']={k:v for k,v in dr['labels'].items() if int(k[1:],16) not in moves}
  q=f'{out}.d{i}.json'; json.dump(dr,open(q,'w'),indent=1); prep.append(q)
print(subprocess.run(['python3',os.path.join(os.path.dirname(__file__),'merge-drafts.py'),S,mid,out]+prep,capture_output=True,text=True).stdout[-800:])
