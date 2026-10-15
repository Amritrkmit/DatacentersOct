from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent
fields={'moratorium':['status'],'redevelopment':['InOppZone','NearRR','NearHwy','NearElectL','PopDensity'],'brownfield':['Industrial','Greenspace','Multi-Story','Commercial','Residential','Ready for Anticipated Use?']}
out={}
for tab,keys in fields.items():
    data=json.loads((root/'data'/f'{tab}.json').read_text(encoding='utf-8'))
    out[tab]={k:sorted(set('Not specified' if row.get(k) is None or str(row.get(k)).strip()=='' else str(row[k]).strip() for row in data),key=str.casefold) for k in keys}
(root/'data'/'filter-options.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Precomputed dropdown values for',', '.join(out))
