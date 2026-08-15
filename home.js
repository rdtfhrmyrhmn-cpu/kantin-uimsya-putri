(function(){
  'use strict';
  const greeting=document.getElementById('homeGreeting'),clock=document.getElementById('homeClock'),date=document.getElementById('homeDate');
  window.updateHomeClock=function(){const n=new Date();const h=n.getHours();const g=h<11?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam';if(greeting)greeting.textContent=g+' 👋';if(clock)clock.textContent=n.toLocaleTimeString('id-ID',{hour12:false});if(date)date.textContent=n.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});};
  updateHomeClock();setInterval(updateHomeClock,1000);
})();
