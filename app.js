/* global supabaseClient, supabase */
(function(){
  'use strict';
  const db=window.supabaseClient||window.supabase;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  if(!db){ alert('Supabase client belum ditemukan. Pastikan supabase.js dimuat sebelum app.js.'); return; }
  const ID='kantin-data-v1';
  let allRows=[]; let currentPeriod=1; let chart=null;
  const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
  const num=id=>Number($(id)?.value||0);
  const dateVal=id=>$(id)?.value||new Date().toISOString().slice(0,10);
  const isFriday=d=>new Date(`${d}T00:00:00`).getDay()===5;
  const showToast=(msg,error=false)=>{const t=$('#toast'); t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.className='toast',3000)};
  const recordId=(type,date)=>`${type}:${date}`;
  const dataOf=r=>r?.data||{};
  const dTotal=d=>(Number(d.pend1)||0)+(Number(d.pend2)||0)-(Number(d.titip1)||0)-(Number(d.titip2)||0)-(Number(d.titip3)||0)-(Number(d.tabungan)||0);
  const monthKey=d=>d.slice(0,7);
  async function requireSession(){
    try {
      const {data, error}=await db.auth.getSession();
      if(error) throw error;
      return !!data?.session;
    } catch (e) {
      console.error('Session check gagal:', e);
      return false;
    }
  }
  function nav(tab){$$('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));$$('.tab-page').forEach(x=>x.classList.toggle('active',x.id===`tab-${tab}`));if(tab==='dashboard')renderDashboard();if(tab==='home')renderHomeSummary();}
  async function getRows(){
    const {data,error}=await db.from('kantin_data').select('*').order('tgl',{ascending:false});
    if(error)throw error; allRows=data||[]; return allRows;
  }
  function byType(type){return allRows.filter(r=>r.tipe===type)}
  async function upsert(type,date,data){
    const payload={record_id:recordId(type,date),tipe:type,tgl:date,data,updated_at:new Date().toISOString()};
    const {error}=await db.from('kantin_data').upsert(payload,{onConflict:'record_id'});if(error)throw error;
  }
  async function remove(id){const {error}=await db.from('kantin_data').delete().eq('id',id);if(error)throw error;}
  function clearDaily(){['#pend1','#pend2','#titip1','#titip2','#titip3','#dailySaving'].forEach(x=>$(x).value='0');updateDailyTotal();}
  function updateDailyTotal(){const d={pend1:num('#pend1'),pend2:num('#pend2'),titip1:num('#titip1'),titip2:num('#titip2'),titip3:num('#titip3'),tabungan:num('#dailySaving')};$('#dailyTotal').textContent=fmt(dTotal(d));}
  function loadDaily(date){
    const row=allRows.find(r=>r.tipe==='harian'&&r.tgl===date),d=dataOf(row); ['pend1','pend2','titip1','titip2','titip3','tabungan'].forEach(k=>{if($(`#${k==='tabungan'?'dailySaving':k}`))$(`#${k==='tabungan'?'dailySaving':k}`).value=Number(d[k]||0)});updateDailyTotal();
    const disabled=isFriday(date); ['#pend1','#pend2','#titip1','#titip2','#titip3','#dailySaving','#saveDailyBtn'].forEach(x=>$(x).disabled=disabled); $('#fridayNote').textContent=disabled?'Jumat otomatis libur — tidak ada transaksi.':'Hari operasional';
  }
  function renderDaily(){const q=($('#dailySearch').value||'').toLowerCase();const rows=byType('harian').filter(r=>!q||r.tgl.includes(q)).sort((a,b)=>b.tgl.localeCompare(a.tgl));const tb=$('#dailyTable tbody');tb.innerHTML=rows.map(r=>{const d=dataOf(r);return `<tr><td>${r.tgl}</td><td>${fmt(d.pend1)}</td><td>${fmt(d.pend2)}</td><td>${fmt(d.titip1)}</td><td>${fmt(d.titip2)}</td><td>${fmt(d.titip3)}</td><td>${fmt(d.tabungan)}</td><td><b>${fmt(dTotal(d))}</b></td><td><div class="row-actions"><button class="icon-btn edit-daily" data-date="${r.tgl}">Edit</button><button class="icon-btn del-row" data-id="${r.id}" data-kind="harian">Hapus</button></div></td></tr>`}).join('')||'<tr><td colspan="9">Belum ada data.</td></tr>';tb.querySelectorAll('.edit-daily').forEach(b=>b.onclick=()=>{$('#dailyDate').value=b.dataset.date;loadDaily(b.dataset.date);nav('daily')});tb.querySelectorAll('.del-row').forEach(b=>b.onclick=()=>deleteRow(b.dataset.id));}
  function renderExpense(){const rows=byType('pengeluaran').sort((a,b)=>b.tgl.localeCompare(a.tgl));$('#expenseTable tbody').innerHTML=rows.map(r=>`<tr><td>${r.tgl}</td><td>${escapeHtml(dataOf(r).keterangan||'-')}</td><td>${fmt(dataOf(r).nominal)}</td><td><button class="icon-btn del-row" data-id="${r.id}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="4">Belum ada data.</td></tr>';$($('#expenseTable')).find?.('');$('#expenseTable .del-row').forEach(b=>b.onclick=()=>deleteRow(b.dataset.id));}
  function renderSaving(){const inRows=byType('harian'),outs=byType('penarikan');let ins=0,out=0;inRows.forEach(r=>ins+=Number(dataOf(r).tabungan)||0);outs.forEach(r=>out+=Number(dataOf(r).nominal)||0);$('#savingInTotal').textContent=fmt(ins);$('#savingOutTotal').textContent=fmt(out);$('#savingBalance').textContent=fmt(ins-out);const rows=[...inRows.map(r=>({r,jenis:'Setoran',nom:Number(dataOf(r).tabungan)||0,note:'Tabungan harian'})),...outs.map(r=>({r,jenis:'Penarikan',nom:Number(dataOf(r).nominal)||0,note:dataOf(r).keterangan||'-'}))].sort((a,b)=>b.r.tgl.localeCompare(a.r.tgl));$('#savingTable tbody').innerHTML=rows.map(x=>`<tr><td>${x.r.tgl}</td><td>${x.jenis}</td><td>${escapeHtml(x.note)}</td><td>${fmt(x.nom)}</td><td>${x.jenis==='Penarikan'?`<button class="icon-btn del-row" data-id="${x.r.id}">Hapus</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada data.</td></tr>';$('#savingTable .del-row').forEach(b=>b.onclick=()=>deleteRow(b.dataset.id));}
  function dateRange(months){const end=new Date();const start=new Date(end.getFullYear(),end.getMonth()-months+1,1);return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)}}
  function calcMonthly(){const map={};allRows.forEach(r=>{const key=monthKey(r.tgl);if(!map[key])map[key]={month:key,pendapatan:0,titipan:0,tabungan:0,pengeluaran:0,penarikan:0,total:0};const d=dataOf(r);if(r.tipe==='harian'){const p=(Number(d.pend1)||0)+(Number(d.pend2)||0);const t=(Number(d.titip1)||0)+(Number(d.titip2)||0)+(Number(d.titip3)||0);map[key].pendapatan+=p;map[key].titipan+=t;map[key].tabungan+=Number(d.tabungan)||0;map[key].total+=p-t-(Number(d.tabungan)||0)}else if(r.tipe==='pengeluaran')map[key].pengeluaran+=Number(d.nominal)||0;else if(r.tipe==='penarikan')map[key].penarikan+=Number(d.nominal)||0;});return Object.values(map).sort((a,b)=>a.month.localeCompare(b.month));}
  function renderDashboard(){const range=dateRange(currentPeriod);const ms=calcMonthly().filter(x=>`${x.month}-01`>=range.start);const totals=ms.reduce((a,x)=>{a.pend+=x.pendapatan;a.exp+=x.pengeluaran;a.sav+=x.tabungan;a.out+=x.penarikan;a.net+=x.total-x.pengeluaran;return a},{pend:0,exp:0,sav:0,out:0,net:0});$('#dashboardMetrics').innerHTML=`<div class="metric glass"><small>Pendapatan</small><strong>${fmt(totals.pend)}</strong></div><div class="metric glass"><small>Pengeluaran</small><strong>${fmt(totals.exp)}</strong></div><div class="metric glass"><small>Tabungan</small><strong>${fmt(totals.sav)}</strong></div><div class="metric glass"><small>Arus bersih</small><strong>${fmt(totals.net)}</strong></div>`;$('#periodSummary').innerHTML=`<div><span>Periode</span><b>${currentPeriod===1?'1 bulan':currentPeriod+' bulan terakhir'}</b></div><div><span>Jumlah bulan</span><b>${ms.length}</b></div><div><span>Penarikan</span><b>${fmt(totals.out)}</b></div><div><span>Saldo tabungan bersih</span><b>${fmt(totals.sav-totals.out)}</b></div>`;renderMonthlyTable(ms);drawChart(ms);}
  function renderMonthlyTable(ms){$('#monthlyTable tbody').innerHTML=ms.map(x=>`<tr><td>${x.month}</td><td>${fmt(x.pendapatan)}</td><td>${fmt(x.titipan)}</td><td>${fmt(x.tabungan)}</td><td>${fmt(x.pengeluaran)}</td><td>${fmt(x.penarikan)}</td><td><b>${fmt(x.total-x.pengeluaran)}</b></td></tr>`).join('')||'<tr><td colspan="7">Belum ada data.</td></tr>';}
  function drawChart(ms){const c=$('#monthlyChart');if(!c)return;const ctx=c.getContext('2d');if(chart)chart.destroy();const max=Math.max(1,...ms.map(x=>Math.max(0,x.total-x.pengeluaran)));const pad={l:45,r:12,t:20,b:35};ctx.clearRect(0,0,c.width,c.height);ctx.font='11px system-ui';const w=c.width,h=c.height,iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;ctx.strokeStyle='rgba(179,205,224,.2)';for(let i=0;i<=4;i++){const y=pad.t+ih*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#b3cde0';ctx.fillText(fmt(max*(1-i/4)).replace('Rp',''),5,y+4)};const bw=iw/Math.max(ms.length,1);ms.forEach((x,i)=>{const val=Math.max(0,x.total-x.pengeluaran),bh=(val/max)*ih;const x0=pad.l+i*bw+bw*.2,y=h-pad.b-bh;ctx.fillStyle='#6497b1';ctx.roundRect(x0,y,bw*.6,bh,6);ctx.fill();ctx.fillStyle='#b3cde0';ctx.textAlign='center';ctx.fillText(x.month.slice(5),x0+bw*.3,h-12)});ctx.textAlign='start';}
  function renderHomeSummary(){const now=new Date();const ym=now.toISOString().slice(0,7);const hrs=byType('harian').filter(r=>r.tgl.startsWith(ym));const ex=byType('pengeluaran').filter(r=>r.tgl.startsWith(ym));let p=0,t=0,s=0,e=0;hrs.forEach(r=>{const d=dataOf(r);p+=Number(d.pend1)||0;p+=Number(d.pend2)||0;t+=Number(d.titip1)||0;t+=Number(d.titip2)||0;t+=Number(d.titip3)||0;s+=Number(d.tabungan)||0});ex.forEach(r=>e+=Number(dataOf(r).nominal)||0);const total=p-t-s-e;$('#homeSummary').innerHTML=[['Pendapatan bulan ini',p],['Titipan bulan ini',t],['Tabungan bulan ini',s],['Bersih bulan ini',total]].map(x=>`<div class="summary-card glass"><small>${x[0]}</small><strong>${fmt(x[1])}</strong></div>`).join('');}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  async function saveDaily(){const date=dateVal('#dailyDate');if(isFriday(date)){showToast('Hari Jumat otomatis libur.',true);return}const d={pend1:num('#pend1'),pend2:num('#pend2'),titip1:num('#titip1'),titip2:num('#titip2'),titip3:num('#titip3'),tabungan:num('#dailySaving')};await upsert('harian',date,d);await refresh();showToast('Laporan harian tersimpan.');}
  async function saveExpense(){const date=dateVal('#expenseDate');if(isFriday(date)){showToast('Hari Jumat otomatis libur.',true);return}const nominal=num('#expenseAmount'),note=$('#expenseNote').value.trim();if(nominal<=0)return showToast('Nominal pengeluaran harus lebih dari 0.',true);const rid=`pengeluaran:${date}:${crypto.randomUUID()}`;const {error}=await db.from('kantin_data').insert({record_id:rid,tipe:'pengeluaran',tgl:date,data:{nominal,keterangan:note},updated_at:new Date().toISOString()});if(error)throw error;$('#expenseAmount').value='';$('#expenseNote').value='';await refresh();showToast('Pengeluaran tersimpan.');}
  async function saveWithdraw(){const date=dateVal('#withdrawDate');if(isFriday(date)){showToast('Hari Jumat otomatis libur.',true);return}const nominal=num('#withdrawAmount'),note=$('#withdrawNote').value.trim();if(nominal<=0)return showToast('Nominal penarikan harus lebih dari 0.',true);const rid=`penarikan:${date}:${crypto.randomUUID()}`;const {error}=await db.from('kantin_data').insert({record_id:rid,tipe:'penarikan',tgl:date,data:{nominal,keterangan:note},updated_at:new Date().toISOString()});if(error)throw error;$('#withdrawAmount').value='';$('#withdrawNote').value='';await refresh();showToast('Penarikan tersimpan.');}
  async function deleteRow(id){if(!confirm('Hapus data ini?'))return;try{await remove(id);await refresh();showToast('Data dihapus.')}catch(e){showToast(e.message,true)}}
  function csv(items){if(!items.length)return '';const flat=items.map(r=>({id:r.record_id,tipe:r.tipe,tanggal:r.tgl,...dataOf(r)}));const headers=[...new Set(flat.flatMap(o=>Object.keys(o)))];return [headers.join(','),...flat.map(o=>headers.map(h=>`"${String(o[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n');}
  function exportCSV(){const type=$('#exportType').value;const rows=type==='all'?allRows:byType(type);const blob=new Blob(['\ufeff'+csv(rows)],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kantin-uimsya-${type}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  async function changePassword(){const a=$('#newPassword').value,b=$('#newPassword2').value;if(a.length<8)return showToast('Password minimal 8 karakter.',true);if(a!==b)return showToast('Konfirmasi password tidak sama.',true);const {error}=await db.auth.updateUser({password:a});if(error)throw error;$('#newPassword').value='';$('#newPassword2').value='';showToast('Password berhasil diubah.');}
  async function logout(){try{await db.auth.signOut()}catch(e){}localStorage.removeItem('kantin_session');location.href='index.html';}
  async function printDaily(){const date=$('#dailyDate').value;loadDaily(date);window.print();}
  async function refresh(){await getRows();renderDaily();renderExpense();renderSaving();renderDashboard();renderHomeSummary();}
  function bind(){
    $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.tab)));
    $('#dailyDate').value=new Date().toISOString().slice(0,10);$('#expenseDate').value=$('#dailyDate').value;$('#withdrawDate').value=$('#dailyDate').value;
    ['#pend1','#pend2','#titip1','#titip2','#titip3','#dailySaving'].forEach(x=>$(x).addEventListener('input',updateDailyTotal));$('#dailyDate').addEventListener('change',e=>loadDaily(e.target.value));$('#dailySearch').addEventListener('input',renderDaily);$('#saveDailyBtn').onclick=()=>saveDaily().catch(e=>showToast(e.message,true));$('#clearDailyBtn').onclick=clearDaily;$('#saveExpenseBtn').onclick=()=>saveExpense().catch(e=>showToast(e.message,true));$('#saveWithdrawBtn').onclick=()=>saveWithdraw().catch(e=>showToast(e.message,true));$('#exportCsvBtn').onclick=exportCSV;$('#changePasswordBtn').onclick=()=>changePassword().catch(e=>showToast(e.message,true));$('#logoutBtn').onclick=logout;$('#printDailyBtn').onclick=printDaily;
    $$('.seg').forEach(b=>b.onclick=()=>{$$('.seg').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentPeriod=Number(b.dataset.period);renderDashboard()});
  }
  async function init(){
    if(!(await requireSession())){
      localStorage.removeItem('kantin_session');
      location.replace('index.html');
      return;
    }
    try {
      bind();
      if(window.homeInit)window.homeInit();
      await refresh();
      loadDaily($('#dailyDate').value);
    } catch(e) {
      console.error(e);
      showToast(`Gagal memuat aplikasi: ${e.message}`, true);
    }
  }
  window.addEventListener('load',init);
})();
