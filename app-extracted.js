(() => {
'use strict';

const DB = 'trade-memo-private-v2';
const VER = 1;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const monday = d => { const x=new Date(d); const n=(x.getDay()+6)%7; x.setDate(x.getDate()-n); x.setHours(0,0,0,0); return x; };
const THM=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THMF=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THD=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (n,cur) => { if(!Number.isFinite(Number(n))) return '∞'; const x=Number(n); return `${x<0?'-':''}${Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}${cur?' '+cur:''}`; };
const signed=(n,cur)=>`${Number(n)>0?'+':''}${money(n,cur)}`;
const num=(x)=>{const n=Number(x);return Number.isFinite(n)?n:0};
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
let db, state={
 view:'diary', date:today(), period:'month', anchor:today(), cal:new Date(),
 day:null, days:[], settings:{currency:'USD',startingBalance:0,theme:'dark',driveClientId:'',driveFolderName:'Trade Memo',claudeKey:'',claudeModel:'',geminiKey:'',geminiModel:'',lastSymbol:'',lastSync:''},
 objectUrls:new Map()
};

function toast(msg,type=''){const e=$('#toast');e.textContent=msg;e.className='toast '+type;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,type==='err'?5200:2600);}
function openModal(html,wide=false){const m=$('#modal'),c=$('#modalCard');c.className='modal-card'+(wide?' wide':'');c.innerHTML=html;m.hidden=false;document.body.style.overflow='hidden';return c;}
function closeModal(){const m=$('#modal'),c=$('#modalCard');m.hidden=true;c.innerHTML='';c._onPaste=null;document.body.style.overflow='';}
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal()});

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{const d=r.result;
 if(!d.objectStoreNames.contains('days'))d.createObjectStore('days',{keyPath:'date'});
 if(!d.objectStoreNames.contains('images'))d.createObjectStore('images',{keyPath:'id'});
 if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'});
};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
const store=(name,mode='readonly')=>db.transaction(name,mode).objectStore(name);
const get= (name,key)=>new Promise((res,rej)=>{const r=store(name).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const all= name=>new Promise((res,rej)=>{const r=store(name).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});
const put=(name,val)=>new Promise((res,rej)=>{const r=store(name,'readwrite').put(val);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const del=(name,key)=>new Promise((res,rej)=>{const r=store(name,'readwrite').delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});

function blankDay(date){return {date,createdAt:Date.now(),updatedAt:Date.now(),plan:{bias:'',setup:'',entryRules:'',riskNotes:''},review:{mood:'',notes:''},trades:[]};}
async function getDay(date){let d=await get('days',date);if(!d){d=blankDay(date);await put('days',d)}return d}
async function loadData(){await openDB();state.days=await all('days');const ss=await all('settings');for(const x of ss)state.settings[x.key]=x.value;document.documentElement.dataset.theme=state.settings.theme||'dark';}

function tradeNet(t){return num(t.pnl)+num(t.commission)+num(t.swap);}
function metrics(trades){
 const nets=trades.map(tradeNet), wins=nets.filter(n=>n>0), losses=nets.filter(n=>n<0);
 const grossWin=wins.reduce((a,b)=>a+b,0), grossLoss=Math.abs(losses.reduce((a,b)=>a+b,0));
 let peak=0,cum=0,maxDD=0,curW=0,curL=0,maxW=0,maxL=0;
 nets.forEach(n=>{cum+=n;if(cum>peak)peak=cum;maxDD=Math.max(maxDD,peak-cum);if(n>0){curW++;curL=0}else if(n<0){curL++;curW=0}else{curW=0;curL=0}maxW=Math.max(maxW,curW);maxL=Math.max(maxL,curL)});
 const decided=wins.length+losses.length, net=grossWin-grossLoss;
 return {total:trades.length,wins:wins.length,losses:losses.length,be:nets.filter(n=>n===0).length,winrate:decided?wins.length/decided:0,grossWin,grossLoss,net,
 profitFactor:grossLoss?grossWin/grossLoss:(grossWin?Infinity:0),expectancy:trades.length?net/trades.length:0,
 avgWin:wins.length?grossWin/wins.length:0,avgLoss:losses.length?grossLoss/losses.length:0,rr:losses.length?(wins.length?grossWin/wins.length/(grossLoss/losses.length):0):(grossWin?Infinity:0),
 maxDD,maxWinStreak:maxW,maxLossStreak:maxL,best:nets.length?Math.max(...nets):0,worst:nets.length?Math.min(...nets):0,lots:trades.reduce((a,t)=>a+num(t.lots),0)}
}
function tradesInRange(days,start,end){const s=fmtDate(start),e=fmtDate(end);return days.filter(d=>d.date>=s&&d.date<=e).flatMap(d=>(d.trades||[]).map(t=>({...t,date:d.date}))).sort((a,b)=>(a.date+(a.exitTime||a.entryTime||'')).localeCompare(b.date+(b.exitTime||b.entryTime||'')));}
function range(period,anchor){
 const a=parseDate(anchor);
 if(period==='day')return {start:a,end:a,label:anchor};
 if(period==='week'){const s=monday(a),e=addDays(s,6);return {start:s,end:e,label:`สัปดาห์ ${isoWeek(a)} (${fmtDate(s)} – ${fmtDate(e)})`}}
 if(period==='month'){return {start:new Date(a.getFullYear(),a.getMonth(),1),end:new Date(a.getFullYear(),a.getMonth()+1,0),label:`${THMF[a.getMonth()]} ${a.getFullYear()}`}}
 if(period==='year')return {start:new Date(a.getFullYear(),0,1),end:new Date(a.getFullYear(),11,31),label:`ปี ${a.getFullYear()}`};
 return {start:new Date(2000,0,1),end:new Date(2100,0,1),label:'ทั้งหมด'};
}
function isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const ys=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-ys)/86400000)+1)/7)}
function shift(period,anchor,dir){const a=parseDate(anchor);if(period==='day')return fmtDate(addDays(a,dir));if(period==='week')return fmtDate(addDays(a,7*dir));if(period==='month')return fmtDate(new Date(a.getFullYear(),a.getMonth()+dir,Math.min(a.getDate(),28)));if(period==='year')return fmtDate(new Date(a.getFullYear()+dir,a.getMonth(),Math.min(a.getDate(),28)));return anchor}
function thDate(s,short=false){const d=parseDate(s);return short?`${d.getDate()} ${THM[d.getMonth()]}`:`${THD[d.getDay()]} ${d.getDate()} ${THMF[d.getMonth()]} ${d.getFullYear()}`}

