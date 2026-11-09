# io-analysis-app//
const FILES={기본부문:'data/io-basic.xlsx',소분류:'data/io-small.xlsx',중분류:'data/io-mid.xlsx',대분류:'data/io-large.xlsx'};
const $=id=>document.getElementById(id);
let wb,rows=[],names=[],X=[],L=null,A=null,inf=[],sen=[],sc=[],last=[];
const num=v=>typeof v==='number'?v:(parseFloat(String(v??'').replace(/,/g,''))||0);
const fmt=(v,d=0)=>v.toLocaleString('ko-KR',{maximumFractionDigits:d});
const opts=(el,a)=>el.innerHTML=a.map((v,i)=>`<option value="${i}">${v}</option>`).join('');
const tbl=(el,head,body)=>el.innerHTML='<tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr>'+body.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('');
opts($('cls'),Object.keys(FILES));

function open(buf){wb=XLSX.read(buf,{type:'array'});opts($('sheet'),wb.SheetNames);pick();$('msg').textContent='불러왔습니다. 시트 '+wb.SheetNames.length+'개';}
$('load').onclick=async()=>{const k=Object.keys(FILES)[$('cls').value];
 try{const r=await fetch(FILES[k]);if(!r.ok)throw 0;open(await r.arrayBuffer());}
 catch{$('msg').textContent=FILES[k]+' 파일이 없습니다. data 폴더에 올리거나 직접 선택하세요.';}};
$('file').onchange=async e=>open(await e.target.files[0].arrayBuffer());
$('sheet').onchange=pick;$('q').oninput=preview;
function pick(){rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[$('sheet').value]],{header:1,defval:''});preview();}
function preview(){const q=$('q').value.trim();
 const ix=rows.map((r,i)=>i).filter(i=>!q||rows[i].some(c=>String(c).includes(q))).slice(0,30);
 tbl($('prev'),['행',...Array.from({length:10},(_,j)=>'열'+(j+1))],ix.map(i=>[i+1,...rows[i].slice(0,10).map(c=>typeof c==='number'?fmt(c,2):c)]));}

function inv(M,n){const a=M.map((r,i)=>{const x=new Float64Array(2*n);x.set(r);x[n+i]=1;return x;});
 for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;
  [a[c],a[p]]=[a[p],a[c]];const d=a[c][c];if(Math.abs(d)<1e-12)throw Error('특이행렬: 범위 설정을 확인하세요');
  for(let k=c;k<2*n;k++)a[c][k]/=d;
  for(let r=0;r<n;r++){if(r===c)continue;const f=a[r][c];if(!f)continue;for(let k=c;k<2*n;k++)a[r][k]-=f*a[c][k];}}
 return a.map(r=>Array.from(r.slice(n)));}

$('calc').onclick=()=>{try{
 const r0=+$('r0').value-1,c0=+$('c0').value-1,n=+$('n').value,nc=+$('nc').value-1,cx=+$('cx').value-1;
 names=[];X=[];const Z=[];
 for(let i=0;i<n;i++){const r=rows[r0+i];if(!r)throw Error('행 범위를 벗어남');names.push(String(r[nc]).trim()||'부문'+(i+1));X.push(num(r[cx]));Z.push(Array.from({length:n},(_,j)=>num(r[c0+j])));}
 A=Z.map(r=>r.map((z,j)=>X[j]>0?z/X[j]:0));
 const cs=Array.from({length:n},(_,j)=>A.reduce((s,r)=>s+r[j],0));
 const bad=cs.filter(v=>v>=1).length;
 L=inv(A.map((r,i)=>r.map((a,j)=>(i===j?1:0)-a)),n);
 const col=Array.from({length:n},(_,j)=>L.reduce((s,r)=>s+r[j],0)),row=L.map(r=>r.reduce((s,v)=>s+v,0));
 const ca=col.reduce((s,v)=>s+v,0)/n,ra=row.reduce((s,v)=>s+v,0)/n;
 inf=col.map(v=>v/ca);sen=row.map(v=>v/ra);
 $('chk').textContent=`산업 ${n}개 · 투입계수 열합 ≥1인 산업 ${bad}개 · 역행렬 계산 완료\n첫 산업: ${names[0]} / 마지막: ${names[n-1]}`;
 tbl($('link'),['산업','영향력계수','감응도계수','생산유발계수 열합(배)'],names.map((nm,i)=>[nm,inf[i].toFixed(3),sen[i].toFixed(3),col[i].toFixed(3)]));
 opts($('si'),names);sc=[];show();
}catch(e){$('chk').textContent='오류: '+e.message;}};

$('sq').oninput=()=>{const q=$('sq').value.trim();const ix=names.map((x,i)=>i).filter(i=>!q||names[i].includes(q));
 $('si').innerHTML=ix.map(i=>`<option value="${i}">${names[i]}</option>`).join('');};
$('add').onclick=()=>{if(!L)return;const i=+$('si').value,a=+$('amt').value;if(a>0){sc.push([i,a]);show();}};
$('clr').onclick=()=>{sc=[];show();};
function show(){$('scn').textContent=sc.length?'시나리오: '+sc.map(([i,a])=>`${names[i]} +${fmt(a)}`).join(', ')+' (백만원)':'시나리오를 추가하세요.';
 if(!sc.length){$('res').innerHTML='';last=[];return;}
 const x=names.map((_,i)=>sc.reduce((s,[j,a])=>s+L[i][j]*a,0));const tot=sc.reduce((s,[,a])=>s+a,0),sum=x.reduce((s,v)=>s+v,0);
 last=names.map((nm,i)=>[nm,x[i]]).sort((a,b)=>b[1]-a[1]);
 tbl($('res'),['순위','산업','생산유발액(백만원)'],[['-','전체 합계 (승수 '+(sum/tot).toFixed(3)+'배)',fmt(sum)],...last.slice(0,15).map((r,k)=>[k+1,r[0],fmt(r[1])])]);}
$('csv').onclick=()=>{if(!last.length)return;const b=new Blob(['\ufeff산업,생산유발액(백만원)\n'+last.map(r=>`"${r[0]}",${r[1]}`).join('\n')],{type:'text/csv'});
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='result.csv';a.click();};
