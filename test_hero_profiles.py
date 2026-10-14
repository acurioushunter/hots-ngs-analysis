import json,sys,pathlib
D=pathlib.Path('knowledge/expert/hero_profiles')
TAGS=set("low_sustain_healer high_sustain_healer single_target_healer aoe_healer no_healer_sustain burst_dive poke_comp sustain_comp tanky_frontline squishy_backline kiter assassin cc_heavy stealth immobile mobile melee_heavy ranged_heavy summons structures global_ult split_push objective_race".split())
R=("wave_clear camp_clear siege teamfight engage peel mobility self_sustain survivability objective global_presence solo_lane").split()
def chk(p):
    e=[]; d=json.loads(p.read_text(encoding='utf-8'))
    for k in ("hero","slug","role","attack","damage","ratings","cc","good_into","bad_into","power_spike","evidence","confidence"):
        if k not in d: e.append('missing '+k)
    if e: return e
    if d['attack'].get('type') not in ('ranged','melee','hybrid'): e.append('attack.type')
    if d['attack'].get('range') not in ('melee','short','medium','long'): e.append('attack.range')
    if not isinstance(d['damage'].get('ranged_dealer'),bool) or not isinstance(d['damage'].get('carry'),bool): e.append('damage bools')
    if d['role']=='Healer' and d['damage'].get('ranged_dealer'): e.append('healer marked ranged_dealer')
    if d['role'] in('Healer',) and not d.get('healing'): e.append('healer without healing block')
    for r in R:
        v=d['ratings'].get(r)
        if not isinstance(v,(int,float)) or not 0<=v<=5: e.append('rating '+r)
    for k in ('good_into','bad_into'):
        for x in d[k]:
            if x.get('tag') not in TAGS: e.append(k+' tag '+str(x.get('tag')))
    for s in json.dumps(d,ensure_ascii=False).split('"'):
        pass
    if d['damage'].get('poke') is None: e.append('poke')
    return e
bad=0
for p in sorted(D.glob('*.json')):
    try: e=chk(p)
    except Exception as ex: e=['unreadable '+str(ex)]
    if e: bad+=1; print(p.name,e)
n=len(list(D.glob('*.json')))
print(n,'profiles,',bad,'with problems')
print('OK' if bad==0 and n>=91 else 'FAILED')
sys.exit(0 if bad==0 and n>=91 else 1)