function drawLine(points,w=900,h=230){if(!points.length)return `<div class="muted" style="padding:45px;text-align:center">ยังไม่มีข้อมูล</div>`;
 const W=w,H=h,pl=55,pr=15,pt=15,pb=30,vals=points.map(p=>p.cum),lo=Math.min(0,...vals),hi=Math.max(0,...vals),rg=(hi-lo)||1;
 const x=i=>pl+(points.length===1?(W-pl-pr)/2:i/(points.length-1)*(W-pl-pr)),y=v=>pt+(1-(v-lo)/rg)*(H-pt-pb);
 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" aria-label="equity curve">`;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);s+=`<line class="grid" x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}"/><text class="tick" x="${pl-7}" y="${yy+4}" text-anchor="end">${Math.abs(v)>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0)}</text>`}
 s+=`<line class="zero" x1="${pl}" x2="${W-pr}" y1="${y(0)}" y2="${y(0)}"/>`;
 const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join(' ');
 const area=path+` L${x(points.length-1)},${y(0)} L${x(0)},${y(0)} Z`;
 s+=`<path class="area" d="${area}"/><path class="line" d="${path}"/>`;
 const idx=[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 idx.forEach(i=>s+=`<text class="tick" x="${x(i)}" y="${H-8}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${points[i].date.slice(5)}</text>`);
 return s+'</svg>';
}
function drawBars(items,w=900,h=210){if(!items.length)return `<div class="muted" style="padding:45px;text-align:center">ยังไม่มีข้อมูล</div>`;
 const W=w,H=h,pl=55,pr=15,pt=15,pb=30,vals=items.map(i=>i.value),lo=Math.min(0,...vals),hi=Math.max(0,...vals),rg=(hi-lo)||1,y=v=>pt+(1-(v-lo)/rg)*(H-pt-pb),slot=(W-pl-pr)/items.length,bw=Math.max(3,Math.min(26,slot*.65));
 let s=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,yy=y(v);s+=`<line class="grid" x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}"/><text class="tick" x="${pl-7}" y="${yy+4}" text-anchor="end">${v.toFixed(0)}</text>`}
 const y0=y(0),every=Math.max(1,Math.ceil(items.length/10));s+=`<line class="zero" x1="${pl}" x2="${W-pr}" y1="${y0}" y2="${y0}"/>`;
 items.forEach((it,i)=>{const cx=pl+slot*i+slot/2,yy=y(it.value),top=Math.min(y0,yy),hh=Math.max(2,Math.abs(yy-y0)),cl=it.value>0?'pos':it.value<0?'neg':'flat';s+=`<rect class="bar ${cl}" x="${cx-bw/2}" y="${top}" width="${bw}" height="${hh}" rx="3"/>`;if(i%every===0)s+=`<text class="tick" x="${cx}" y="${H-8}" text-anchor="middle">${esc(it.label)}</text>`});return s+'</svg>';
}
function donut(ratio){const p=Math.max(0,Math.min(1,ratio)),r=43,c=2*Math.PI*r,d=p*c;return `<div class="donut"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--pos)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${d} ${c-d}"/></svg><div class="center">${(p*100).toFixed(0)}%</div></div>`}
function calHtml(year,month,map){const first=new Date(year,month,1),days=new Date(year,month+1,0).getDate(),start=(first.getDay()+6)%7,max=Math.max(1,...[...map.values()].map(x=>Math.abs(x.net)));let h=`<div class="head">${['จ','อ','พ','พฤ','ศ','ส','อา'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calgrid">`;for(let i=0;i<start;i++)h+=`<span class="calcell empty"></span>`;for(let d=1;d<=days;d++){const k=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,x=map.get(k),int=x?(.25+.75*Math.min(1,Math.abs(x.net)/max)):0;let cl='calcell';if(x&&x.count)cl+=x.net>0?' pos':x.net<0?' neg':'';else if(x&&x.hasNote)cl+=' noted';h+=`<button class="${cl}" style="--i:${int}" data-cal="${k}"><span class="d">${d}</span>${x&&x.count?`<span class="v ${x.net>=0?'pos':'neg'}">${x.net>=0?'+':''}${x.net.toFixed(0)}</span>`:''}</button>`}return h+'</div>'}
function groupTable(title, groups){return `<section class="card"><div class="card-head"><h3>${esc(title)}</h3></div>${groups.length?`<div class="table-wrap"><table class="table"><thead><tr><th></th><th>เทรด</th><th>Winrate</th><th>กำไร</th></tr></thead><tbody>${groups.map(g=>`<tr><td>${esc(g.label)}</td><td>${g.m.total}</td><td>${(g.m.winrate*100).toFixed(1)}%</td><td class="${g.m.net>=0?'pos':'neg'}"><b>${signed(g.m.net,state.settings.currency)}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="muted">ไม่มีข้อมูล</div>'}</section>`}
function group(trades,keyFn,labelFn){const m=new Map();trades.forEach(t=>{const k=keyFn(t);if(!m.has(k))m.set(k,[]);m.get(k).push(t)});return [...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([k,v])=>({label:labelFn(k),m:metrics(v),trades:v}))}

function href(view,date){location.hash=`#/${view}${date?'/'+date:''}`}
function navButtons(){return `<button data-nav="diary" class="${state.view==='diary'?'on':''}">📝 ไดอารี่</button><button data-nav="dashboard" class="${state.view==='dashboard'?'on':''}">📊 สรุปผล</button><button data-nav="settings" class="${state.view==='settings'?'on':''}">⚙️ ตั้งค่า</button>`}
async function render(){
 const app=$('#app');state.days=await all('days');
 app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand">📓 Trade Memo <small>Private</small></div><nav class="nav">${navButtons()}</nav><div class="side-note">ข้อมูล Journal และรูปเก็บใน IndexedDB ของ browser เครื่องนี้เป็นหลัก ไม่มีเซิร์ฟเวอร์ของผู้พัฒนา</div></aside><main class="main"><div id="page"></div></main></div>`;
 $$('.nav [data-nav]').forEach(b=>b.onclick=()=>href(b.dataset.nav,state.date));
 const p=$('#page');
 if(state.view==='diary')await diary(p); else if(state.view==='dashboard')await dashboard(p); else await settings(p);
}
function chip(key,label,current,cls=''){return `<button class="chip ${current===key?'on':''} ${cls}" data-chip="${key}">${label}</button>`}
function imgUrl(img){if(!state.objectUrls.has(img.id))state.objectUrls.set(img.id,URL.createObjectURL(img.blob));return state.objectUrls.get(img.id)}
async function images(kind,date){const imgs=(await all('images')).filter(x=>x.date===date&&x.kind===kind).sort((a,b)=>a.createdAt-b.createdAt);return imgs}
function imagesHtml(list,kind){return list.map(i=>`<div class="img" data-imgid="${i.id}"><img src="${imgUrl(i)}" alt="${esc(i.name)}"><button class="del" data-delimg="${i.id}">✕</button></div>`).join('')+`<button class="img-add" data-addimg="${kind}">＋ เพิ่มรูป</button>`}
function bindImages(root,date){root.addEventListener('click',async e=>{const delb=e.target.closest('[data-delimg]');if(delb){await del('images',delb.dataset.delimg);if(state.objectUrls.has(delb.dataset.delimg)){URL.revokeObjectURL(state.objectUrls.get(delb.dataset.delimg));state.objectUrls.delete(delb.dataset.delimg)}await diary($('#page'));return}const add=e.target.closest('[data-addimg]');if(add){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.onchange=async()=>{for(const f of inp.files)await addImage(f,date,add.dataset.addimg);await diary($('#page'))};inp.click();}})}
async function addImage(file,date,kind){await put('images',{id:uid(),date,kind,name:file.name,type:file.type,createdAt:Date.now(),blob:file});}
async function tradeListHtml(trades,date){return trades.map(t=>`<div class="trade-row"><div><div class="sym">${esc(t.symbol)}</div><div class="meta">${esc(t.entryTime||'')} → ${esc(t.exitTime||'')} · ${esc(t.side||'')} · ${Number(t.lots||0).toFixed(2)} lot</div></div><div><span class="pill">${esc(t.ticket||'')}</span><div class="meta">${esc(t.notes||'')}</div></div><div class="pl ${tradeNet(t)>=0?'pos':'neg'}">${signed(tradeNet(t),state.settings.currency)}<div class="meta">${num(t.entryPrice)} → ${num(t.exitPrice)}</div><button class="btn small" data-edit="${t.id}" style="margin-top:5px">แก้ไข</button></div></div>`).join('')||'<div class="muted">ยังไม่มีออเดอร์วันนี้</div>'}

async function diary(app){
 state.day=await getDay(state.date);const d=state.day,m=metrics(d.trades),wk=monday(parseDate(state.date));let strip='';
 for(let i=0;i<7;i++){const x=addDays(wk,i),k=fmtDate(x),dd=state.days.find(q=>q.date===k),p=dd?dd.trades.reduce((a,t)=>a+tradeNet(t),0):0,has=dd&&(dd.trades.length||dd.plan?.setup||dd.review?.notes);strip+=`<button class="${k===state.date?'sel':''}" data-goto="${k}"><span class="tiny">${['อา','จ','อ','พ','พฤ','ศ','ส'][x.getDay()]}</span><span class="d">${x.getDate()}</span>${dd&&dd.trades.length?`<span class="v ${p>=0?'pos':'neg'}">${p>=0?'+':''}${p.toFixed(0)}</span>`:`<span class="dot ${has?'':'hide'}"></span>`}</button>`}
 const [planImgs,mt5Imgs,reviewImgs]=await Promise.all([images('plan',state.date),images('mt5',state.date),images('review',state.date)]);
 app.innerHTML=`<div class="stack">
 <div class="dayhead"><button class="iconbtn" data-prev>‹</button><div class="title"><h1>${thDate(state.date)} ${state.date===today()?'<span class="pill">วันนี้</span>':''}</h1><div class="sub">${d.trades.length?`${d.trades.length} ออเดอร์ · <b class="${m.net>=0?'pos':'neg'}">${signed(m.net,state.settings.currency)}</b> · winrate ${(m.winrate*100).toFixed(1)}%`:'ยังไม่มีออเดอร์วันนี้'}</div></div><input type="date" id="datePick" value="${state.date}"><button class="iconbtn" data-next>›</button></div>
 <div class="row" style="justify-content:flex-end"><button class="btn small" id="previewToday">👁️ พรีวิวสรุปวันนี้</button></div>
 <div class="weekstrip">${strip}</div>
 <section class="card"><div class="card-head"><h2>📋 แผนก่อนเทรด</h2><span id="saveState" class="muted small"></span></div>
 <div class="stack"><div><div class="small muted" style="margin-bottom:7px">มุมมองวันนี้</div><div class="chips" id="biasChips">${chip('Long','Long 📈',d.plan.bias,'pos')}${chip('Short','Short 📉',d.plan.bias,'neg')}${chip('Sideway','Sideway ↔️',d.plan.bias)}${chip('รอดู','รอดูก่อน 👀',d.plan.bias)}${chip('ไม่เทรด','วันนี้ไม่เทรด 🛑',d.plan.bias)}</div></div>
 <label class="field"><span>Setup วันนี้เป็นยังไง</span><textarea data-bind="plan.setup" placeholder="เช่น ราคาอยู่ในโซน demand H4, รอ break structure ใน M15 แล้วค่อยเข้า…">${esc(d.plan.setup)}</textarea></label>
 <div class="grid2"><label class="field"><span>เงื่อนไขเข้า / ออก</span><textarea data-bind="plan.entryRules" placeholder="เข้าเมื่อ… ออกเมื่อ… SL ที่… TP ที่…">${esc(d.plan.entryRules)}</textarea></label><label class="field"><span>ความเสี่ยง / lot / ข่าว</span><textarea data-bind="plan.riskNotes" placeholder="เสี่ยง 1% ต่อไม้, ข่าว NFP…">${esc(d.plan.riskNotes)}</textarea></label></div>
 <div><div class="small muted" style="margin-bottom:7px">รูปกราฟที่วาดไว้</div><div class="imgs" id="planImgs">${imagesHtml(planImgs,'plan')}</div></div></div></section>
 <section class="card"><div class="card-head"><h2>📈 ออเดอร์วันนี้</h2><div class="row"><button class="btn soft small" id="readMT5">📷 อ่านจาก MT5</button><button class="btn small" id="addTrade">＋ เพิ่ม</button></div></div>
 ${d.trades.length?`<div class="tiles" style="margin-bottom:12px"><div class="tile"><span class="l">กำไร/ขาดทุนสุทธิ</span><span class="v ${m.net>=0?'pos':'neg'}">${signed(m.net,state.settings.currency)}</span></div><div class="tile"><span class="l">Winrate</span><span class="v">${(m.winrate*100).toFixed(1)}%</span><span class="s">${m.wins}W · ${m.losses}L${m.be?' · '+m.be+'BE':''}</span></div><div class="tile"><span class="l">ไม้ดีสุด / แย่สุด</span><span class="v pos">${signed(m.best,state.settings.currency)}</span><span class="s neg">${signed(m.worst,state.settings.currency)}</span></div><div class="tile"><span class="l">รวม lot</span><span class="v">${m.lots.toFixed(2)}</span><span class="s">${d.trades.length} ออเดอร์</span></div></div>`:''}
 <div id="tradeList">${await tradeListHtml(d.trades,state.date)}</div>
 <details style="margin-top:12px" ${mt5Imgs.length?'open':''}><summary>ภาพหน้าจอ MT5 ที่บันทึกไว้</summary><div class="imgs" id="mt5Imgs" style="margin-top:8px">${imagesHtml(mt5Imgs,'mt5')}</div></details>
 </section>
 <section class="card"><div class="card-head"><h2>🧠 สรุปหลังเทรด</h2></div><div class="stack"><div><div class="small muted" style="margin-bottom:7px">วันนี้รู้สึกยังไง</div><div class="chips" id="moodChips">${chip('great','😎 ปังมาก',d.review.mood,'pos')}${chip('good','🙂 โอเค',d.review.mood)}${chip('meh','😐 เฉยๆ',d.review.mood)}${chip('bad','😤 หงุดหงิด',d.review.mood,'neg')}${chip('awful','😵 พังยับ',d.review.mood,'neg')}</div></div>
 <label class="field"><span>วันนี้เป็นไงบ้าง</span><textarea data-bind="review.notes" placeholder="เทรดตามแผนมั้ย? อะไรที่ทำได้ดี? อะไรที่พลาด?">${esc(d.review.notes)}</textarea></label>
 <div><div class="small muted" style="margin-bottom:7px">รูปประกอบสรุปหลังเทรด</div><div class="imgs" id="reviewImgs">${imagesHtml(reviewImgs,'review')}</div></div></div></section>
 </div>`;
 bindDiary(app);
 bindImages($('#planImgs'),state.date);bindImages($('#mt5Imgs'),state.date);bindImages($('#reviewImgs'),state.date);
}
function bindDiary(app){
 $('#datePick').onchange=e=>{state.date=e.target.value;href('diary',state.date)};
 $('[data-prev]').onclick=()=>{state.date=fmtDate(addDays(parseDate(state.date),-1));href('diary',state.date)};
 $('[data-next]').onclick=()=>{state.date=fmtDate(addDays(parseDate(state.date),1));href('diary',state.date)};
 $$('[data-goto]').forEach(b=>b.onclick=()=>href('diary',b.dataset.goto));
 $$('[data-bind]').forEach(el=>el.addEventListener('input',()=>{const [a,b]=el.dataset.bind.split('.');state.day[a][b]=el.value;state.day.updatedAt=Date.now();put('days',state.day);$('#saveState').textContent='บันทึกแล้ว ✓';setTimeout(()=>$('#saveState').textContent='',1200)}));
 $$('[data-chip]').forEach(b=>b.onclick=()=>{const holder=b.closest('.chips'),bind=holder.id==='biasChips'?['plan','bias']:['review','mood'];state.day[bind[0]][bind[1]]=b.dataset.chip;state.day.updatedAt=Date.now();put('days',state.day);render()});
 $('#addTrade').onclick=()=>tradeModal();
 $('#readMT5').onclick=()=>mt5Modal();
 $('#previewToday').onclick=()=>previewToday();
 app.addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b){const t=state.day.trades.find(x=>x.id===b.dataset.edit);if(t)tradeModal(t)}})
}
function tradeModal(existing=null){
 const t=existing||{id:uid(),symbol:state.settings.lastSymbol||'XAUUSD',side:'buy',lots:0.01,entryPrice:'',exitPrice:'',pnl:'',entryTime:'',exitTime:'',sl:'',tp:'',commission:'',swap:'',ticket:'',notes:''};
 const c=openModal(`<div class="modal-head"><h3>📈 ${existing?'แก้ไข':'เพิ่ม'}ออเดอร์</h3><button class="iconbtn" data-x>✕</button></div>
 <form id="tradeForm" class="formgrid"><label class="field"><span>คู่เงิน / Symbol</span><input name="symbol" required value="${esc(t.symbol)}"></label><label class="field"><span>ฝั่ง</span><select name="side"><option value="buy" ${t.side==='buy'?'selected':''}>Buy</option><option value="sell" ${t.side==='sell'?'selected':''}>Sell</option></select></label>
 <label class="field"><span>Lot</span><input name="lots" required type="number" step="any" value="${esc(t.lots)}"></label><label class="field"><span>Ticket</span><input name="ticket" value="${esc(t.ticket||'')}"></label>
 <label class="field"><span>ราคาเข้า</span><input name="entryPrice" type="number" step="any" value="${esc(t.entryPrice)}"></label><label class="field"><span>ราคาออก</span><input name="exitPrice" type="number" step="any" value="${esc(t.exitPrice)}"></label>
 <label class="field"><span>เวลาเข้า</span><input name="entryTime" value="${esc(t.entryTime||'')}" placeholder="09:30"></label><label class="field"><span>เวลาออก</span><input name="exitTime" value="${esc(t.exitTime||'')}" placeholder="11:40"></label>
 <label class="field"><span>SL</span><input name="sl" type="number" step="any" value="${esc(t.sl)}"></label><label class="field"><span>TP</span><input name="tp" type="number" step="any" value="${esc(t.tp)}"></label>
 <label class="field"><span>P&L</span><input name="pnl" required type="number" step="any" value="${esc(t.pnl)}"></label><label class="field"><span>ค่าคอม</span><input name="commission" type="number" step="any" value="${esc(t.commission)}"></label>
 <label class="field"><span>Swap</span><input name="swap" type="number" step="any" value="${esc(t.swap)}"></label><div></div>
 <label class="field full"><span>โน้ต (setup / เหตุผล / อารมณ์ / execution)</span><textarea name="notes">${esc(t.notes||'')}</textarea></label></form>
 <div class="modal-foot">${existing?'<button class="btn danger" id="delTrade">ลบ</button>':''}<button class="btn" data-x>ยกเลิก</button><button class="btn primary" id="saveTrade">บันทึก</button></div>`);
 $$('[data-x]',c).forEach(b=>b.onclick=closeModal);
 $('#saveTrade',c).onclick=async()=>{const f=$('#tradeForm');if(!f.reportValidity())return;const fd=new FormData(f);const z={...t,symbol:String(fd.get('symbol')).trim().toUpperCase(),side:fd.get('side'),lots:num(fd.get('lots')),entryPrice:num(fd.get('entryPrice')),exitPrice:num(fd.get('exitPrice')),pnl:num(fd.get('pnl')),entryTime:String(fd.get('entryTime')).trim(),exitTime:String(fd.get('exitTime')).trim(),sl:num(fd.get('sl')),tp:num(fd.get('tp')),commission:num(fd.get('commission')),swap:num(fd.get('swap')),ticket:String(fd.get('ticket')).trim(),notes:String(fd.get('notes')).trim(),createdAt:t.createdAt||Date.now()};
   if(existing)Object.assign(existing,z);else state.day.trades.push(z);state.day.updatedAt=Date.now();await put('days',state.day);state.settings.lastSymbol=z.symbol;await put('settings',{key:'lastSymbol',value:z.symbol});closeModal();toast('บันทึกออเดอร์แล้ว','ok');render();};
 if(existing)$('#delTrade',c).onclick=async()=>{state.day.trades=state.day.trades.filter(x=>x.id!==existing.id);state.day.updatedAt=Date.now();await put('days',state.day);closeModal();toast('ลบออเดอร์แล้ว','ok');render()};
}
async function previewToday(){const m=metrics(state.day.trades);const imgs=await images('plan',state.date);const c=openModal(`<div class="modal-head"><h3>👁️ พรีวิวสรุปวันนี้</h3><button class="iconbtn" data-x>✕</button></div><section class="card" style="box-shadow:none"><h2>${thDate(state.date)}</h2><p class="${m.net>=0?'pos':'neg'}" style="font-size:25px;font-weight:850">${signed(m.net,state.settings.currency)}</p><div class="grid4"><div><div class="small muted">Winrate</div><b>${(m.winrate*100).toFixed(1)}%</b></div><div><div class="small muted">Profit Factor</div><b>${Number.isFinite(m.profitFactor)?m.profitFactor.toFixed(2):'∞'}</b></div><div><div class="small muted">ดีที่สุด</div><b class="pos">${signed(m.best,state.settings.currency)}</b></div><div><div class="small muted">แย่สุด</div><b class="neg">${signed(m.worst,state.settings.currency)}</b></div></div>${imgs.length?`<div class="imgs" style="margin-top:12px">${imgs.map(i=>`<img src="${imgUrl(i)}" style="width:150px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`).join('')}</div>`:''}<hr style="margin:14px 0"><div class="small">${esc(state.day.review.notes||'ยังไม่มีสรุปหลังเทรด')}</div></section><div class="modal-foot"><button class="btn" data-x>ปิด</button></div>`);$$('[data-x]',c).forEach(b=>b.onclick=closeModal)}

