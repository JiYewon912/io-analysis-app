const $=id=>document.getElementById(id);
const fmt=x=>Number(x).toLocaleString('ko-KR',{maximumFractionDigits:3});
let currentLevel='';
let worker, nextId=0, requests=new Map(), sectors=[], rowChoices=[], cells=[], basket=[], result=null;
function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
function call(type,payload){return new Promise((resolve,reject)=>{const id=++nextId;requests.set(id,{resolve,reject});worker.postMessage({id,type,payload});});}
function startWorker(){worker=new Worker('./worker.js');worker.onmessage=({data:d})=>{if(d.type==='status'){$('status').textContent=d.text;return;}const p=requests.get(d.id);if(!p)return;requests.delete(d.id);d.ok?p.resolve(d.result):p.reject(Error(d.error));};worker.onerror=e=>{for(const p of requests.values())p.reject(Error(e.message||'Worker 실행 오류'));requests.clear();};}
function options(el,list){el.replaceChildren(...list.map(x=>{const o=document.createElement('option');o.value=x.code;o.textContent=x.code+' '+x.name;return o;}));}
function invalidate(){result=null;$('results').hidden=true;}
async function load(buffer){
 invalidate();basket=[];renderBasket();
 for(const id of ['sheet','row','sector','add','run','row-search','col-search','sector-search','amount'])$(id).disabled=true;
 for(const p of requests.values())p.reject(Error('데이터 다시 로드'));requests.clear();if(!worker)startWorker();
 try{const info=await call('init',buffer);sectors=info.sectors;options($('sector'),sectors);$('sector-search').value='';$('row-search').value='';$('col-search').value='';$('sheet').replaceChildren(...info.sheets.map(s=>{const o=text('option',s);o.value=s;return o;}));
 $('validation').textContent=JSON.stringify(info.residuals,null,2)+'\n최대 절대 잔차: 허용값 1e-8 미만';
 for(const id of ['sheet','row','sector','add','run','row-search','col-search','sector-search','amount'])$(id).disabled=false;
 currentLevel=info.level;$('level-badge').textContent='2023 · 생산자가격 · '+info.level+' '+sectors.length+'개 부문';
 await explore();await loadLinkage();$('status').textContent='준비 완료 · '+info.level+' · '+sectors.length+'개 부문 · '+info.sheets.length+'개 시트 · 계수 검증 통과';
 }catch(e){$('status').textContent='준비 실패: '+e.message+' — 새로고침 후 재시도하세요.';}
}
let exploreSeq=0;
async function explore(){const seq=++exploreSeq;try{const d=await call('explore',{sheet:$('sheet').value,row:$('row').value});if(seq!==exploreSeq)return;rowChoices=d.rows;filterRows(d.selected);cells=d.cells;$('unit').textContent=d.unit;$('explore-caption').textContent=$('sheet').value+' / 행: '+d.selected+' '+d.name;renderCells();}catch(e){$('status').textContent=e.message;}}
function filterRows(selected){const q=$('row-search').value.trim();options($('row'),rowChoices.filter(r=>(r.code+' '+r.name).includes(q)));if([...$('row').options].some(o=>o.value===selected))$('row').value=selected;}
function renderCells(){const q=$('col-search').value.trim();$('cells').replaceChildren(...cells.filter(c=>(c.code+' '+c.name).includes(q)).map(c=>{const tr=document.createElement('tr');for(const v of [c.code,c.name,c.value===null?'빈 셀':typeof c.value==='number'?fmt(c.value):c.value])tr.append(text('td',v));return tr;}));}
$('sheet').onchange=()=>{$('row-search').value='';$('row').replaceChildren();explore();};$('row').onchange=explore;
$('row-search').oninput=()=>{filterRows();if($('row').value)explore();else{$('cells').replaceChildren();$('explore-caption').textContent='일치하는 행이 없습니다.';}};
$('col-search').oninput=renderCells;
$('sector-search').oninput=()=>{const q=$('sector-search').value.trim();options($('sector'),sectors.filter(s=>(s.code+' '+s.name).includes(q)));};
function renderBasket(){$('basket').replaceChildren(...basket.map((s,i)=>{const li=text('li',s.code+' '+s.name+' / '+fmt(s.amount)+'백만원 ');const b=text('button','삭제');b.type='button';b.onclick=()=>{basket.splice(i,1);invalidate();renderBasket();};li.append(b);return li;}));$('sim-status').textContent=basket.length?basket.length+'개 입력 준비. 계산 버튼을 누르세요.':'시나리오를 추가하세요.';}
$('scenario').onsubmit=e=>{e.preventDefault();const amount=Number($('amount').value),s=sectors.find(s=>s.code===$('sector').value);if(!s||!Number.isFinite(amount)||amount<=0){$('sim-status').textContent='산업과 양의 증가액을 확인하세요.';return;}basket.push({...s,amount});invalidate();renderBasket();};
$('clear').onclick=()=>{basket=[];invalidate();renderBasket();};
$('run').onclick=async()=>{if(!basket.length){$('sim-status').textContent='시나리오를 먼저 추가하세요.';return;}const snapshot=basket.map(s=>({...s}));$('run').disabled=true;$('sim-status').textContent='계산 중…';try{const r=await call('simulate',snapshot);if(JSON.stringify(snapshot)!==JSON.stringify(basket)){$('sim-status').textContent='입력이 변경되었습니다. 다시 계산하세요.';return;}result=r;renderResult();$('sim-status').textContent='계산 완료. 아래 결과는 현재 시나리오에 대응합니다.';}catch(e){invalidate();$('sim-status').textContent='계산 실패: '+e.message;}finally{$('run').disabled=false;}};
function renderResult(){$('results').hidden=false;$('cards').replaceChildren(...[['수요 증가액',result.demand],['생산유발액',result.production],['수입유발액',result.imports],['부가가치유발액',result.valueAdded]].map(([title,v])=>{const d=text('div',title);d.className='card';d.append(text('strong',fmt(v)),text('span','백만원'));return d;}));const max=Math.max(...result.rows.map(r=>r.production),1);$('bars').replaceChildren(...result.rows.slice(0,15).map(r=>{const d=text('div',r.name+' · '+fmt(r.production)+'백만원');d.className='bar';const t=document.createElement('div');t.className='track';const f=document.createElement('div');f.className='fill';f.style.width=Math.max(0,r.production/max*100)+'%';t.append(f);d.append(t);return d;}));$('result-rows').replaceChildren(...result.rows.map(r=>{const tr=document.createElement('tr');[r.code,r.name,fmt(r.production),fmt(r.imports),fmt(r.valueAdded)].forEach(v=>tr.append(text('td',v)));return tr;}));}
function csvCell(v){let s=String(v);if(/^[=+@-]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
$('download').onclick=()=>{if(!result)return;const rows=[['산업코드','산업명','생산유발액_백만원','수입유발액_백만원','부가가치유발액_백만원'],...result.rows.map(r=>[r.code,r.name,r.production,r.imports,r.valueAdded])];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='io-2023-'+currentLevel+'-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

async function loadDefaultWorkbook(){
 try {
  $('status').textContent='엑셀 내려받는 중…';
  const response=await fetch('./data/'+$('level').value);
  if(!response.ok)throw Error('기본 Excel 다운로드 실패 (HTTP '+response.status+')');
  await load(await response.arrayBuffer());
 }catch(error){
  $('status').textContent='준비 실패: '+error.message+' — 연결 상태를 확인하고 새로고침하세요.';
 }
}
$('load-basic').onclick=async()=>{
 const button=$('load-basic'),level=$('level');
 button.disabled=true;level.disabled=true;
 button.textContent='불러오는 중…';
 try {
  await loadDefaultWorkbook();
 }finally{
  button.disabled=false;level.disabled=false;button.textContent='불러오기';
 }
};

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==b.dataset.tab);});
const COLORS={'전·후방 모두 높음':'#2f5bea','영향력 높음':'#1f9d8a','감응도 높음':'#d98a00','모두 낮음':'#9aa3b5'};
let linkRows=[];
async function loadLinkage(){const d=await call('influence',null);linkRows=d.rows;renderLinkage();}
function renderLinkage(){
 const q=$('link-search').value.trim(),k=$('link-sort').value;
 const list=linkRows.filter(r=>(r.code+' '+r.name).includes(q)).sort((a,b)=>b[k]-a[k]);
 $('link-caption').textContent=currentLevel+' '+linkRows.length+'개 부문 · 평균 = 1.0';
 $('linkage-rows').replaceChildren(...list.map(r=>{const tr=document.createElement('tr');[r.code,r.name,r.influence.toFixed(3),r.sensitivity.toFixed(3),r.type].forEach(v=>tr.append(text('td',v)));return tr;}));
 drawPlot();
}
function drawPlot(){
 const W=720,H=460,P=48,xs=linkRows.map(r=>r.influence),ys=linkRows.map(r=>r.sensitivity);
 const xmax=Math.max(1.2,...xs)*1.05,ymax=Math.max(1.2,...ys)*1.05,xmin=Math.min(0.6,...xs)*0.95;
 const X=v=>P+(v-xmin)/(xmax-xmin)*(W-2*P),Y=v=>H-P-v/ymax*(H-2*P),ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label','영향력계수와 감응도계수 산점도');
 const add=(t,a,tx)=>{const e=document.createElementNS(ns,t);for(const[n,v]of Object.entries(a))e.setAttribute(n,v);if(tx)e.textContent=tx;svg.append(e);return e;};
 add('line',{x1:X(1),y1:P/2,x2:X(1),y2:H-P,stroke:'#f2b134','stroke-width':2});add('line',{x1:P,y1:Y(1),x2:W-P/2,y2:Y(1),stroke:'#f2b134','stroke-width':2});
 add('line',{x1:P,y1:H-P,x2:W-P/2,y2:H-P,stroke:'#5b6478'});add('line',{x1:P,y1:P/2,x2:P,y2:H-P,stroke:'#5b6478'});
 add('text',{x:W/2,y:H-12,'text-anchor':'middle','font-size':14,fill:'#14213d'},'영향력계수 (후방연쇄)');add('text',{x:16,y:H/2,'text-anchor':'middle','font-size':14,fill:'#14213d',transform:'rotate(-90 16 '+H/2+')'},'감응도계수 (전방연쇄)');
 for(const r of linkRows){const c=add('circle',{cx:X(r.influence),cy:Y(r.sensitivity),r:linkRows.length>200?3.5:5,fill:COLORS[r.type],'fill-opacity':.8});c.append(Object.assign(document.createElementNS(ns,'title'),{textContent:r.name+' · 영향력 '+r.influence.toFixed(2)+' · 감응도 '+r.sensitivity.toFixed(2)}));}
 linkRows.filter(r=>r.type==='전·후방 모두 높음').sort((a,b)=>b.influence+b.sensitivity-a.influence-a.sensitivity).slice(0,6).forEach(r=>add('text',{x:X(r.influence)+7,y:Y(r.sensitivity)-6,'font-size':12,fill:'#14213d'},r.name));
 $('plot').replaceChildren(svg);
}
$('link-search').oninput=renderLinkage;$('link-sort').onchange=renderLinkage;
