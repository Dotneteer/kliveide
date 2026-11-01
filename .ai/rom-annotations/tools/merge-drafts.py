# Merges helper drafts (JSON: labels, synopses, comments, regions, manual, facts) into a copy of a ROM sidecar.
# "manual" lists "$xxxx:label" / "$xxxx:line" keys whose name or text is an interface fact from a manual.
# For a carried sidecar (rom:annotations:carry), "replace" (["$xxxx:synopsis", "$xxxx:comment"]) lets a draft's
# synopsis or comment overwrite the one already there, and "rename" ({"$xxxx": "NEW_NAME"}) renames an existing label.
# Usage: [PAGE=<n>] python3 .ai/rom-annotations/tools/merge-drafts.py <workdir> <in.dis> <out.dis> <draft.json>...
# Existing labels and synopses win (reported); a name that clashes gets _2 (reported); a region that
# overlaps a data region is skipped (reported); synopses are wrapped at 92 columns. Then canonicalise
# with apply-annotations.cjs and an empty batch, and check with check-annotations.cjs.
import json,sys,textwrap,re
S,inp,outp=sys.argv[1:4]; drafts=sys.argv[4:]
d=json.load(open(inp)); import os
PAGE=os.environ.get('PAGE','0')
b=d['banks'][PAGE]; A=b['lineAnnotations']; pv=d['provenance']
def W(text):
    text=text.strip()
    paras=re.split(r'\n+|(?<=[.:)])\s+(?=(?:\d+\. |Exit:|Entry:|Changes:|Observed:))',text)
    o=[]
    for p in paras:
        p=p.strip()
        if not p: continue
        m=re.match(r'^(\d+\. |- )',p); ind=' '*len(m.group(1)) if m else ''
        o+=textwrap.wrap(p,92,subsequent_indent=ind,break_on_hyphens=False)
    return '\n'.join(o)
H=lambda k:int(k.strip('$'),16)
names={l['name']:l['value'] for l in b['localLabels']}; vals={l['value'] for l in b['localLabels']}
# --- The page ends where its last region ends ($3FFF for a 16K page, $2FFF for the HT-1080Z's 12K BASIC)
PAGE_END=max(r['end'] for r in b['regions'])
regions=[r for r in b['regions'] if r['type']!='disassemble']; report=[]
for f in drafts:
    dr=json.load(open(f)); tag=f.split('/')[-1]
    for r in dr.get('regions',[]):
        s,e=H(r['start']),H(r['end'])
        if any(not(e<x['start'] or s>x['end']) for x in regions): report.append(f"{tag}: region {r['start']}-{r['end']} overlaps, skipped"); continue
        nr={"start":s,"end":e,"type":r.get('type','bytes')}
        if r.get('decode'): nr['decode']=r['decode']
        if r.get('rowBytes'): nr['rowBytes']=r['rowBytes']
        regions.append(nr); pv[f'{PAGE}:{s}:region']='observed'
    for k,n in dr.get('rename',{}).items():
        a=H(k); old=[l for l in b['localLabels'] if l['value']==a]
        if not old: report.append(f"{tag}: rename {k} names no label"); continue
        if n in names and names[n]!=a: report.append(f"{tag}: rename {k} to {n}: name taken"); continue
        names.pop(old[0]['name'],None); old[0]['name']=n; names[n]=a; pv[f'{PAGE}:{a}:label']='observed'
    rep=set(dr.get('replace',[]))
    for key in rep:
        at,kind=key.split(':'); e=A.get(str(H(at)))
        if e is not None and kind in ('synopsis','comment'): e.pop(kind,None)
    for k,n in dr.get('labels',{}).items():
        a=H(k)
        if a in vals: report.append(f"{tag}: {k} already labelled, {n} skipped"); continue
        if len(n)>16 or not re.fullmatch(r'[A-Z_][A-Z0-9_]*',n): report.append(f"{tag}: bad name {n}"); continue
        if n in names:
            n2=n[:14]+'_2' if len(n)>14 else n+'_2'
            report.append(f"{tag}: name {n} taken (at ${names[n]:04X}); {k} renamed {n2}"); n=n2
        b['localLabels'].append({"name":n,"value":a}); names[n]=a; vals.add(a); pv[f'{PAGE}:{a}:label']='observed'
    for k,t in dr.get('synopses',{}).items():
        a=H(k); e=A.setdefault(str(a),{})
        if e.get('synopsis'): report.append(f"{tag}: {k} has a synopsis, kept"); continue
        e['synopsis']=W(t); pv[f'{PAGE}:{a}:line']='observed'
    for k,t in dr.get('comments',{}).items():
        a=H(k); e=A.setdefault(str(a),{})
        if e.get('comment'): continue
        e['comment']=t.strip().rstrip('.'); pv[f'{PAGE}:{a}:line']='observed'
    # --- "manual": ["$xxxx:label", "$xxxx:line"]: entries that state an interface fact from a manual
    for k in dr.get('manual',[]):
        at,kind=k.split(':'); key=f'{PAGE}:{H(at)}:{kind}'
        if key in pv: pv[key]='manual'
        else: report.append(f"{tag}: manual {k} names no entry of this draft")
regions.sort(key=lambda r:r['start']); out=[];at=0
for r in regions:
    if r['start']>at: out.append({"start":at,"end":r['start']-1,"type":"disassemble"})
    out.append(r); at=r['end']+1
if at<=PAGE_END: out.append({"start":at,"end":PAGE_END,"type":"disassemble"})
b['regions']=out; b['localLabels'].sort(key=lambda l:l['value'])
json.dump(d,open(outp,'w'))
print('\n'.join(report)); print('labels',len(b['localLabels']))
