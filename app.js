// ======= Config =======
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyth4jXe6dTjOnE6Zyfy8TlUEwVqIVZrp2tYrr2xR4e9N46yGnVpTwhE9w4NVPYl6Zv/exec';
const RULES = { Vendedor:.15, Director:.18, Consultor:.50, Gasto:.03, Administracion:.04, FeeConsultora:.10 };
const fmt = new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});

// ======= Estado =======
let rows = [];

// ======= Utiles =======
function cobrar(monto, porc){ return Math.max(0, Number(monto||0) * Number(porc||0)/100); }
function distribucion(montoCobrado){
  return Object.fromEntries(Object.entries(RULES).map(([k,v])=>[k, montoCobrado * v]));
}
function fillForm(data){
  const f = document.getElementById('f');
  Object.entries(data).forEach(([k,v])=>{ if (f[k]!==undefined) f[k].value = v; });
}
function clearForm(){ document.getElementById('f').reset(); }

// ======= Carga inicial =======
window.addEventListener('DOMContentLoaded', async ()=>{
  await reload();
  document.getElementById('f').addEventListener('submit', onSubmit);
  document.getElementById('btnReset').addEventListener('click', clearForm);
  document.getElementById('q').addEventListener('input', renderTable);
});

async function reload(){
  const res = await fetch(ENDPOINT);
  const json = await res.json();
  rows = json.rows || [];
  renderTable();
  renderResumen();
}

// ======= Tabla =======
function renderTable(){
  const q = (document.getElementById('q').value||'').toLowerCase();
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = '';

  const estadoDisplay = (e, porc) => {
    if (Number(porc) >= 100) return 'Cobrado 100%';
    if (Number(porc) > 0 && Number(porc) < 100 && (e||'').toLowerCase() !== 'cancelado') return 'Cobrado parcial';
    return e || 'En curso';
  };
  const estadoClass = (label) => {
    const map = {
      'Prospecto':'gray','Propuesta':'gray','Aprobado':'blue','En curso':'blue',
      'Pausado':'yellow','Finalizado':'green','Cancelado':'red','Facturado':'purple',
      'Cobrado parcial':'orange','Cobrado 100%':'green-strong'
    };
    return `badge badge--${map[label]||'gray'}`;
  };

  const data = rows.filter(r => `${r.cliente} ${r.proyecto}`.toLowerCase().includes(q));
  for(const r of data){
    const cobrado = cobrar(r.monto, r.porc_cobrado);
    const label = estadoDisplay(r.estado, r.porc_cobrado);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.fecha||''}</td>
      <td>${r.cliente||''}</td>
      <td>${r.proyecto||''}</td>
      <td class="r">${fmt.format(r.monto||0)}</td>
      <td class="r">${r.porc_cobrado||0}%</td>
      <td class="r">${fmt.format(cobrado)}</td>
      <td>${r.vendedor||''}</td>
      <td>${r.director||''}</td>
      <td>${r.consultor||''}</td>
      <td><span class="${estadoClass(label)}">${label}</span></td>
      <td><button data-id="${r.id}">✏️</button></td>`;
    tr.querySelector('button').addEventListener('click', ()=>{
      fillForm(r);
      window.scrollTo({top:0, behavior:'smooth'});
    });
    tbody.appendChild(tr);
  }
}

// ======= Resumen =======
function renderResumen(){
  let totalCobrado = 0;
  for(const r of rows){ totalCobrado += cobrar(r.monto, r.porc_cobrado); }
  const dist = distribucion(totalCobrado);
  const cont = document.getElementById('resumen');
  cont.innerHTML = `<p><strong>Total cobrado:</strong> ${fmt.format(totalCobrado)}</p>`+
    `<ul>`+
    Object.entries(dist).map(([k,v])=>`<li>${k}: <strong>${fmt.format(v)}</strong></li>`).join('')+
    `</ul>`;
}

// ======= Submit (create/update) =======
async function onSubmit(e){
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  if (data.monto!==undefined) data.monto = Number(data.monto);
  if (data.porc_cobrado!==undefined) data.porc_cobrado = Number(data.porc_cobrado);
  if (!data.id) delete data.id;

  await fetch(ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'}, // evita preflight en Apps Script
    body: JSON.stringify(data)
  });

  clearForm();
  await reload();
  alert('✅ Cambios guardados');
}