async function mt5Modal(){
 const c=openModal(`<div class="modal-head"><h3>📷 อ่านจาก MT5</h3><button class="iconbtn" data-x>✕</button></div><div class="stack"><div class="notice">คุณสามารถเลือก screenshot, ลากไฟล์มาวาง หรือกด Ctrl/Cmd+V เพื่อวางภาพจาก clipboard ได้ ข้อมูลจะไม่ถูกส่งไปภายนอกในโหมด OCR แบบ local</div><div class="row"><button class="btn primary" id="pickMT5">เลือกภาพ</button><button class="btn" id="ocrLocal">OCR ในเครื่อง</button><button class="btn" id="aiClaude">Claude</button><button class="btn" id="aiGemini">Gemini</button></div><div id="aiOut" class="muted small">ยังไม่ได้เลือกภาพ</div></div>`);
 $$('[data-x]',c).forEach(b=>b.onclick=closeModal);let blob=null;
 $('#pickMT5',c).onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=()=>{blob=i.files[0];showImageBlob(c,blob)};i.click()};
 c._onPaste=b=>{blob=b;showImageBlob(c,b)};
 $('#ocrLocal',c).onclick=async()=>{if(!blob)return toast('ยังไม่ได้เลือกภาพ','err');await saveMT5Image(blob);$('#aiOut',c).innerHTML='<b>OCR local</b><br>ฟังก์ชันนี้เตรียมไว้ให้ใช้ Tesseract.js โดยเพิ่มไลบรารีในเวอร์ชันถัดไป; ขณะนี้คุณสามารถแนบภาพ MT5 แล้วกรอกตัวเลขด้วยฟอร์มได้';};
 $('#aiClaude',c).onclick=()=>aiParse(c,blob,'claude');$('#aiGemini',c).onclick=()=>aiParse(c,blob,'gemini');
}
function showImageBlob(c,b){$('#aiOut',c).innerHTML=`<img src="${URL.createObjectURL(b)}" style="max-width:100%;max-height:260px;border-radius:10px"><div class="small muted" style="margin-top:7px">พร้อมอ่าน / บันทึกภาพ</div>`}
async function saveMT5Image(blob){await addImage(blob,state.date,'mt5');toast('บันทึกภาพ MT5 แล้ว','ok');}
async function blob64(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result.split(',')[1]);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob)})}
async function aiParse(c,blob,engine){
 if(!blob)return toast('ยังไม่ได้เลือกภาพ','err');
 const key=state.settings[engine+'Key'];if(!key){toast(`ยังไม่ได้ใส่ ${engine} API key ในตั้งค่า`,'err');return}
 $('#aiOut',c).innerHTML='กำลังอ่านภาพ…';
 try{
  const b64=await blob64(blob);let result='';
  if(engine==='claude'){
   const model=state.settings.claudeModel||'claude-3-5-sonnet-latest';
   const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:1800,messages:[{role:'user',content:[{type:'text',text:'อ่านรายการเทรดจากภาพ MT5 และตอบเป็น JSON เท่านั้น รูปแบบ {"trades":[{"symbol":"","side":"buy|sell","lots":0,"entryPrice":0,"exitPrice":0,"entryTime":"","exitTime":"","pnl":0,"commission":0,"swap":0,"ticket":"","sl":0,"tp":0,"notes":""}],"summary":"","warnings":[]} หากไม่พบให้ trades=[]'} ,{type:'image',source:{type:'base64',media_type:blob.type||'image/png',data:b64}}]}]})});
   if(!r.ok)throw new Error('Claude API '+r.status);const j=await r.json();result=j.content?.map(x=>x.text||'').join('')||'';
  }else{
   const model=state.settings.geminiModel||'gemini-2.5-flash';
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'อ่านรายการเทรดจากภาพ MT5 และตอบเป็น JSON เท่านั้น รูปแบบ {"trades":[{"symbol":"","side":"buy|sell","lots":0,"entryPrice":0,"exitPrice":0,"entryTime":"","exitTime":"","pnl":0,"commission":0,"swap":0,"ticket":"","sl":0,"tp":0,"notes":""}],"summary":"","warnings":[]}'},{inlineData:{mimeType:blob.type||'image/png',data:b64}}]}],generationConfig:{temperature:0}})});
   if(!r.ok)throw new Error('Gemini API '+r.status);const j=await r.json();result=j.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
  }
  const match=result.match(/\{[\s\S]*\}/);const data=match?JSON.parse(match[0]):null;
  if(!data||!Array.isArray(data.trades))throw new Error('อ่าน JSON จาก AI ไม่สำเร็จ');
  const approved=await selectParsed(data.trades);for(const t of approved)state.day.trades.push({...t,id:uid(),createdAt:Date.now(),pnl:num(t.pnl),commission:num(t.commission),swap:num(t.swap),lots:num(t.lots)});
  state.day.updatedAt=Date.now();await put('days',state.day);await saveMT5Image(blob);closeModal();toast(`เพิ่ม ${approved.length} ออเดอร์จาก ${engine==='claude'?'Claude':'Gemini'}`,'ok');render();
 }catch(e){$('#aiOut',c).innerHTML=`<span class="neg">เกิดข้อผิดพลาด: ${esc(e.message)}</span>`}
}
async function selectParsed(trades){
 const c=openModal(`<div class="modal-head"><h3>ตรวจสอบรายการจากภาพ</h3><button class="iconbtn" data-x>✕</button></div><div class="table-wrap"><table class="table"><thead><tr><th></th><th>Symbol</th><th>Side</th><th>Lot</th><th>เข้า</th><th>ออก</th><th>P&L</th></tr></thead><tbody>${trades.map((t,i)=>`<tr><td><input type="checkbox" data-p="${i}" checked></td><td>${esc(t.symbol)}</td><td>${esc(t.side)}</td><td>${num(t.lots).toFixed(2)}</td><td>${num(t.entryPrice)}</td><td>${num(t.exitPrice)}</td><td>${num(t.pnl).toFixed(2)}</td></tr>`).join('')}</tbody></table></div><div class="modal-foot"><button class="btn" data-x>ยกเลิก</button><button class="btn primary" id="okParsed">เพิ่มรายการที่เลือก</button></div>`);
 $$('[data-x]',c).forEach(b=>b.onclick=()=>{closeModal();closeModal()});return new Promise(resolve=>{$('#okParsed',c).onclick=()=>{const out=trades.filter((_,i)=>$(`[data-p="${i}"]`,c).checked);closeModal();resolve(out)}})
}

