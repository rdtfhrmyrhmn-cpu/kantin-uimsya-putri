(function(){
  const moods=[
    '“Pencatatan yang rapi membuat keputusan kecil jadi lebih mudah.”',
    '“Amanah dimulai dari hal-hal yang dicatat dengan jujur.”',
    '“Sedikit demi sedikit, keteraturan akan menjadi kebiasaan.”',
    '“Hari ini dicatat dengan baik, besok lebih mudah dievaluasi.”',
    '“Rezeki dijaga dengan syukur, amanah, dan pengelolaan yang rapi.”'
  ];
  function greet(){
    const h=new Date().getHours();
    if(h<11)return 'Selamat pagi 👋'; if(h<15)return 'Selamat siang 👋'; if(h<18)return 'Selamat sore 👋'; return 'Selamat malam 👋';
  }
  function tick(){
    const now=new Date();
    const time=now.toLocaleTimeString('id-ID',{hour12:false});
    const date=now.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const a=document.getElementById('heroTime'),b=document.getElementById('clockMini'); if(a)a.textContent=time; if(b)b.textContent=time;
    const g=document.getElementById('greetingTitle'); if(g)g.textContent=greet();
    const t=document.getElementById('greetingText'); if(t)t.textContent=`Hari ini ${date}. Semoga aktivitas kantin berjalan lancar.`;
    const status=document.getElementById('dailyStatus'); if(status){status.textContent=now.getDay()===5?'Jumat • Libur otomatis':'Kantin buka • Hari operasional';}
    const note=document.getElementById('fridayNote'); if(note)note.textContent=now.getDay()===5?'Jumat otomatis libur':'Hari operasional';
  }
  window.homeInit=function(){
    const m=document.getElementById('motivationText'); if(m)m.textContent=moods[new Date().getDate()%moods.length];
    tick(); setInterval(tick,1000);
  };
})();
