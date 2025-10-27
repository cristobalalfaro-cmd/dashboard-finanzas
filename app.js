// ======================= app.js =======================
const AUTH_HASH = '488c013cb6bf0d8e7dae92e89d72a058ed3181a7c8bed1bceb456b2176bb1746'; // "Tomi.2016"
const STORAGE_KEY = 'dash_auth_v1';
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyth4jXe6dTjOnE6Zyfy8TlUEwVqIVZrp2tYrr2xR4e9N46yGnVpTwhE9w4NVPYl6Zv/exec';

let rows = [];
let chartPiePagadoSaldo, chartPieEstados;
const fmt = new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});

// ======= Auth simple =======
async function sha256hex(str){
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function authOk(){
  const v = localStorage.getItem(STORAGE_KEY);
  if(!v) return false;
  try{
    const saved = JSON.parse(v);
    if(Date.now()>saved.exp) return false;
    return saved.hash===AUTH_HASH;
  }catch{return false;}
}
async function tryAuth(){
  const pass=document.getElementById('authPass').value||'';
  const h=await sha256hex(pass);
  if(h===AUTH_HASH){
    localStorage.setItem(STORAGE_KEY,JSON.stringify({hash:h,exp:Date.now()+86400000}));
    document.getElementById('auth').style.display='none';
    document.getElementById('app').style.display='';
    initApp();
  }else document.getElementById('authMsg').textContent='Clave incorrecta';
}
document.getElementById('authBtn').addEventListener('click',tryAuth);
document.getElementById('authPass').addEventListener('keydown',e=>{if(e.key==='Enter')tryAuth();});
if(authOk()){document.getElementById('auth').style.display='none';document.getElementById('app').style.display='';initApp();}

// ======= Init =======
function initApp(){
  document.getElementById('f').addEventListener('submit',onSubmit);
  document.getElementById('btnReset').addEventListener('click',()=>document.getElementById('f').reset());
  reload();
}

async function reload(){
  try{
    const res=await fetch(ENDPOINT);
    const json=await res.json();
    rows=json.rows||[];
  }catch{rows=[];}
  renderResumen();
}

// ======= Helpers =======
function toNumberSafe(v){return Number(String(v||0).replace(/\./g,'').replace(',','.'))||0;}
function cobrar(monto,porc){return Math.max(0,toNumberSafe(monto)*toNumberSafe(porc)/100);}

// ======= KPIs =======
function renderResumen(){
  let total=0,pagado=0;
  for(const r of rows){
    total+=toNumberSafe(r.monto);
    pagado+=cobrar(r.monto,r.porc_cobrado);
  }
  const saldo=Math.max(0,total-pagado);
  document.getElementById('kpiVentas').textContent=fmt.format(total);
  document.getElementById('kpiCobrado').textContent=fmt.format(pagado);
  document.getElementById('kpiSaldo').textContent=fmt.format(saldo);
  renderMiniCharts({total,pagado,saldo});
}

// ======= Mini-gráficos =======
function renderMiniCharts({total,pagado,saldo}){
  // 1. Pagado vs Saldo
  const ctx1=document.getElementById('piePagadoSaldo');
  if(ctx1){
    const data1=[pagado,saldo];
    if(chartPiePagadoSaldo)chartPiePagadoSaldo.destroy();
    chartPiePagadoSaldo=new Chart(ctx1,{
      type:'pie',
      data:{labels:['Pagado','Saldo'],datasets:[{data:data1,backgroundColor:['#2ecc71','#e74c3c']}]},
      options:{plugins:{legend:{position:'bottom'}}}
    });
  }

  // 2. Estados
  const ctx2=document.getElementById('pieEstados');
  if(ctx2){
    const counts={};
    for(const r of rows){
      const e=r.estado||'En curso';
      counts[e]=(counts[e]||0)+1;
    }
    const labels=Object.keys(counts);
    const data2=labels.map(k=>counts[k]);
    if(chartPieEstados)chartPieEstados.destroy();
    chartPieEstados=new Chart(ctx2,{
      type:'pie',
      data:{labels,datasets:[{data:data2,backgroundColor:['#3498db','#9b59b6','#f1c40f','#e67e22','#1abc9c','#95a5a6']}]},
      options:{plugins:{legend:{position:'bottom'}}}
    });
  }
}

// ======= Guardar proyecto =======
async function onSubmit(e){
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.target).entries());
  data.monto=toNumberSafe(data.monto);
  try{
    await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(data)});
    alert('✅ Proyecto guardado');
    e.target.reset();
    reload();
  }catch{alert('Error guardando');}
}
