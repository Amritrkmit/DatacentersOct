const filterMeta={
 InOppZone:['In Opportunity Zone','Indicates whether the site is within a designated Opportunity Zone.'],
 NearElectL:['Near Electrical Transmission Lines','Indicates proximity to electrical transmission infrastructure; verify connection capacity separately.'],
 NearRR:['Near Railroad','Indicates proximity to railroad infrastructure.'],
 NearHwy:['Near Highway','Indicates proximity to a major highway.'],
 PopDensity:['Urban/Rural','Population density classification of the surrounding site area.'],
 Industrial:['Industrial','Planned or actual reuse for manufacturing, warehousing or other industrial activities.'],
 Greenspace:['Greenspace','Planned or actual reuse for parks, recreation, open space or ecological purposes.'],
 'Multi-Story':['Multi-Story','Indicates a multi-story building component for future site use.'],
 Commercial:['Commercial','Planned or actual reuse for retail, offices or other commercial purposes.'],
 Residential:['Residential','Planned or actual reuse for housing or residential purposes.'],
 'Ready for Anticipated Use?':['Ready for Anticipated Use?','Indicates whether the property is reported ready for its anticipated reuse.']
};
const config={redevelopment:{title:'Redevelopment sites',name:'Site_Name',filters:['InOppZone','NearRR','NearHwy','NearElectL','PopDensity']},brownfield:{title:'Brownfield properties',name:'Property Name',filters:['Industrial','Greenspace','Multi-Story','Commercial','Residential','Ready for Anticipated Use?']},moratorium:{title:'Moratorium records',name:'location',filters:['status']}};
const datasets={},selections={redevelopment:{},brownfield:{},moratorium:{}};let active='moratorium',map,markerLayer,openFilter=null;
const filterOptions={},markerCache={},visibleMarkers=new Set();let loadToken=0;
const canvasRenderer=L.canvas({padding:0.4});
const el=id=>document.getElementById(id),clean=v=>v==null||String(v).trim()===''?'Not specified':String(v).trim(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette={redevelopment:'#1674c5',brownfield:'#8B4513',moratorium:'#f28b26'};
function statusStyle(s){s=clean(s).toLowerCase();if(s.includes('ban'))return {color:'#262d3b',type:'ban',label:'Banned'};if(s.includes('reject'))return {color:'#dc3b49',type:'circle',label:'Rejected'};if(s.includes('expir')||s.includes('lift')||s.includes('supersed'))return {color:'#8d98a8',type:'circle',label:'Expired / Lifted'};if(s.includes('propos')||s.includes('process')||s.includes('explor'))return {color:'#8b54d7',type:'circle',label:'Proposed / In process'};if(s.includes('active'))return {color:'#f28b26',type:'circle',label:'Active'};return {color:'#2a98a7',type:'circle',label:'Other status'}}
async function load(){
 try{
  initMap();initTabs();
  fetch('data/filter-options.json').then(check).then(o=>Object.assign(filterOptions,o)).catch(()=>{});
  await ensureDataset('moratorium');renderFilters();update();
  // Prefetch remaining datasets only when the browser has spare time.
  const warm=()=>{ensureDataset('redevelopment').catch(console.warn);ensureDataset('brownfield').catch(console.warn)};
  if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:5000});
  else setTimeout(warm,1800);
 }catch(e){el('subtitle').textContent='Unable to load data: '+e.message;console.error(e)}
}
async function ensureDataset(tab){
 if(datasets[tab])return datasets[tab];
 if(!datasetPromises[tab])datasetPromises[tab]=fetch('data/'+tab+'.json').then(check).then(data=>{
  datasets[tab]=data;return data;
 }).catch(e=>{delete datasetPromises[tab];throw e});
 return datasetPromises[tab];
}
const datasetPromises={};
function check(r){if(!r.ok)throw Error('HTTP '+r.status+' '+r.url);return r.json()}
function initMap(){
 map=L.map('map',{zoomControl:false,preferCanvas:false}).setView([39,-97],4);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:18}).addTo(map);
 L.control.zoom({position:'bottomright'}).addTo(map);
 markerLayer=L.layerGroup().addTo(map);
 el('zoomIn').onclick=()=>map.zoomIn();el('zoomOut').onclick=()=>map.zoomOut();el('zoomReset').onclick=()=>map.setView([39,-97],4);
 el('closeDetail').onclick=()=>el('detail').classList.add('hidden');
}
function markerIcon(color,triangle,banned){
 const shape='<circle cx="14" cy="14" r="6.6" fill="'+color+'" stroke="white" stroke-width="1.6"/>';
 const halo='<circle cx="14" cy="14" r="10.2" fill="'+color+'" opacity="0.19"/>';
 const cross=banned?'<path d="M11 11 L17 17 M17 11 L11 17" stroke="white" stroke-width="1.7" stroke-linecap="round"/>':'';
 return L.divIcon({className:'site-marker',html:'<svg viewBox="0 0 28 28" width="28" height="28">'+halo+shape+cross+'</svg>',iconSize:[28,28],iconAnchor:[14,14]});
}
function initTabs(){
 document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=async()=>{
  active=btn.dataset.tab;const token=++loadToken;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
  el('detail').classList.add('hidden');el('tooltip').classList.add('hidden');openFilter=null;
  if(!datasets[active]){el('subtitle').textContent='Loading '+active+' data…';el('filters').replaceChildren();}
  try{await ensureDataset(active);if(token!==loadToken)return;renderFilters();update();}
  catch(e){if(token===loadToken)el('subtitle').textContent='Could not load data: '+e.message}
 });
 el('reset').onclick=()=>{selections[active]={};openFilter=null;renderFilters();update()};
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.filter')){document.querySelectorAll('.filter-menu').forEach(x=>x.classList.add('hidden'));openFilter=null;document.querySelectorAll('.filter').forEach(f=>f.classList.remove('expanded'))}});
}
function renderFilters(){const parent=el('filters');parent.replaceChildren();for(const key of config[active].filters){const vals=filterOptions[active]?.[key] || [...new Set(datasets[active].map(d=>clean(d[key])))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const wrap=document.createElement('div');wrap.className='filter';const label=document.createElement('label');label.textContent=key==='status'?'Status':(filterMeta[key]?.[0]||key);
 if(filterMeta[key]){const info=document.createElement('span');info.className='filter-info';info.textContent='ⓘ';info.tabIndex=0;info.setAttribute('role','note');info.setAttribute('aria-label',filterMeta[key][1]);const bubble=document.createElement('span');bubble.className='info-bubble';bubble.textContent=filterMeta[key][1];info.append(bubble);label.append(info)}const trigger=document.createElement('button');trigger.className='filter-trigger';trigger.type='button';const menu=document.createElement('div');menu.className='filter-menu hidden';const search=document.createElement('input');search.className='filter-search';search.placeholder='Search values...';search.setAttribute('aria-label','Search '+key);const actions=document.createElement('div');actions.className='filter-actions';const all=document.createElement('button');all.textContent='Select all';const clear=document.createElement('button');clear.textContent='Clear';actions.append(all,clear);const options=document.createElement('div');options.className='filter-options';function drawOptions(q=''){options.replaceChildren();for(const v of vals.filter(v=>v.toLowerCase().includes(q.toLowerCase()))){const row=document.createElement('label');row.className='filter-option';const input=document.createElement('input');input.type='checkbox';input.checked=(selections[active][key]||[]).includes(v);input.onchange=()=>{const s=new Set(selections[active][key]||[]);input.checked?s.add(v):s.delete(v);if(s.size)selections[active][key]=[...s];else delete selections[active][key];refreshTrigger();update()};const span=document.createElement('span');span.textContent=v;row.append(input,span);options.append(row)}if(!options.children.length)options.textContent='No matching values'}function refreshTrigger(){const s=selections[active][key]||[];trigger.innerHTML=`<span class="filter-value">${s.length?esc(s.length===1?s[0]:s.length+' selected'):'All values'}</span><span class="chevron"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></span>`;trigger.classList.toggle('selected',!!s.length)}trigger.onclick=()=>{const wasOpen=!menu.classList.contains('hidden');document.querySelectorAll('.filter-menu').forEach(x=>x.classList.add('hidden'));menu.classList.toggle('hidden',wasOpen);wrap.classList.toggle('expanded',!wasOpen);document.querySelectorAll('.filter').forEach(f=>{if(f!==wrap)f.classList.remove('expanded')});if(!wasOpen)search.focus()};search.oninput=()=>drawOptions(search.value);all.onclick=()=>{selections[active][key]=[...vals];refreshTrigger();drawOptions(search.value);update()};clear.onclick=()=>{delete selections[active][key];refreshTrigger();drawOptions(search.value);update()};menu.append(search,actions,options);wrap.append(label,trigger,menu);parent.append(wrap);refreshTrigger();drawOptions()}}
function filtered(){return datasets[active].filter(d=>Object.entries(selections[active]).every(([k,values])=>values.includes(clean(d[k]))))}
const omitted={brownfield:new Set(['property id','property name','latitude','longitude','objectid','object id','x','y','property highlights']),redevelopment:new Set(['objectid','object id','site_id','site id','region','latitude','longitude','x','y']),moratorium:new Set(['objectkey','object key','fetchdate','fetch data','enddate','end date','developer','vote','lat','lng','latitude','longitude','location'])};
function keynorm(k){return k.toLowerCase().replace(/[\s_-]+/g,'')}
function safeLink(v){try{const u=new URL(String(v).trim());return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
function recordTitle(d){if(active==='redevelopment'){const city=clean(d.City),state=clean(d.State);return `${city==='Not specified'?'Site':city}${state==='Not specified'?'':', '+state}`}return clean(d[config[active].name])}
function displayLabel(key){
 const special={dateenacted:'Date Enacted',snapshotlink:'Snapshot Link',popdensity:'Population Density',inoppzone:'In Opportunity Zone',nearrr:'Near Railroad',nearhwy:'Near Highway',nearelectl:'Near Electric Line',multistory:'Multi-Story',actualorplannedfutureuse:'Actual or Planned Future Use',url:'URL'};
 const norm=keynorm(key);
 if(special[norm])return special[norm];
 return String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase());
}
function fields(d){let html='<div class="data-grid">';for(const [k,v] of Object.entries(d)){if(k.startsWith('_')||omitted[active].has(k.toLowerCase())||omitted[active].has(keynorm(k)))continue;const val=clean(v),normalized=keynorm(k);if(active==='redevelopment'&&normalized==='snapshotlink'||active==='moratorium'&&normalized==='url'){const url=safeLink(v);html+=`<div class="data-field"><span>${esc(displayLabel(k))}</span>${url?`<a class="record-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Read More ↗</a>`:`<strong>${esc(val)}</strong>`}</div>`;continue}if((active==='brownfield'&&normalized==='actualorplannedfutureuse')||(active==='moratorium'&&normalized==='reason')){const isLong=val.length>95;html+=`<div class="data-field data-field-wide"><span>${esc(displayLabel(k))}</span><div class="expandable-text${isLong?' is-collapsed':''}">${esc(val)}</div>${isLong?'<button type="button" class="expand-text-btn" aria-expanded="false">Read more ↓</button>':''}</div>`;continue}html+=`<div class="data-field"><span>${esc(displayLabel(k))}</span><strong>${esc(val)}</strong></div>`}return html+'</div>'}
function wireReadMore(container){container.querySelectorAll('.expand-text-btn').forEach(button=>button.addEventListener('click',()=>{const content=button.previousElementSibling;const expanded=content.classList.toggle('is-collapsed')===false;button.textContent=expanded?'Show less ↑':'Read more ↓';button.setAttribute('aria-expanded',String(expanded))}))}
function tooltip(ev,d){const t=el('tooltip'),rect=el('map').getBoundingClientRect(),color=active==='moratorium'?statusStyle(d.status).color:palette[active];t.innerHTML=`<div class="tooltip-header"><span class="tooltip-bullet" style="background:${color}"></span><strong>${esc(recordTitle(d))}</strong></div><div class="tooltip-scroll">${fields(d)}</div><div class="tooltip-footer">Click circle to open interactive details</div>`;t.classList.remove('hidden');const width=Math.min(390,rect.width-24),left=ev.clientX-rect.left;t.style.width=width+'px';t.style.left=Math.max(12,Math.min(left+18,rect.width-width-12))+'px';t.style.top=Math.max(10,Math.min(ev.clientY-rect.top-55,rect.height-370))+'px'}
function createSiteMarker(d){
 const lat=Number(d._lat),lon=Number(d._lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const tab=active; // cache is created for the current dataset
 const status=tab==='moratorium'?statusStyle(d.status):null;
 const color=status?status.color:palette[tab];
 const banned=status?.type==='ban';
 const marker=banned
  ? L.marker([lat,lon],{icon:markerIcon(color,false,true),keyboard:true,title:recordTitle(d)})
  : L.circleMarker([lat,lon],{renderer:canvasRenderer,radius:7.2,color:'#fff',weight:1.7,fillColor:color,fillOpacity:0.95,interactive:true});
 marker.on('mouseover',e=>{
  if(!banned)marker.setStyle({radius:9,weight:2.3});
  const pos=map.latLngToContainerPoint(e.latlng),rect=el('map').getBoundingClientRect();
  tooltip({clientX:rect.left+pos.x,clientY:rect.top+pos.y},d);
 });
 marker.on('mouseout',()=>{if(!banned)marker.setStyle({radius:7.2,weight:1.7});el('tooltip').classList.add('hidden')});
 marker.on('click',()=>{
  const isBanned=banned;
  el('detailTitle').innerHTML=`<span class="detail-title-wrap"><span class="detail-status-dot" style="background-color:${color}">${isBanned?'<span class="detail-status-x">×</span>':''}</span><span>${esc(recordTitle(d))}</span></span>`;
  el('detailContent').innerHTML=fields(d);wireReadMore(el('detailContent'));
  el('detail').classList.remove('hidden');el('tooltip').classList.add('hidden');
 });
 return {data:d,marker,tab};
}
function update(){
 if(!datasets[active])return;
 const records=filtered();el('count').textContent=records.length.toLocaleString();el('maptitle').textContent=config[active].title;
 el('subtitle').textContent=`${records.length.toLocaleString()} of ${datasets[active].length.toLocaleString()} records match filters`;
 el('legend').innerHTML=active==='moratorium'?[['Active','#f28b26'],['Proposed / In process','#8b54d7'],['Rejected','#dc3b49'],['Banned','#262d3b'],['Expired / Lifted','#8d98a8'],['Other','#2a98a7']].map(([name,color])=>`<span class="legend-item"><i style="background:${color}"></i>${name}</span>`).join(''):`<span class="legend-item"><i style="background:${palette[active]}"></i>${active==='redevelopment'?'Redevelopment':'Brownfield'} location</span>`;
 // Reuse layers instead of reconstructing every marker on every filter change.
 const cache=markerCache[active]||(markerCache[active]=datasets[active].map(d=>createSiteMarker(d)));
 const selected=new Set(records);
 for(const item of visibleMarkers){if(!selected.has(item.data)||item.tab!==active){markerLayer.removeLayer(item.marker);visibleMarkers.delete(item)}}
 for(const item of cache){if(item&&selected.has(item.data)&&!visibleMarkers.has(item)){
   markerLayer.addLayer(item.marker);visibleMarkers.add(item);
 }}
}
load();
