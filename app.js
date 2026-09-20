/* global supabaseClient */
(function(){
  'use strict';
  const db=window.supabaseClient;
  if(!db){document.body.innerHTML='<div style="padding:30px;font-family:system-ui">Supabase client belum tersedia. Periksa supabase.js.</div>';return;}
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const state={rows:[],session:null,tab:'home',months:1,report:null,editId:null,opening:Number(localStorage.getItem('kantin_opening_balance')||0)};
  const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
  const num=v=>Number(v)||0;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid=()=>window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const isoToday=()=>new Date().toISOString().slice(0,10);
  const isFriday=d=>new Date(`${d}T00:00:00`).getDay()===5;
  const dayNames=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const getDayName=tgl=>dayNames[new Date(`${tgl}T00:00:00`).getDay()];
  const getLiburJumat=()=>localStorage.getItem('kantin_libur_jumat')!=='false';
  const byLibur=()=>state.rows.filter(r=>r.tipe==='libur');
  const isExplicitHoliday=date=>!!byLibur().find(r=>r.tgl===date);
  const isAutoLiburJumat=date=>getLiburJumat()&&isFriday(date)&&!state.rows.find(r=>r.tipe==='harian'&&r.tgl===date);
  const totalDaily=d=>num(d.pend1)+num(d.pend2)-num(d.titip1)-num(d.titip2)-num(d.titip3)-num(d.tabungan);
  const monthName=k=>{const [y,m]=k.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})};
  const monthKey=d=>String(d||'').slice(0,7);
  const data=r=>r?.data||{};
  const toast=(msg,error=false)=>{const t=$('#toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(window.__t);window.__t=setTimeout(()=>t.className='toast',3200)};
  const typeLabel=t=>({pemasukan:'Pemasukan',pengeluaran:'Pengeluaran',transfer:'Transfer',setoran_tabungan:'Setoran Tabungan',penarikan:'Penarikan'}[t]||t);

  async function requireSession(){const {data,error}=await db.auth.getSession();if(error||!data?.session){location.replace('index.html');return false;}state.session=data.session;return true;}
  async function loadRows(){const {data,error}=await db.from('kantin_data').select('*').order('tgl',{ascending:false});if(error)throw error;state.rows=data||[];return state.rows;}
  const byType=t=>state.rows.filter(r=>r.tipe===t);
  async function writeRow(tgl,tipe,payload,recordId){const rid=recordId||`${tipe}:${uid()}`;const {error}=await db.from('kantin_data').upsert({record_id:rid,tipe,tgl,data:payload,updated_at:new Date().toISOString()},{onConflict:'record_id'});if(error)throw error;return rid;}
  async function deleteById(id){const {error}=await db.from('kantin_data').delete().eq('id',id);if(error)throw error;}
  function nav(tab){state.tab=tab;$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.page').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`));$('#pageTitle').textContent=$(`[data-tab="${tab}"] span`)?.textContent||({home:'Beranda',ringkasan:'Ringkasan',transaksi:'Transaksi',kas:'Buku Kas',harian:'Laporan Harian',piutang:'Piutang',hutang:'Hutang',persediaan:'Persediaan',pemasok:'Pemasok',tabungan:'Tabungan',laporan:'Laporan',pengaturan:'Pengaturan'}[tab]||tab);if(tab==='home')renderHome();if(tab==='ringkasan')renderDashboard();if(tab==='transaksi')renderTransactions();if(tab==='kas')renderCash();if(tab==='harian')renderDaily();if(tab==='piutang')renderReceivables();if(tab==='hutang')renderPayables();if(tab==='persediaan')renderStock();if(tab==='pemasok')renderSuppliers();if(tab==='tabungan')renderSavings();if(tab==='laporan'&&state.report)renderReport(state.report);}

  function operationalLocked(date){return isExplicitHoliday(date)||(getLiburJumat()&&isFriday(date));}
  function renderHome(){const now=new Date(),mk=now.toISOString().slice(0,7),daily=byType('harian').filter(r=>monthKey(r.tgl)===mk),ex=byType('pengeluaran').filter(r=>monthKey(r.tgl)===mk),other=byType('pemasukan').filter(r=>monthKey(r.tgl)===mk);let sales=0,save=0,dayNet=0,expense=0,otherIn=0;daily.forEach(r=>{const d=data(r);sales+=num(d.pend1)+num(d.pend2);save+=num(d.tabungan);dayNet+=totalDaily(d)});ex.forEach(r=>expense+=num(data(r).nominal));other.forEach(r=>otherIn+=num(data(r).nominal));const profit=sales+otherIn-expense;const p=state.rows.filter(r=>r.tipe==='penarikan').reduce((a,r)=>a+num(data(r).nominal),0);const s=state.rows.filter(r=>r.tipe==='harian').reduce((a,r)=>a+num(data(r).tabungan),0)+state.rows.filter(r=>r.tipe==='setoran_tabungan').reduce((a,r)=>a+num(data(r).nominal),0);const savings=s-p;$('#homeStats').innerHTML=[['Penjualan bulan ini',sales],['Laba operasional',profit],['Saldo tabungan',savings],['Piutang tersisa',receivableTotal()]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${fmt(v)}</strong></div>`).join('');$('#homeMonth').innerHTML=`<div class="kpi-list"><div><span>Kas masuk dari laporan harian</span><b>${fmt(dayNet)}</b></div><div><span>Pengeluaran</span><b>${fmt(expense)}</b></div><div><span>Pendapatan lain</span><b>${fmt(otherIn)}</b></div><div><span>Tabungan aktif</span><b>${fmt(savings)}</b></div><div><span>Penarikan tabungan</span><b>${fmt(p)}</b></div></div>`;}

  function monthlySummary(months=state.months){const end=new Date();const start=new Date(end.getFullYear(),end.getMonth()-months+1,1);const map={};for(const r of state.rows){const d=r.tgl?new Date(`${r.tgl}T00:00:00`):null;if(!d||d<start)return;const k=monthKey(r.tgl);if(!map[k])map[k]={key:k,sales:0,otherIn:0,expense:0,withdraw:0,saving:0,dailyNet:0};const x=data(r);if(r.tipe==='harian'){map[k].sales+=num(x.pend1)+num(x.pend2);map[k].saving+=num(x.tabungan);map[k].dailyNet+=totalDaily(x);}else if(r.tipe==='pemasukan')map[k].otherIn+=num(x.nominal);else if(r.tipe==='pengeluaran')map[k].expense+=num(x.nominal);else if(r.tipe==='penarikan')map[k].withdraw+=num(x.nominal);else if(r.tipe==='setoran_tabungan')map[k].saving+=num(x.nominal);}return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));}
  function renderDashboard(){const ms=monthlySummary();const sales=ms.reduce((a,x)=>a+x.sales,0),other=ms.reduce((a,x)=>a+x.otherIn,0),exp=ms.reduce((a,x)=>a+x.expense,0),sav=ms.reduce((a,x)=>a+x.saving,0),wd=ms.reduce((a,x)=>a+x.withdraw,0);const profit=sales+other-exp;const netCash=ms.reduce((a,x)=>a+x.dailyNet+x.otherIn-x.expense+x.withdraw,0);$('#dashStats').innerHTML=[['Penjualan',sales],['Pendapatan lain',other],['Pengeluaran',exp],['Laba operasional',profit],['Tabungan',sav],['Penarikan',wd],['Arus kas operasional',netCash],['Saldo tabungan',sav-wd]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${fmt(v)}</strong></div>`).join('');renderChart(ms);const thisM=ms[ms.length-1]||{sales:0,otherIn:0,expense:0,saving:0};$('#composition').innerHTML=`<div class="kpi-list"><div><span>Penjualan</span><b>${fmt(thisM.sales)}</b></div><div><span>Pendapatan lain</span><b>${fmt(thisM.otherIn)}</b></div><div><span>Pengeluaran</span><b>${fmt(thisM.expense)}</b></div><div><span>Laba operasional</span><b>${fmt(thisM.sales+thisM.otherIn-thisM.expense)}</b></div><div><span>Tabungan</span><b>${fmt(thisM.saving)}</b></div></div>`;$('#monthlyTable tbody').innerHTML=ms.map(x=>`<tr><td>${monthName(x.key)}</td><td>${fmt(x.sales)}</td><td>${fmt(x.otherIn)}</td><td>${fmt(x.expense)}</td><td>${fmt(x.withdraw)}</td><td class="positive">${fmt(x.sales+x.otherIn-x.expense)}</td><td>${fmt(x.saving-x.withdraw)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Belum ada data.</td></tr>';}
  function renderChart(ms){const max=Math.max(1,...ms.map(x=>Math.max(x.sales+x.otherIn,x.expense))),el=$('#monthlyChart');el.innerHTML=ms.map(x=>{const a=((x.sales+x.otherIn)/max)*100,b=(x.expense/max)*100;return `<div class="bar-row"><span>${esc(x.key.slice(5))}</span><div class="bars"><i style="width:${a}%"></i><em style="width:${b}%"></em></div><b>${fmt(x.sales+x.otherIn-x.expense)}</b></div>`}).join('')||'<div class="empty">Belum ada data.</div>';}

  function formModal(title,body,onSave){const root=$('#modalRoot');root.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="x" id="closeModal">×</button></div><form id="modalForm" class="modal-body">${body}<div class="modal-actions"><button type="button" class="btn" id="cancelModal">Batal</button><button type="submit" class="primary">Simpan</button></div></form></div></div>`;root.querySelector('#closeModal').onclick=closeModal;root.querySelector('#cancelModal').onclick=closeModal;root.querySelector('#modalForm').addEventListener('submit',async e=>{e.preventDefault();try{await onSave(new FormData(e.currentTarget));closeModal();await refresh();toast('Data tersimpan.')}catch(err){console.error(err);toast(err.message||'Gagal menyimpan data.',true)}});}
  function closeModal(){$('#modalRoot').innerHTML='';state.editId=null;}
  function openTransaction(type='pemasukan',row=null){const d=row?data(row):{};const today=row?.tgl||isoToday();formModal(row?'Edit Transaksi':'Transaksi Kas',`<div class="form-grid cols-2"><label>Tanggal<input type="date" name="tgl" value="${today}" required></label><label>Jenis<select name="tipe"><option value="pemasukan" ${type==='pemasukan'?'selected':''}>Pemasukan</option><option value="pengeluaran" ${type==='pengeluaran'?'selected':''}>Pengeluaran</option><option value="transfer" ${type==='transfer'?'selected':''}>Transfer</option><option value="setoran_tabungan" ${type==='setoran_tabungan'?'selected':''}>Setoran Tabungan</option><option value="penarikan" ${type==='penarikan'?'selected':''}>Penarikan Tabungan</option></select></label><label>Kategori<input name="kategori" value="${esc(d.kategori||'Operasional')}" placeholder="Contoh: Belanja bahan"></label><label>Akun Kas/Rekening<select name="akun"><option>Kas Kantin</option><option>Kas Kecil</option><option>Bank</option><option>E-Wallet</option><option>Tabungan</option></select></label><label>Nominal<input type="number" name="nominal" min="0" step="100" value="${num(d.nominal)}" required></label><label>No. Transaksi<input name="no_transaksi" value="${esc(d.no_transaksi||'TRX-'+today.replaceAll('-','')+'-'+String(state.rows.length+1).padStart(3,'0'))}"></label><label class="full">Keterangan<textarea name="keterangan" rows="3">${esc(d.keterangan||'')}</textarea></label></div><div class="notice">Hari libur (Jumat otomatis atau yang ditetapkan admin) memblokir transaksi Pemasukan/Pengeluaran/Penarikan. Transfer dan Setoran Tabungan tetap dapat dicatat.</div>`,async f=>{const t=f.get('tipe'),tgl=f.get('tgl');if(['pemasukan','pengeluaran','penarikan'].includes(t)&&operationalLocked(tgl))throw new Error('Tanggal ini libur. Transaksi Pemasukan/Pengeluaran/Penarikan tidak dapat dicatat. Gunakan Transfer atau Setoran Tabungan untuk transaksi administrasi.');const payload={nominal:num(f.get('nominal')),kategori:String(f.get('kategori')||''),akun:String(f.get('akun')||'Kas Kantin'),keterangan:String(f.get('keterangan')||''),no_transaksi:String(f.get('no_transaksi')||''),user:state.session.user.email?.split('@')[0]||'user'};await writeRow(tgl,t,payload,row?.record_id);});}

  function renderTransactions(){const q=($('#trxSearch')?.value||'').toLowerCase(),t=$('#trxType')?.value||'',from=$('#trxFrom')?.value||'',to=$('#trxTo')?.value||'';let rows=state.rows.filter(r=>['pemasukan','pengeluaran','transfer','setoran_tabungan','penarikan'].includes(r.tipe));rows=rows.filter(r=>{const d=data(r),hay=[r.tgl,r.tipe,d.kategori,d.keterangan,d.no_transaksi,d.akun].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!t||r.tipe===t)&&(!from||r.tgl>=from)&&(!to||r.tgl<=to)});$('#trxTable tbody').innerHTML=rows.map(r=>{const d=data(r);return `<tr><td>${r.tgl}</td><td>${esc(d.no_transaksi||'-')}</td><td><span class="pill">${typeLabel(r.tipe)}</span></td><td>${esc(d.kategori||'-')}</td><td>${esc(d.akun||'-')}</td><td class="money">${fmt(d.nominal)}</td><td>${esc(d.keterangan||'-')}</td><td><div class="row-actions"><button class="icon-btn edit-trx" data-id="${r.id}">Edit</button><button class="icon-btn danger-text del" data-id="${r.id}">Hapus</button></div></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Belum ada transaksi.</td></tr>';$$('#trxTable .edit-trx').forEach(b=>b.onclick=()=>{const r=state.rows.find(x=>x.id===b.dataset.id);if(r)openTransaction(r.tipe,r)});$$('#trxTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));}

  function cashEntries(){const rows=[];state.rows.forEach(r=>{const d=data(r);if(r.tipe==='harian')rows.push({tgl:r.tgl,label:'Laporan harian',note:'Net harian kantin',in:totalDaily(d),out:0,source:'harian'});else if(r.tipe==='pemasukan')rows.push({tgl:r.tgl,label:'Pemasukan',note:d.keterangan||d.kategori||'',in:num(d.nominal),out:0,source:'trx'});else if(r.tipe==='pengeluaran')rows.push({tgl:r.tgl,label:'Pengeluaran',note:d.keterangan||d.kategori||'',in:0,out:num(d.nominal),source:'trx'});else if(r.tipe==='penarikan')rows.push({tgl:r.tgl,label:'Penarikan tabungan',note:d.keterangan||'',in:num(d.nominal),out:0,source:'saving'});else if(r.tipe==='setoran_tabungan')rows.push({tgl:r.tgl,label:'Setoran tabungan',note:d.keterangan||'',in:0,out:num(d.nominal),source:'saving'});});return rows.sort((a,b)=>a.tgl.localeCompare(b.tgl));}
  function renderCash(){const entries=cashEntries();let bal=state.opening;let totalIn=0,totalOut=0;const body=entries.map(x=>{bal+=x.in-x.out;totalIn+=x.in;totalOut+=x.out;return `<tr><td>${x.tgl}</td><td>${x.label}</td><td>${esc(x.note)}</td><td>${fmt(x.in)}</td><td>${fmt(x.out)}</td><td>${fmt(bal)}</td></tr>`}).join('');$('#openingBalance').value=state.opening;$('#cashStats').innerHTML=[['Saldo awal',state.opening],['Total masuk',totalIn],['Total keluar',totalOut],['Saldo akhir',bal]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${fmt(v)}</strong></div>`).join('');$('#cashTable tbody').innerHTML=body||'<tr><td colspan="6" class="empty">Belum ada arus kas.</td></tr>';}

  function renderDaily(){
    const harian=byType('harian').map(r=>({...r,status:'OPERASIONAL'}));
    const libur=byLibur().map(r=>({...r,status:'LIBUR'}));
    const drow=[...harian,...libur].sort((a,b)=>b.tgl.localeCompare(a.tgl));
    const selected=$('#dailyDate');
    if(selected&&!selected.value)selected.value=isoToday();
    loadDailyForm(selected?.value||isoToday());
    $('#dailyTable tbody').innerHTML=drow.map(r=>{
      const d=data(r);const isLibur=r.status==='LIBUR';
      const pend=isLibur?0:num(d.pend1)+num(d.pend2);
      const titip=isLibur?0:num(d.titip1)+num(d.titip2)+num(d.titip3);
      return `<tr class="${isLibur?'row-libur':''}"><td>${r.tgl}</td><td>${getDayName(r.tgl)}</td><td><span class="status-badge ${isLibur?'libur':'ops'}">${r.status}</span></td><td>${isLibur?'—':fmt(pend)}</td><td>${isLibur?'—':fmt(titip)}</td><td>${isLibur?'—':fmt(d.tabungan)}</td><td class="money">${fmt(isLibur?0:totalDaily(d))}</td><td><button class="icon-btn edit-daily" data-date="${r.tgl}">Edit</button> ${isLibur?`<button class="icon-btn danger-text del-holiday" data-date="${r.tgl}" data-id="${r.id}">Buka</button>`:`<button class="icon-btn danger-text del" data-id="${r.id}">Hapus</button>`}</td></tr>`;
    }).join('')||'<tr><td colspan="8" class="empty">Belum ada laporan harian atau hari libur tercatat.</td></tr>';
    $$('#dailyTable .edit-daily').forEach(b=>b.onclick=()=>{nav('harian');$('#dailyDate').value=b.dataset.date;loadDailyForm(b.dataset.date)});
    $$('#dailyTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));
    $$('#dailyTable .del-holiday').forEach(b=>b.onclick=async()=>{
      if(!confirm(`Hapus status LIBUR untuk ${b.dataset.date}? Tanggal ini akan bisa diinput kembali.`))return;
      await deleteById(b.dataset.id);await refresh();toast('Status libur dihapus. Tanggal siap diinput.');
    });
  }
  function loadDailyForm(date){
    const r=state.rows.find(x=>x.tipe==='harian'&&x.tgl===date),d=data(r);
    ['pend1','pend2','titip1','titip2','titip3'].forEach(k=>$('#'+k).value=num(d[k]));
    $('#dailySaving').value=num(d.tabungan);
    $('#dailyTotal').textContent=fmt(totalDaily({pend1:num(d.pend1),pend2:num(d.pend2),titip1:num(d.titip1),titip2:num(d.titip2),titip3:num(d.titip3),tabungan:num(d.tabungan)}));
    const explicitHoliday=isExplicitHoliday(date);
    const autoFriday=isAutoLiburJumat(date);
    const locked=explicitHoliday;
    let noticeText,noticeClass;
    if(explicitHoliday){
      const lr=byLibur().find(x=>x.tgl===date);
      const ket=lr?data(lr).keterangan:'';
      noticeText=`🔴 LIBUR — ${ket||'Tanggal ini ditetapkan sebagai hari libur'}. Klik "Ubah ke Operasional" untuk membuka formulir.`;
      noticeClass='notice warn';
    }else if(autoFriday){
      noticeText='🟡 Jumat otomatis libur (pengaturan aktif). Isi data dan klik Simpan untuk menjadikan hari ini OPERASIONAL, atau klik "Tandai Libur" untuk menyimpan status libur secara eksplisit.';
      noticeClass='notice warn';
    }else{
      noticeText='🟢 Hari operasional — laporan dapat disimpan. Klik "Tandai Libur" jika kantin tidak beroperasi hari ini.';
      noticeClass='notice good';
    }
    $('#fridayNotice').textContent=noticeText;$('#fridayNotice').className=noticeClass;
    $$('#tab-harian input').forEach(i=>{if(i.id!=='dailyDate')i.disabled=locked});
    $('#saveDaily').disabled=locked;
    const sh=$('#setHolidayBtn'),ush=$('#unsetHolidayBtn');
    if(sh)sh.style.display=explicitHoliday?'none':'';
    if(ush)ush.style.display=explicitHoliday?'':'none';
  }
  async function saveDaily(){
    const date=$('#dailyDate').value;if(!date)return;
    if(isExplicitHoliday(date))return toast('Tanggal ini ditandai LIBUR. Klik "Ubah ke Operasional" untuk membuka formulir terlebih dahulu.',true);
    const d={pend1:num($('#pend1').value),pend2:num($('#pend2').value),titip1:num($('#titip1').value),titip2:num($('#titip2').value),titip3:num($('#titip3').value),tabungan:num($('#dailySaving').value)};
    await writeRow(date,'harian',d,`harian:${date}`);
    toast('Laporan harian tersimpan. Status: OPERASIONAL.');await refresh();
  }

  function holidayModal(defaultDate){
    formModal('📅 Tetapkan Hari Libur',`<div class="form-grid cols-1"><label>Tanggal<input type="date" name="tgl" value="${defaultDate||isoToday()}" required></label><label>Keterangan Libur<input name="keterangan" value="Hari libur" placeholder="Contoh: Hari Raya, Acara internal, dll" required></label></div><div class="notice">Tanggal ini akan disimpan di database dengan status LIBUR dan muncul di laporan dengan nominal Rp0. Ini tidak menghapus data yang sudah ada.</div>`,async f=>{
      const tgl=f.get('tgl'),ket=String(f.get('keterangan')||'Hari libur');
      if(state.rows.find(r=>r.tipe==='harian'&&r.tgl===tgl))throw new Error('Tanggal ini sudah punya laporan OPERASIONAL. Hapus laporan harian terlebih dahulu jika ingin mengubah ke status LIBUR.');
      await writeRow(tgl,'libur',{keterangan:ket},`libur:${tgl}`);
      toast('Hari libur berhasil ditetapkan dan tersimpan di database.');
    });
  }

  function generateFullDailyRange(){
    const harian=byType('harian');const libur=byLibur();const liburJumat=getLiburJumat();
    if(!harian.length&&!libur.length)return[];
    const allDates=[...harian,...libur].map(r=>r.tgl);
    const minDate=allDates.reduce((a,b)=>a<b?a:b);
    const maxDate=allDates.reduce((a,b)=>a>b?a:b);
    const result=[];const cur=new Date(`${minDate}T00:00:00`);const end=new Date(`${maxDate}T00:00:00`);
    while(cur<=end){
      const tgl=cur.toISOString().slice(0,10);
      const harianRow=harian.find(r=>r.tgl===tgl);
      const liburRow=libur.find(r=>r.tgl===tgl);
      if(harianRow){result.push({tgl,status:'OPERASIONAL',...data(harianRow)});}
      else if(liburRow){result.push({tgl,status:'LIBUR',keterangan:data(liburRow).keterangan||'',pend1:0,pend2:0,titip1:0,titip2:0,titip3:0,tabungan:0});}
      else if(liburJumat&&isFriday(tgl)){result.push({tgl,status:'LIBUR',keterangan:'Jumat libur otomatis',pend1:0,pend2:0,titip1:0,titip2:0,titip3:0,tabungan:0});}
      else{result.push({tgl,status:'LIBUR',keterangan:'',pend1:0,pend2:0,titip1:0,titip2:0,titip3:0,tabungan:0});}
      cur.setDate(cur.getDate()+1);
    }
    return result;
  }

  function receivables(){const open=byType('piutang');return open.map(r=>{const d=data(r);const paid=byType('pembayaran_piutang').filter(p=>data(p).piutang_id===r.id).reduce((a,p)=>a+num(data(p).nominal),0);return {...r,d,paid,balance:Math.max(0,num(d.nominal)-paid),status:paid>=num(d.nominal)?'Lunas':paid>0?'Sebagian':'Belum lunas'}})}
  function receivableTotal(){return receivables().reduce((a,r)=>a+r.balance,0)}
  function renderReceivables(){const rows=receivables();$('#piutangStats').innerHTML=[['Total Piutang',rows.reduce((a,r)=>a+num(r.d.nominal),0)],['Terbayar',rows.reduce((a,r)=>a+r.paid,0)],['Sisa',rows.reduce((a,r)=>a+r.balance,0)],['Belum Lunas',rows.filter(r=>r.balance>0).length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${typeof v==='number'&&l!=='Belum Lunas'?fmt(v):v}</strong></div>`).join('');$('#piutangTable tbody').innerHTML=rows.map(r=>`<tr><td>${r.tgl}</td><td>${esc(r.d.pelanggan)}</td><td>${esc(r.d.keterangan||'-')}</td><td>${r.d.jatuh_tempo||'-'}</td><td>${fmt(r.d.nominal)}</td><td>${fmt(r.paid)}</td><td class="money">${fmt(r.balance)}</td><td><span class="status ${r.balance===0?'ok':r.paid>0?'partial':'bad'}">${r.status}</span></td><td>${r.balance>0?`<button class="icon-btn pay-recv" data-id="${r.id}">Bayar</button>`:''} <button class="icon-btn danger-text del" data-id="${r.id}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">Belum ada piutang.</td></tr>';$$('#piutangTable .pay-recv').forEach(b=>b.onclick=()=>paymentModal('piutang',b.dataset.id));$$('#piutangTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));}
  function payables(){return byType('hutang').map(r=>{const d=data(r);const paid=byType('pembayaran_hutang').filter(p=>data(p).hutang_id===r.id).reduce((a,p)=>a+num(data(p).nominal),0);return {...r,d,paid,balance:Math.max(0,num(d.nominal)-paid),status:paid>=num(d.nominal)?'Lunas':paid>0?'Sebagian':'Belum lunas'}})}
  function renderPayables(){const rows=payables();$('#hutangStats').innerHTML=[['Total Hutang',rows.reduce((a,r)=>a+num(r.d.nominal),0)],['Terbayar',rows.reduce((a,r)=>a+r.paid,0)],['Sisa',rows.reduce((a,r)=>a+r.balance,0)],['Belum Lunas',rows.filter(r=>r.balance>0).length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${l==='Belum Lunas'?v:fmt(v)}</strong></div>`).join('');$('#hutangTable tbody').innerHTML=rows.map(r=>`<tr><td>${r.tgl}</td><td>${esc(r.d.supplier)}</td><td>${esc(r.d.keterangan||'-')}</td><td>${r.d.jatuh_tempo||'-'}</td><td>${fmt(r.d.nominal)}</td><td>${fmt(r.paid)}</td><td class="money">${fmt(r.balance)}</td><td><span class="status ${r.balance===0?'ok':r.paid>0?'partial':'bad'}">${r.status}</span></td><td>${r.balance>0?`<button class="icon-btn pay-payable" data-id="${r.id}">Bayar</button>`:''} <button class="icon-btn danger-text del" data-id="${r.id}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">Belum ada hutang.</td></tr>';$$('#hutangTable .pay-payable').forEach(b=>b.onclick=()=>paymentModal('hutang',b.dataset.id));$$('#hutangTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));}
  function debtModal(kind){const isR=kind==='piutang',title=isR?'Tambah Piutang':'Tambah Hutang';formModal(title,`<div class="form-grid cols-2"><label>Tanggal<input type="date" name="tgl" value="${isoToday()}" required></label><label>${isR?'Pelanggan':'Supplier'}<input name="party" required></label><label>Nominal<input type="number" name="nominal" min="0" step="100" required></label><label>Jatuh Tempo<input type="date" name="jatuh_tempo"></label><label class="full">Keterangan<textarea name="keterangan" rows="3"></textarea></label></div>`,async f=>{const tipe=isR?'piutang':'hutang';await writeRow(f.get('tgl'),tipe,{[isR?'pelanggan':'supplier']:String(f.get('party')),nominal:num(f.get('nominal')),jatuh_tempo:String(f.get('jatuh_tempo')||''),keterangan:String(f.get('keterangan')||'')})});}
  function paymentModal(kind,id){const isR=kind==='piutang',row=state.rows.find(r=>r.id===id),d=data(row);const current=isR?receivables().find(x=>x.id===id):payables().find(x=>x.id===id);formModal(isR?'Pembayaran Piutang':'Pembayaran Hutang',`<div class="form-grid cols-2"><label>Tanggal<input type="date" name="tgl" value="${isoToday()}" required></label><label>Nominal<input type="number" name="nominal" max="${current.balance}" min="0" step="100" required></label><label class="full">Keterangan<textarea name="keterangan" rows="3">Pembayaran ${isR?'piutang':'hutang'} ${d[isR?'pelanggan':'supplier']}</textarea></label></div><div class="notice">Sisa saat ini: <b>${fmt(current.balance)}</b></div>`,async f=>{const n=num(f.get('nominal'));if(n<=0||n>current.balance)throw new Error('Nominal pembayaran melebihi sisa tagihan.');await writeRow(f.get('tgl'),isR?'pembayaran_piutang':'pembayaran_hutang',{[isR?'piutang_id':'hutang_id']:id,nominal:n,keterangan:String(f.get('keterangan')||'')})});}

  function stockRows(){return byType('persediaan')}
  function renderStock(){const rows=stockRows(),value=rows.reduce((a,r)=>a+num(data(r).stok)*num(data(r).harga_modal),0),low=rows.filter(r=>num(data(r).stok)<=num(data(r).minimum)).length;$('#stockStats').innerHTML=[['Jumlah Barang',rows.length],['Nilai Persediaan',value],['Stok Menipis',low],['Unit Stok',rows.reduce((a,r)=>a+num(data(r).stok),0)]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${l==='Nilai Persediaan'?fmt(v):v}</strong></div>`).join('');$('#stockTable tbody').innerHTML=rows.map(r=>{const d=data(r);return `<tr><td>${esc(d.nama)}</td><td>${esc(d.kategori||'-')}</td><td>${esc(d.supplier||'-')}</td><td>${fmt(d.harga_modal)}</td><td>${fmt(d.harga_jual)}</td><td>${num(d.stok)} ${num(d.stok)<=num(d.minimum)?'<span class="status bad">Menipis</span>':''}</td><td>${fmt(num(d.stok)*num(d.harga_modal))}</td><td><button class="icon-btn edit-stock" data-id="${r.id}">Edit</button> <button class="icon-btn danger-text del" data-id="${r.id}">Hapus</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Belum ada barang.</td></tr>';$$('#stockTable .edit-stock').forEach(b=>b.onclick=()=>stockModal(state.rows.find(r=>r.id===b.dataset.id)));$$('#stockTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));}
  function stockModal(row){const d=data(row);formModal(row?'Edit Barang':'Tambah Barang',`<div class="form-grid cols-2"><label>Nama Barang<input name="nama" value="${esc(d.nama||'')}" required></label><label>Kategori<input name="kategori" value="${esc(d.kategori||'Makanan/Minuman')}"></label><label>Supplier<input name="supplier" value="${esc(d.supplier||'')}"></label><label>Stok<input type="number" name="stok" min="0" step="1" value="${num(d.stok)}"></label><label>Harga Modal<input type="number" name="harga_modal" min="0" value="${num(d.harga_modal)}"></label><label>Harga Jual<input type="number" name="harga_jual" min="0" value="${num(d.harga_jual)}"></label><label>Minimum Stok<input type="number" name="minimum" min="0" value="${num(d.minimum)}"></label></div>`,async f=>{await writeRow(isoToday(),'persediaan',{nama:String(f.get('nama')),kategori:String(f.get('kategori')||''),supplier:String(f.get('supplier')||''),stok:num(f.get('stok')),harga_modal:num(f.get('harga_modal')),harga_jual:num(f.get('harga_jual')),minimum:num(f.get('minimum'))},row?.record_id)});}

  function renderSuppliers(){const rows=byType('pemasok');$('#supplierTable tbody').innerHTML=rows.map(r=>{const d=data(r);return `<tr><td>${esc(d.nama)}</td><td>${esc(d.kontak||'-')}</td><td>${esc(d.alamat||'-')}</td><td>${esc(d.keterangan||'-')}</td><td><button class="icon-btn edit-supplier" data-id="${r.id}">Edit</button> <button class="icon-btn danger-text del" data-id="${r.id}">Hapus</button></td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Belum ada pemasok.</td></tr>';$$('#supplierTable .edit-supplier').forEach(b=>b.onclick=()=>supplierModal(state.rows.find(r=>r.id===b.dataset.id)));$$('#supplierTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));}
  function supplierModal(row){const d=data(row);formModal(row?'Edit Pemasok':'Tambah Pemasok',`<div class="form-grid cols-2"><label>Nama Pemasok<input name="nama" value="${esc(d.nama||'')}" required></label><label>Kontak<input name="kontak" value="${esc(d.kontak||'')}"></label><label>Alamat<input name="alamat" value="${esc(d.alamat||'')}"></label><label>Keterangan<input name="keterangan" value="${esc(d.keterangan||'')}"></label></div>`,async f=>{await writeRow(isoToday(),'pemasok',{nama:String(f.get('nama')),kontak:String(f.get('kontak')||''),alamat:String(f.get('alamat')||''),keterangan:String(f.get('keterangan')||'')},row?.record_id)});}

  function renderSavings(){const inDaily=byType('harian').reduce((a,r)=>a+num(data(r).tabungan),0),inGen=byType('setoran_tabungan').reduce((a,r)=>a+num(data(r).nominal),0),out=byType('penarikan').reduce((a,r)=>a+num(data(r).nominal),0),balance=inDaily+inGen-out;$('#savingStats').innerHTML=[['Setoran',inDaily+inGen],['Penarikan',out],['Saldo Tabungan',balance],['Transaksi',byType('setoran_tabungan').length+byType('penarikan').length+byType('harian').filter(r=>num(data(r).tabungan)>0).length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${typeof v==='number'&&l!=='Transaksi'?fmt(v):v}</strong></div>`).join('');const rows=[...byType('harian').filter(r=>num(data(r).tabungan)>0).map(r=>({tgl:r.tgl,jenis:'Setoran Harian',ket:'Tabungan laporan harian',nom:num(data(r).tabungan),id:r.id})),...byType('setoran_tabungan').map(r=>({tgl:r.tgl,jenis:'Setoran',ket:data(r).keterangan||'',nom:num(data(r).nominal),id:r.id})),...byType('penarikan').map(r=>({tgl:r.tgl,jenis:'Penarikan',ket:data(r).keterangan||'',nom:-num(data(r).nominal),id:r.id}))].sort((a,b)=>b.tgl.localeCompare(a.tgl));$('#savingTable tbody').innerHTML=rows.map(x=>`<tr><td>${x.tgl}</td><td>${x.jenis}</td><td>${esc(x.ket)}</td><td class="money">${fmt(x.nom)}</td><td>${x.jenis==='Penarikan'?`<button class="icon-btn danger-text del" data-id="${x.id}">Hapus</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Belum ada transaksi tabungan.</td></tr>';$$('#savingTable .del').forEach(b=>b.onclick=()=>deleteConfirm(b.dataset.id));}
  function withdrawModal(){const balance=byType('harian').reduce((a,r)=>a+num(data(r).tabungan),0)+byType('setoran_tabungan').reduce((a,r)=>a+num(data(r).nominal),0)-byType('penarikan').reduce((a,r)=>a+num(data(r).nominal),0);formModal('Penarikan Tabungan',`<div class="form-grid cols-2"><label>Tanggal<input type="date" name="tgl" value="${isoToday()}" required></label><label>Nominal<input type="number" name="nominal" min="0" max="${balance}" value="0" required></label><label class="full">Keterangan<textarea name="keterangan">Penarikan tabungan</textarea></label></div><div class="notice">Saldo tersedia: <b>${fmt(balance)}</b></div>`,async f=>{const t=f.get('tgl'),n=num(f.get('nominal'));if(isFriday(t))throw new Error('Jumat otomatis libur.');if(n<=0||n>balance)throw new Error('Nominal melebihi saldo tabungan.');await writeRow(t,'penarikan',{nominal:n,keterangan:String(f.get('keterangan')||'')})});}

  function reportData(kind){if(kind==='daily')return byType('harian').sort((a,b)=>b.tgl.localeCompare(a.tgl));if(kind==='cash')return cashEntries();if(kind==='profit')return monthlySummary(12);if(kind==='receivable')return receivables();if(kind==='payable')return payables();if(kind==='saving')return cashEntries().filter(x=>x.source==='saving');return []}
  function dateKey(v){ if(!v)return 0; const s=String(v).trim(); const t=Date.parse(s); if(!Number.isNaN(t))return t; const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]).getTime()} return 0; }
function sortChronological(rows,field='tgl'){return Array.isArray(rows)?[...rows].sort((a,b)=>dateKey(a?.[field])-dateKey(b?.[field])):rows;}

function renderReport(kind){
    state.report=kind;
    const el=$('#reportPreview'), rows=sortChronological(reportData(kind),'tgl');
    const reportNames={
      cash:'Buku Kas',
      profit:'Laba Rugi 12 Bulan',
      receivable:'Laporan Piutang',
      payable:'Laporan Hutang',
      saving:'Laporan Tabungan',
      daily:'Laporan Harian Kantin'
    };
    const reportName=reportNames[kind]||'Laporan Keuangan';
    const generated=new Date().toLocaleString('id-ID',{dateStyle:'long',timeStyle:'short'});
    let body='', summary='';

    if(kind==='cash'){
      const masuk=rows.reduce((s,x)=>s+num(x.in),0), keluar=rows.reduce((s,x)=>s+num(x.out),0);
      body=`<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.tgl}</td><td>${x.label}</td><td>${esc(x.note)}</td><td class="num">${fmt(x.in)}</td><td class="num">${fmt(x.out)}</td></tr>`).join('')}</tbody></table></div>`;
      summary=`<div class="print-summary"><div><span>Saldo Awal</span><b>${fmt(state.opening)}</b></div><div><span>Total Masuk</span><b>${fmt(masuk)}</b></div><div><span>Total Keluar</span><b>${fmt(keluar)}</b></div><div><span>Saldo Akhir</span><b>${fmt(state.opening+masuk-keluar)}</b></div></div>`;
    }else if(kind==='profit'){
      const sales=rows.reduce((s,x)=>s+num(x.sales),0), other=rows.reduce((s,x)=>s+num(x.otherIn),0), expense=rows.reduce((s,x)=>s+num(x.expense),0), profit=sales+other-expense;
      body=`<div class="table-wrap"><table><thead><tr><th>Bulan</th><th>Penjualan</th><th>Pend. Lain</th><th>Beban</th><th>Laba</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${monthName(x.key)}</td><td class="num">${fmt(x.sales)}</td><td class="num">${fmt(x.otherIn)}</td><td class="num">${fmt(x.expense)}</td><td class="num">${fmt(x.sales+x.otherIn-x.expense)}</td></tr>`).join('')}</tbody></table></div>`;
      summary=`<div class="print-summary"><div><span>Total Penjualan</span><b>${fmt(sales)}</b></div><div><span>Pendapatan Lain</span><b>${fmt(other)}</b></div><div><span>Total Beban</span><b>${fmt(expense)}</b></div><div><span>Laba Bersih</span><b>${fmt(profit)}</b></div></div>`;
    }else if(kind==='daily'){
      const allDates=generateFullDailyRange();
      const opsRows=allDates.filter(x=>x.status==='OPERASIONAL');
      const liburRows=allDates.filter(x=>x.status==='LIBUR');
      const totalPemasukan=opsRows.reduce((s,x)=>s+num(x.pend1)+num(x.pend2),0);
      const totalPengeluaran=opsRows.reduce((s,x)=>s+num(x.titip1)+num(x.titip2)+num(x.titip3),0);
      const totalTabungan=opsRows.reduce((s,x)=>s+num(x.tabungan),0);
      const totalNet=opsRows.reduce((s,x)=>s+totalDaily(x),0);
      body=`<div class="table-wrap"><table class="daily-full-table"><thead><tr><th>Tanggal</th><th>Hari</th><th>Status</th><th class="num">Pemasukan</th><th class="num">Pengeluaran</th><th class="num">Tabungan</th><th class="num">Total</th></tr></thead><tbody>${allDates.map(x=>{const isLibur=x.status==='LIBUR';const pend=num(x.pend1)+num(x.pend2);const titip=num(x.titip1)+num(x.titip2)+num(x.titip3);return`<tr class="${isLibur?'row-libur':''}"><td>${x.tgl}</td><td>${getDayName(x.tgl)}</td><td><span class="print-status-badge ${isLibur?'libur':'ops'}">${x.status}</span></td><td class="num">${fmt(isLibur?0:pend)}</td><td class="num">${fmt(isLibur?0:titip)}</td><td class="num">${fmt(isLibur?0:num(x.tabungan))}</td><td class="num">${fmt(isLibur?0:totalDaily(x))}</td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">Belum ada data.</td></tr>'}</tbody></table></div>`;
      summary=`<div class="print-summary wide"><div><span>Hari Operasional</span><b>${opsRows.length}</b></div><div><span>Hari Libur</span><b>${liburRows.length}</b></div><div><span>Total Pemasukan</span><b>${fmt(totalPemasukan)}</b></div><div><span>Total Pengeluaran</span><b>${fmt(totalPengeluaran)}</b></div><div><span>Total Tabungan</span><b>${fmt(totalTabungan)}</b></div><div><span>Total Bersih</span><b>${fmt(totalNet)}</b></div></div>`;
    }else if(kind==='receivable'||kind==='payable'){
      const r=rows, nominal=r.reduce((s,x)=>s+num(x.d.nominal),0), paid=r.reduce((s,x)=>s+num(x.paid),0), balance=r.reduce((s,x)=>s+num(x.balance),0);
      body=`<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Nominal</th><th>Terbayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.tgl}</td><td>${esc(x.d[kind==='receivable'?'pelanggan':'supplier'])}</td><td class="num">${fmt(x.d.nominal)}</td><td class="num">${fmt(x.paid)}</td><td class="num">${fmt(x.balance)}</td><td>${x.status}</td></tr>`).join('')}</tbody></table></div>`;
      summary=`<div class="print-summary compact"><div><span>Total Nominal</span><b>${fmt(nominal)}</b></div><div><span>Total Terbayar</span><b>${fmt(paid)}</b></div><div><span>Total Sisa</span><b>${fmt(balance)}</b></div></div>`;
    }else{
      const masuk=rows.reduce((s,x)=>s+num(x.in),0), keluar=rows.reduce((s,x)=>s+num(x.out),0);
      body=`<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.tgl}</td><td>${x.label}</td><td>${esc(x.note)}</td><td class="num">${fmt(x.in||x.out)}</td></tr>`).join('')}</tbody></table></div>`;
      summary=`<div class="print-summary compact"><div><span>Total Setoran</span><b>${fmt(masuk)}</b></div><div><span>Total Penarikan</span><b>${fmt(keluar)}</b></div><div><span>Selisih</span><b>${fmt(masuk-keluar)}</b></div></div>`;
    }

    el.innerHTML=`<div class="print-sheet ${kind==='daily'?'print-wide':''}">
      <header class="print-header">
        <div class="print-brand-mark">KU</div>
        <div><div class="print-kicker">KANTIN UIMSYA PUTRI</div><h3>${reportName}</h3><p>Keuangan &amp; Operasional</p></div>
        <div class="print-meta"><span>Dicetak</span><b>${generated}</b></div>
      </header>
      <div class="print-rule"></div>
      ${summary}
      ${body}
      <footer class="print-footer"><span>Dokumen laporan internal • Kantin Uimsya Putri</span><span>Dicetak dari Sistem Keuangan</span></footer>
    </div>`;
  }
  function exportCSVRows(rows,name){if(!rows.length)return toast('Tidak ada data untuk diekspor.',true);const flat=rows.map(r=>r.d?({tanggal:r.tgl,...r.d}):r);const heads=[...new Set(flat.flatMap(x=>Object.keys(x)))];const csv='\ufeff'+[heads.join(','),...flat.map(x=>heads.map(h=>`"${String(x[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`${name}-${isoToday()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200)}

  function openPassword(){formModal('Ganti Password',`<div class="form-grid cols-1"><label>Password Baru<input type="password" name="p1" minlength="8" required></label><label>Konfirmasi Password<input type="password" name="p2" minlength="8" required></label></div>`,async f=>{const a=f.get('p1'),b=f.get('p2');if(a.length<8||a!==b)throw new Error('Password minimal 8 karakter dan harus sama.');const {error}=await db.auth.updateUser({password:a});if(error)throw error;toast('Password berhasil diubah.');});}
  function deleteConfirm(id){if(!confirm('Hapus data ini? Tindakan tidak dapat dibatalkan.'))return;deleteById(id).then(()=>refresh()).then(()=>toast('Data dihapus.')).catch(e=>toast(e.message,true));}
  async function resetAll(){if(!confirm('PERINGATAN: ini akan menghapus seluruh data keuangan. Lanjutkan?'))return;const {error}=await db.from('kantin_data').delete().neq('record_id','__never__');if(error)throw error;await refresh();toast('Semua data dihapus.');}
  function printCurrent(){window.print();}
  async function refresh(){await loadRows();renderHome();renderDashboard();renderTransactions();renderCash();renderDaily();renderReceivables();renderPayables();renderStock();renderSuppliers();renderSavings();if(state.report)renderReport(state.report);}

  function bind(){
    $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.tab)));
    $$('[data-open]').forEach(b=>b.addEventListener('click',()=>{const x=b.dataset.open;if(x==='cash-in')openTransaction('pemasukan');if(x==='cash-out')openTransaction('pengeluaran');if(x==='withdraw')withdrawModal()}));
    $('#openTransaction').onclick=()=>openTransaction();$('#addPiutang').onclick=()=>debtModal('piutang');$('#addHutang').onclick=()=>debtModal('hutang');$('#addStock').onclick=()=>stockModal();$('#addSupplier').onclick=()=>supplierModal();$('#addWithdraw').onclick=withdrawModal;
    $('#saveDaily').onclick=()=>saveDaily().catch(e=>toast(e.message,true));$('#dailyDate').value=isoToday();$('#dailyDate').onchange=()=>loadDailyForm($('#dailyDate').value);['pend1','pend2','titip1','titip2','titip3','dailySaving'].forEach(id=>$('#'+id).addEventListener('input',()=>$('#dailyTotal').textContent=fmt(totalDaily({pend1:num($('#pend1').value),pend2:num($('#pend2').value),titip1:num($('#titip1').value),titip2:num($('#titip2').value),titip3:num($('#titip3').value),tabungan:num($('#dailySaving').value)}))));
    ['trxSearch','trxType','trxFrom','trxTo'].forEach(id=>$('#'+id).addEventListener('input',renderTransactions));$('#resetTrx').onclick=()=>{['trxSearch','trxFrom','trxTo'].forEach(id=>$('#'+id).value='');$('#trxType').value='';renderTransactions()};
    $('#refreshBtn').onclick=()=>refresh().then(()=>toast('Data diperbarui.')).catch(e=>toast(e.message,true));$('#logoutBtn').onclick=async()=>{await db.auth.signOut();location.replace('index.html')};$('#saveOpening').onclick=()=>{state.opening=num($('#openingBalance').value);localStorage.setItem('kantin_opening_balance',String(state.opening));renderCash();toast('Saldo awal disimpan.');};$('#changePassword').onclick=openPassword;$('#printReport').onclick=printCurrent;$('#dangerReset').onclick=()=>resetAll().catch(e=>toast(e.message,true));
    $$('#dashPeriods button').forEach(b=>b.onclick=()=>{$$('#dashPeriods button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.months=num(b.dataset.months)||1;renderDashboard()});$('#exportDash').onclick=()=>exportCSVRows(monthlySummary(state.months),'rekap-bulanan');$('#exportDaily').onclick=()=>exportCSVRows(byType('harian'),'laporan-harian');
    $$('.report-card').forEach(b=>b.onclick=()=>renderReport(b.dataset.report));
    $('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
    // Holiday buttons
    const shBtn=$('#setHolidayBtn');
    if(shBtn)shBtn.onclick=()=>holidayModal($('#dailyDate').value||isoToday());
    const ushBtn=$('#unsetHolidayBtn');
    if(ushBtn)ushBtn.onclick=async()=>{
      const date=$('#dailyDate').value||isoToday();
      if(!isExplicitHoliday(date))return toast('Tanggal ini tidak memiliki status libur eksplisit.',true);
      if(!confirm(`Ubah status ${date} (${getDayName(date)}) dari LIBUR ke OPERASIONAL?\nFormulir akan dibuka untuk pengisian data.`))return;
      const lr=byLibur().find(x=>x.tgl===date);
      if(lr)await deleteById(lr.id);
      await refresh();toast('Status LIBUR dihapus. Silakan input data operasional.');
    };
    // Libur Jumat toggle
    const ljToggle=$('#liburJumatToggle');
    if(ljToggle){
      ljToggle.checked=getLiburJumat();
      ljToggle.onchange=()=>{
        localStorage.setItem('kantin_libur_jumat',ljToggle.checked?'true':'false');
        renderDaily();if(state.report)renderReport(state.report);
        toast('Pengaturan Libur Jumat '+(ljToggle.checked?'diaktifkan ✓':'dinonaktifkan')+'.');
      };
    }
  }
  async function init(){if(!(await requireSession()))return;$('#userLabel').textContent=state.session.user.email?.split('@')[0]||'Pengguna';$('#settingsUser').textContent=state.session.user.email||'—';bind();await refresh();loadDailyForm(isoToday());}
  window.addEventListener('load',()=>init().catch(e=>{console.error(e);toast(e.message||'Gagal memuat aplikasi.',true)}));
  window.kantinNav=nav;
})();