async function dashboard(app){
 const r=range(state.period,state.anchor),ts=tradesInRange(state.days,r.start,r.end),m=metrics(ts),cur=state.settings.currency||'';
 const eq=[];let cum=0;ts.forEach(t=>{cum+=tradeNet(t);eq.push({date:t.date,cum,net:tradeNet(t)})});
 let bars=[];
 if(state.period==='day')bars=ts.map(t=>({label:t.symbol,value:tradeNet(t)}));
 else if(state.period==='year'){const g=group(ts,t=>t.date.slice(0,7),k=>THM[Number(k.slice(5))-1]);bars=Array.from({length:12},(_,i)=>{const k=`${parseDate(state.anchor).getFullYear()}-${String(i+1).padStart(2,'0')}`,x=g.find(z=>z.label===THM[i]);return {label:THM[i],value:x?x.m.net:0}})}
 else if(state.period==='all'){bars=group(ts,t=>t.date.slice(0,7),k=>k.slice(2)).map(g=>({label:g.label,value:g.m.net}))}
 else {for(let d=new Date(r.start);d<=r.end;d=addDays(d,1)){const k=fmtDate(d),v=ts.filter(t=>t.date===k).reduce((a,t)=>a+tradeNet(t),0);bars.push({label:thDate(k,true),value:v})}}
 const dayMap=new Map();state.days.forEach(d=>dayMap.set(d.date,{net:d.trades.reduce((a,t)=>a+tradeNet(t),0),count:d.trades.length,hasNote:!!(d.plan?.setup||d.review?.notes)}));
 const bySymbol=group(ts,t=>t.symbol,k=>k),bySide=group(ts,t=>t.side,k=>k==='buy'?'Buy':'Sell'),byDow=group(ts,t=>parseDate(t.date).getDay(),k=>THD[Number(k)]);
 const sub=state.period==='year'?group(ts,t=>t.date.slice(0,7),k=>THMF[Number(k.slice(5))-1]):state.period==='month'?group(ts,t=>isoWeek(parseDate(t.date)),k=>`สัปดาห์ ${k}`):state.period==='all'?group(ts,t=>t.date.slice(0,4),k=>`ปี ${k}`):group(ts,t=>t.date,k=>thDate(k));
 app.innerHTML=`<div class="stack">
 <div class="top"><h1>📊 สรุปผล</h1><div class="top-actions"><button class="btn" id="exportTop">⬇ สำรอง</button><button class="btn" id="importTop">⬆ นำเข้า</button></div></div>
 <div class="periodbar"><div class="seg">${[['day','วัน'],['week','สัปดาห์'],['month','เดือน'],['year','ปี'],['all','ทั้งหมด']].map(([p,l])=>`<button class="${state.period===p?'on':''}" data-period="${p}">${l}</button>`).join('')}</div><div class="periodnav ${state.period==='all'?'hide':''}"><button class="iconbtn" id="shiftL">‹</button><span class="lbl">${esc(state.period==='day'?thDate(state.anchor):r.label)}</span><button class="iconbtn" id="shiftR">›</button><button class="btn small" id="dashToday">วันนี้</button></div></div>
 <div class="tiles"><div class="tile hero">${donut(m.winrate)}<div><span class="l">กำไร/ขาดทุนสุทธิ${cur?` (${esc(cur)})`:''}</span><span class="v ${m.net>=0?'pos':'neg'}">${signed(m.net,cur)}</span><span class="s">${m.total} ออเดอร์ · ${m.wins} ชนะ · ${m.losses} แพ้${m.be?` · ${m.be} เท่าทุน`:''}</span></div></div>
 <div class="tile"><span class="l">Profit factor</span><span class="v">${Number.isFinite(m.profitFactor)?m.profitFactor.toFixed(2):'∞'}</span><span class="s">กำไรรวม ÷ ขาดทุนรวม</span></div>
 <div class="tile"><span class="l">Expectancy</span><span class="v ${m.expectancy>=0?'pos':'neg'}">${signed(m.expectancy,cur)}</span><span class="s">กำไรเฉลี่ยต่อไม้</span></div>
 <div class="tile"><span class="l">R:R เฉลี่ย</span><span class="v">${Number.isFinite(m.rr)?m.rr.toFixed(2):'∞'}</span><span class="s">ชนะเฉลี่ย ${money(m.avgWin,cur)} / แพ้เฉลี่ย ${money(m.avgLoss,cur)}</span></div>
 <div class="tile"><span class="l">Max drawdown</span><span class="v neg">${money(m.maxDD,cur)}</span><span class="s">จากจุดสูงสุดของกำไรสะสม</span></div>
 <div class="tile"><span class="l">ไม้ดีสุด</span><span class="v pos">${signed(m.best,cur)}</span></div><div class="tile"><span class="l">ไม้แย่สุด</span><span class="v neg">${signed(m.worst,cur)}</span></div>
 <div class="tile"><span class="l">ชนะติดกันสูงสุด</span><span class="v">${m.maxWinStreak}</span><span class="s">แพ้ติดกัน ${m.maxLossStreak}</span></div><div class="tile"><span class="l">รวม lot</span><span class="v">${m.lots.toFixed(2)}</span><span class="s">Gross +${money(m.grossWin,cur)} / -${money(m.grossLoss,cur)}</span></div></div>
 <section class="card"><div class="card-head"><h2>📈 กำไรสะสม</h2><span class="small muted">${eq.length} ออเดอร์</span></div><div class="chartbox">${drawLine(eq)}</div></section>
 <section class="card"><div class="card-head"><h2>📊 กำไร/ขาดทุน ${state.period==='day'?'ทีละออเดอร์':state.period==='year'?'รายเดือน':'รายวัน'}</h2></div><div class="chartbox">${drawBars(bars)}</div></section>
 ${state.period==='month'?`<section class="card"><div class="card-head"><h2>🗓️ ปฏิทิน</h2><span class="small muted">แตะวันเพื่อเปิดไดอารี่</span></div><div class="cal">${calHtml(parseDate(state.anchor).getFullYear(),parseDate(state.anchor).getMonth(),dayMap)}</div></section>`:''}
 <div class="grid2">${groupTable('ตามช่วงเวลา',sub)}${groupTable('ตามคู่เงิน',bySymbol)}${groupTable('ตาม Buy / Sell',bySide)}${groupTable('ตามวันในสัปดาห์',byDow)}</div>
 <section class="card"><div class="card-head"><h2>📜 รายการออเดอร์</h2><span class="small muted">${ts.length} รายการ</span></div>${ts.length?`<div class="table-wrap"><table class="table"><thead><tr><th>วันที่</th><th>คู่เงิน</th><th>ฝั่ง</th><th>Lot</th><th>เข้า</th><th>ออก</th><th>กำไร</th></tr></thead><tbody>${[...ts].reverse().map(t=>`<tr class="clickable" data-open="${t.date}"><td class="muted">${t.date}</td><td><b>${esc(t.symbol)}</b></td><td>${esc(t.side)}</td><td>${num(t.lots).toFixed(2)}</td><td>${num(t.entryPrice)}</td><td>${num(t.exitPrice)}</td><td class="${tradeNet(t)>=0?'pos':'neg'}"><b>${signed(tradeNet(t),cur)}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="muted">ไม่มีออเดอร์ในช่วงนี้</div>'}</section></div>`;
 $$('[data-period]').forEach(b=>b.onclick=()=>{state.period=b.dataset.period;render()});$('#shiftL').onclick=()=>{state.anchor=shift(state.period,state.anchor,-1);render()};$('#shiftR').onclick=()=>{state.anchor=shift(state.period,state.anchor,1);render()};$('#dashToday').onclick=()=>{state.anchor=today();render()};$$('[data-cal]').forEach(b=>b.onclick=()=>href('diary',b.dataset.cal));$$('[data-open]').forEach(b=>b.onclick=()=>href('diary',b.dataset.open));$('#exportTop').onclick=exportBackup;$('#importTop').onclick=importBackup;
}
async function settings(app){
 const s=state.settings;
 app.innerHTML=`<div class="stack"><div class="top"><h1>⚙️ ตั้งค่า</h1><div class="top-actions"><button class="btn" id="exportSet">⬇ สำรองข้อมูล</button><button class="btn" id="importSet">⬆ นำเข้า</button></div></div>
 <section class="card"><div class="card-head"><h2>ทั่วไป</h2></div><div class="formgrid"><label class="field"><span>ธีม</span><select id="theme"><option value="dark" ${s.theme==='dark'?'selected':''}>🌙 กลางคืน</option><option value="light" ${s.theme==='light'?'selected':''}>☀️ กลางวัน</option></select></label><label class="field"><span>สกุลเงินบัญชี</span><input id="currency" value="${esc(s.currency||'USD')}" placeholder="USD / THB"></label><label class="field"><span>ยอดเริ่มต้นบัญชี (ไว้ดูภาพรวม)</span><input id="startingBalance" type="number" step="any" value="${esc(s.startingBalance||'')}"></label><label class="field"><span>ชื่อโฟลเดอร์ Drive</span><input id="driveFolderName" value="${esc(s.driveFolderName||'Trade Memo')}"></label></div></section>
 <section class="card"><div class="card-head"><h2>☁️ Google Drive</h2><span class="small muted">${s.lastSync?`ซิงค์ล่าสุด ${new Date(s.lastSync).toLocaleString('th-TH')}`:'ยังไม่เคยซิงค์'}</span></div><div class="stack"><label class="field"><span>OAuth Client ID</span><input id="driveClientId" value="${esc(s.driveClientId||'')}" placeholder="xxxx.apps.googleusercontent.com"></label><div class="row"><button class="btn primary" id="syncNow">☁️ ซิงค์เดี๋ยวนี้</button><button class="btn" id="driveOut">ออกจาก Google</button></div><details><summary>วิธีตั้งค่า Google Drive</summary><div class="small muted" style="margin-top:8px;line-height:1.7">สร้างโปรเจกต์ใน Google Cloud Console → เปิด Google Drive API → OAuth consent screen → เพิ่มบัญชีของคุณเป็น Test user → สร้าง OAuth Client ID แบบ Web application → ใส่ Authorized JavaScript origins เป็น <code>${esc(location.origin)}</code> → นำ Client ID มาวางตรงนี้ สิทธิ์ที่แอปขอคือ <code>drive.file</code></div></details></div></section>
 <section class="card"><div class="card-head"><h2>🤖 อ่านภาพ MT5 ด้วย AI</h2></div><div class="formgrid"><label class="field full"><span>Claude API key</span><input id="claudeKey" type="password" value="${esc(s.claudeKey||'')}" placeholder="sk-ant-…" autocomplete="off"></label><label class="field"><span>Claude model</span><input id="claudeModel" value="${esc(s.claudeModel||'claude-3-5-sonnet-latest')}"></label><label class="field full"><span>Gemini API key</span><input id="geminiKey" type="password" value="${esc(s.geminiKey||'')}" placeholder="AIza…" autocomplete="off"></label><label class="field"><span>Gemini model</span><input id="geminiModel" value="${esc(s.geminiModel||'gemini-2.5-flash')}"></label></div><div class="notice" style="margin-top:12px">API keys เก็บใน browser เครื่องนี้เท่านั้น ตัว key จะถูกส่งออกเฉพาะเมื่อคุณกดใช้ AI ไปยัง Anthropic หรือ Google ตามบริการที่เลือก</div></section>
 <section class="card"><div class="card-head"><h2>🔒 ความเป็นส่วนตัว</h2></div><div class="small muted" style="line-height:1.7">โหมดปกติ: IndexedDB ใน browser • ไม่มี Analytics • ไม่มี database ของผู้พัฒนา • Backup เป็นไฟล์ JSON ของคุณเอง • Google Drive และ AI เป็นการเชื่อมต่อเสริมที่คุณเปิดใช้เอง • อย่าเก็บ MT5 password, broker password, API secret, private key หรือ seed phrase ในแอป</div></section></div>`;
 $('#theme').onchange=e=>{s.theme=e.target.value;document.documentElement.dataset.theme=s.theme;put('settings',{key:'theme',value:s.theme})};
 [['currency','currency'],['startingBalance','startingBalance'],['driveClientId','driveClientId'],['driveFolderName','driveFolderName'],['claudeKey','claudeKey'],['claudeModel','claudeModel'],['geminiKey','geminiKey'],['geminiModel','geminiModel']].forEach(([id,k])=>{$('#'+id).addEventListener('change',async e=>{s[k]=id==='startingBalance'?num(e.target.value):e.target.value;await put('settings',{key:k,value:s[k]})})});
 $('#exportSet').onclick=exportBackup;$('#importSet').onclick=importBackup;$('#syncNow').onclick=driveSync;$('#driveOut').onclick=driveSignOut;
}
function exportData(includeImages=true){return Promise.all([all('days'),all('images')]).then(async([days,imgs])=>{const out={version:2,app:'Trade Memo Private',exportedAt:new Date().toISOString(),settings:state.settings,days,images:imgs.map(i=>({id:i.id,date:i.date,kind:i.kind,name:i.name,type:i.type,createdAt:i.createdAt})),imageData:{}};if(includeImages)for(const i of imgs)out.imageData[i.id]=await blob64(i.blob);return out})}
async function exportBackup(){try{const data=await exportData(true);const blob=new Blob([JSON.stringify(data)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`trade-memo-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('ดาวน์โหลดไฟล์สำรองแล้ว','ok')}catch(e){toast('สำรองไม่สำเร็จ: '+e.message,'err')}}
async function importBackup(){const i=document.createElement('input');i.type='file';i.accept='application/json';i.onchange=async()=>{const f=i.files[0];if(!f)return;try{const data=JSON.parse(await f.text());for(const d of data.days||[]){const local=await get('days',d.date);if(!local||num(d.updatedAt)>=num(local.updatedAt))await put('days',d)}for(const im of data.images||[]){if(await get('images',im.id))continue;const b64=data.imageData?.[im.id];if(!b64)continue;const bin=atob(b64),arr=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)arr[j]=bin.charCodeAt(j);await put('images',{...im,blob:new Blob([arr],{type:im.type||'image/png'})})}for(const [k,v] of Object.entries(data.settings||{}))await put('settings',{key:k,value:v});await loadData();render();toast('นำเข้าไฟล์สำรองเรียบร้อย','ok')}catch(e){toast('นำเข้าไม่สำเร็จ: '+e.message,'err')}};i.click()}

let gToken=null,gExp=0,gClient=null;
function loadGIS(){if(window.google?.accounts?.oauth2)return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.onload=res;s.onerror=()=>rej(new Error('โหลด Google Identity ไม่สำเร็จ'));document.head.appendChild(s)})}
async function driveToken(){const id=state.settings.driveClientId;if(!id)throw new Error('ยังไม่ได้ใส่ Google OAuth Client ID');if(gToken&&Date.now()<gExp-60000)return gToken;await loadGIS();return new Promise((res,rej)=>{gClient=google.accounts.oauth2.initTokenClient({client_id:id,scope:'https://www.googleapis.com/auth/drive.file',callback:r=>{if(r.error)return rej(new Error(r.error_description||r.error));gToken=r.access_token;gExp=Date.now()+(Number(r.expires_in)||3600)*1000;res(gToken)},error_callback:e=>rej(new Error(e.message||e.type||'auth error'))});gClient.requestAccessToken({prompt:''})})}
async function driveApi(path,opt={}){const q=new URLSearchParams(opt.query||{}).toString(),url=(path.startsWith('http')?path:'https://www.googleapis.com/drive/v3'+path)+(q?'?'+q:'');const r=await fetch(url,{method:opt.method||'GET',headers:{Authorization:'Bearer '+gToken,...(opt.headers||{})},body:opt.body});if(!r.ok)throw new Error('Drive '+r.status);return opt.raw?r:r.json()}
async function driveUpload(meta,blob,id){const b='tm'+Math.random().toString(36).slice(2),head=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${blob.type||'application/octet-stream'}\r\n\r\n`,body=new Blob([head,blob,`\r\n--${b}--`]);return driveApi('https://www.googleapis.com/upload/drive/v3/files'+(id?'/'+id:''),{method:id?'PATCH':'POST',query:{uploadType:'multipart',fields:'id,name,modifiedTime'},headers:{'Content-Type':`multipart/related; boundary=${b}`},body})}
async function driveFind(name,parent,mime){let q=`name = '${name.replace(/'/g,"\\\\'")}' and trashed = false`;if(parent)q+=` and '${parent}' in parents`;if(mime)q+=` and mimeType = '${mime}'`;const r=await driveApi('/files',{query:{q,fields:'files(id,name,modifiedTime,size)',pageSize:10,spaces:'drive'}});return r.files?.[0]||null}
async function driveFolder(name,parent){const f=await driveFind(name,parent,'application/vnd.google-apps.folder');if(f)return f.id;const meta={name,mimeType:'application/vnd.google-apps.folder'};if(parent)meta.parents=[parent];const r=await driveApi('/files',{method:'POST',query:{fields:'id'},headers:{'Content-Type':'application/json'},body:JSON.stringify(meta)});return r.id}
async function driveList(parent){const r=await driveApi('/files',{query:{q:`'${parent}' in parents and trashed = false`,fields:'files(id,name,modifiedTime,size,mimeType)',pageSize:1000,spaces:'drive'}});return r.files||[]}
async function driveSync(){try{await driveToken();toast('กำลังซิงค์ Google Drive…');const root=await driveFolder(state.settings.driveFolderName||'Trade Memo'),imgFolder=await driveFolder('images',root),files=await driveList(root),df=files.find(f=>f.name==='trade-memo-data.json');const local=await exportData(false),blob=new Blob([JSON.stringify(local)],{type:'application/json'});if(df)await driveUpload({name:'trade-memo-data.json'},blob,df.id);else await driveUpload({name:'trade-memo-data.json',parents:[root]},blob);const imgs=await all('images'),remote=await driveList(imgFolder),have=new Set(remote.map(f=>f.name));for(const im of imgs){const ext=(im.type||'image/png').split('/')[1].replace('jpeg','jpg'),name=`${im.id}.${ext}`;if(!have.has(name))await driveUpload({name,parents:[imgFolder]},im.blob)}state.settings.lastSync=new Date().toISOString();await put('settings',{key:'lastSync',value:state.settings.lastSync});await render();toast('ซิงค์ Google Drive เรียบร้อย','ok')}catch(e){toast('ซิงค์ไม่สำเร็จ: '+e.message,'err')}}
function driveSignOut(){if(gToken&&window.google)google.accounts.oauth2.revoke(gToken,()=>{});gToken=null;gExp=0;toast('ออกจาก Google แล้ว','ok')}

window.addEventListener('hashchange',()=>{const h=location.hash.replace(/^#\/?/,'');const [v,d]=h.split('/');state.view=['diary','dashboard','settings'].includes(v)?v:'diary';if(state.view==='diary'&&/^\d{4}-\d{2}-\d{2}$/.test(d||''))state.date=d;render()});
document.addEventListener('paste',e=>{const img=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(img){const b=img.getAsFile();if(!b)return;if(state.view==='diary'){const card=$('#modalCard');if(!$('#modal').hidden&&card._onPaste){card._onPaste(b);e.preventDefault()}}}});
async function boot(){await loadData();const h=location.hash.replace(/^#\/?/,'');const [v,d]=h.split('/');state.view=['diary','dashboard','settings'].includes(v)?v:'diary';if(state.view==='diary'&&/^\d{4}-\d{2}-\d{2}$/.test(d||''))state.date=d;await render()}
boot();
})();
