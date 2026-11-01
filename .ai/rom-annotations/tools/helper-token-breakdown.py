# Where a run's helpers spent their tokens: sums their transcripts (the Agent tool's JSONL outputs) into
# output and cached-input tokens, and the size of the tool results by kind of call (card reads, listings,
# compiles, searches). The baseline of .ai/rom-annotations/pipeline-baselines/exdos13-p8 was made with it.
# Usage: python3 .ai/rom-annotations/tools/helper-token-breakdown.py <folder of helper transcripts (*.output)>
import json,sys,glob,re,collections
cat=collections.Counter(); calls=collections.Counter(); out=0; reads=0; n=0
def kind(name,inp):
  if name=='Read':
    p=inp.get('file_path','')
    if '/cards/' in p: return 'read cards'
    if 'problems.md' in p: return 'read problems.md'
    if '.ann' in p: return 'read own .ann'
    if '.ai/' in p or 'annFormat' in p or '.plans' in p: return 'read docs/brief'
    return 'read other'
  if name=='Bash':
    c=inp.get('command','')
    if 'listing' in c: return 'listing'
    if 'compile' in c: return 'compile'
    if 'grep' in c or 'sed' in c or 'awk' in c or 'python' in c: return 'bash search/slice'
    return 'bash other'
  if name in ('Write','Edit'): return 'write/edit .ann'
  return name
folder=sys.argv[1] if len(sys.argv)>1 else 'tasks'
for f in glob.glob(folder.rstrip('/')+'/*.output'):
  ids={}; seen=set()
  for line in open(f):
    try: e=json.loads(line)
    except: continue
    m=e.get('message') or {}
    if not isinstance(m,dict): continue
    u=m.get('usage'); mid=m.get('id')
    if u and mid not in seen:
      seen.add(mid); out+=u.get('output_tokens',0); reads+=u.get('cache_read_input_tokens',0)
    for c in m.get('content') or []:
      if not isinstance(c,dict): continue
      if c.get('type')=='tool_use': ids[c['id']]=kind(c['name'],c.get('input',{})); calls[ids[c['id']]]+=1
      if c.get('type')=='tool_result':
        k=ids.get(c.get('tool_use_id'),'?'); t=c.get('content')
        size=len(json.dumps(t)) if not isinstance(t,str) else len(t)
        cat[k]+=size
  n+=1
print('transcripts',n,'output tokens',out,'cache-read tokens',reads)
tot=sum(cat.values())
for k,v in cat.most_common(): print(f'{k:22s} {v//4:>9,d} tokens of tool results ({100*v/tot:4.1f}%)  {calls[k]:4d} calls')
for k,v in calls.items():
  if k not in cat: print(f'{k:22s} (no result size) {v} calls')
