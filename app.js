// ================== app.js (completo) ==================
// Autenticación, CRUD de proyectos, rendición de gastos, KPIs y gráficos
// -------------------------------------------------------

// ======= Auth (misma clave que el dashboard anterior) =======
const STORAGE_KEY = 'dashproj_auth_v1';
const AUTH_HASH   = '488c013cb6bf0d8e7dae92e89d72a058ed3181a7c8bed1bceb456b2176bb1746'; // SHA-256 de "Tomi.2016"

// ======= Backend =======
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwzIu3thgpFk5QmHVD6wR7x9gurX4_AdEg_SesunvoPkHG-A9Kd3vJqzICr0FyT0Xk3/exec';

// Reglas por defecto (se guardan en localStorage y deben sumar 100%)
const DEFAULT_RULES = {
  Vendedor: 0.15,
  Director: 0.18,
  Consultor: 0.50,
  Gasto: 0.03,
  Administracion: 0.04,
  FeeConsultora: 0.10
};
let RULES = loadRules();

const fmt = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0
});

// ======= Estado =======
let rows = [];    // proyectos
let gastos = [];  // rendiciones
let chartRoles, chartPersonas;

// ======= Utils =======
function toNumberSafe(v){ return Number(String(v ?? 0).replace(/\./g,'').replace(',', '.')) || 0; }
function cobrar(monto, porc){ return Math.max(0, toNumberSafe(monto) * toNumberSafe(porc) / 100); }
function distribucion(montoPagado){ return Object.fromEntries(Object.entries(RULES).map(([k,v])=>[k, montoPagado * v])); }
function normalizeName(x){ return (x||'').toString().trim().replace(/\s+/g,' '); }
function formatDateDMY(d){
  if(!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yy = dt.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function fillForm(data){
  const f = document.getElementById('f');
  Object.entries(data).forEach(([k,v])=>{ if (f[k]!==undefined) f[k].value = v; });
  if (data.porc_cobrado !== undefined) document.getElementById('porc_pagado').value = data.porc_cobrado || '';
  if (data.fecha_estimada_pago) document.getElementById('fecha_estimada_pago').value = data.fecha_estimada_pago;
  if (data.fecha_pago) document.getElementById('fecha_pago').value = data.fecha_pago;
  togglePagoFields();
}
function clearForm(){ document.getElementById('f').reset(); togglePagoFields(); }

function loadRules(){
  try {
    const raw = localStorage.getItem('rules_finanzas');
    if (!raw) return {...DEFAULT_RULES};
    const obj = JSON.parse(raw);
    const sum = Object.values(obj).reduce((a,b)=>a+Number(b||0),0);
    if (Math.abs(sum - 1) > 0.0001) return {...DEFAULT_RULES};
    return obj;
  } catch { return {...DEFAULT_RULES}; }
}
function saveRules(){
  localStorage.setItem('rules_finanzas', JSON.stringify(RULES));
  renderResumen();
  renderRolesAndPersonas();
  renderCharts();
}

// ======= Auth helpers =======
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
    if(Date.now() > saved.exp) return false;
    return saved.hash === AUTH_HASH;
  }catch{ return false; }
}
async function tryAuth(){
  const pass = document.getElementById('authPass').value || '';
  const h = await sha256hex(pass);
  if(h === AUTH_HASH){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({hash:h, exp: Date.now()+24*60*60*1000}));
    document.getElementById('auth').style.display='none';
    document.getElementById('app').style.display='';
    initApp();
  }else{
    document.getElementById('authMsg').textContent = 'Clave incorrecta';
  }
}

// ======= App Init =======
document.getElementById('authBtn').addEventListener('click', tryAuth);
document.getElementById('authPass').addEventListener('keydown', (e)=>{ if(e.key==='Enter') tryAuth(); });

if (authOk()){
  document.getElementById('auth').style.display='none';
  document.getElementById('app').style.display='';
  initApp();
}

function initApp(){
  // Form proyectos
  document.getElementById('f').addEventListener('submit', onSubmitProyecto);
  document.getElementById('btnReset').addEventListener('click', clearForm);
  document.getElementById('q').addEventListener('input', renderTable);
  document.getElementById('fEstado').addEventListener('change', renderTable);

  // Estado → campos condicionales
  document.getElementById('estado').addEventListener('change', togglePagoFields);
  document.getElementById('porc_pagado').addEventListener('input', syncMontoPagadoFromPorc);
  document.getElementById('monto_pagado').addEventListener('input', syncPorcFromMontoPagado);

  // Reglas editables
  renderRulesForm();
  document.getElementById('saveRules').addEventListener('click', onSaveRules);
  document.getElementById('resetRules').addEventListener('click', ()=>{
    RULES = {...DEFAULT_RULES};
    renderRulesForm(true);
    saveRules();
  });

  // Rendición gastos
  document.getElementById('fgasto').addEventListener('submit', onSubmitGasto);
  document.getElementById('g_reset').addEventListener('click', ()=>{
    document.getElementById('fgasto').reset();
    updateDisponible();
  });
  document.getElementById('g_cliente').addEventListener('change', onClienteGastoChange);
  document.getElementById('g_proyecto').addEventListener('change', updateDisponible);

  // Carga inicial
  reload();
}

async function reload(){
  // Proyectos
  try{
    const res = await fetch(ENDPOINT);
    if(!res.ok) throw new Error(`GET ${res.status}`);
    const json = await res.json();
    rows = json.rows || [];
  }catch(err){
    console.error('Error cargando proyectos:', err);
    rows = [];
  }
  // Gastos
  try{
    const res2 = await fetch(`${ENDPOINT}?gastos=1`);
    if(!res2.ok) throw new Error(`GET gastos ${res2.status}`);
    const j2 = await res2.json();
    gastos = j2.gastos || [];
  }catch(err){
    console.error('Error cargando gastos:', err);
    gastos = [];
  }

  renderTable();
  renderResumen();
  renderRolesAndPersonas();
  renderCharts();
  hydrateGastosSelectors();
  updateDisponible();
}

// ======= Estado → campos condicionales =======
function togglePagoFields(){
  const estado = (document.getElementById('estado').value||'').toLowerCase();
  const pagoFields = document.getElementById('pagoFields');
  const grpPorc = document.getElementById('grpPorcPagado');
  const grpMonto = document.getElementById('grpMontoPagado');
  const grpFechaEstimada = document.getElementById('grpFechaEstimada');
  const grpFechaPago = document.getElementById('grpFechaPago');

  pagoFields.style.display = 'none';
  grpPorc.style.display = 'none';
  grpMonto.style.display = 'none';
  grpFechaEstimada.style.display = 'none';
  grpFechaPago.style.display = 'none';

  if (estado === 'pagado parcial'){
    pagoFields.style.display = '';
    grpPorc.style.display = '';
    grpMonto.style.display = '';
    grpFechaEstimada.style.display = '';
  } else if (estado === 'pagado'){
    pagoFields.style.display = '';
    grpPorc.style.display = '';
    grpMonto.style.display = '';
    grpFechaPago.style.display = '';

    const monto = toNumberSafe(document.querySelector('input[name="monto"]').value);
    document.getElementById('porc_pagado').value = 100;
    document.getElementById('monto_pagado').value = monto ? Math.round(monto) : '';
  } else {
    grpFechaEstimada.style.display = '';
  }
}

function syncMontoPagadoFromPorc(){
  const porc = toNumberSafe(document.getElementById('porc_pagado').value);
  const monto = toNumberSafe(document.querySelector('input[name="monto"]').value);
  if (!monto) return;
  const pagado = Math.round(monto * (Math.min(100,Math.max(0,porc))/100));
  document.getElementById('monto_pagado').value = pagado || '';
}
function syncPorcFromMontoPagado(){
  const pagado = toNumberSafe(document.getElementById('monto_pagado').value);
  const monto = toNumberSafe(document.querySelector('input[name="monto"]').value);
  if (!monto) return;
  const porc = Math.round((pagado / monto) * 100);
  document.getElementById('porc_pagado').value = isFinite(porc) ? Math.min(100, Math.max(0, porc)) : '';
}

// ======= Reglas editables =======
function renderRulesForm(resetInputs=false){
  document.getElementById('rule_vendedor').value = (RULES.Vendedor*100).toFixed(1);
  document.getElementById('rule_director').value = (RULES.Director*100).toFixed(1);
  document.getElementById('rule_consultor').value = (RULES.Consultor*100).toFixed(1);
  document.getElementById('rule_gasto').value = (RULES.Gasto*100).toFixed(1);
  document.getElementById('rule_admin').value = (RULES.Administracion*100).toFixed(1);
  document.getElementById('rule_fee').value = (RULES.FeeConsultora*100).toFixed(1);
  updateRulesTotalBadge();
  if (!resetInputs){
    ['rule_vendedor','rule_director','rule_consultor','rule_gasto','rule_admin','rule_fee'].forEach(id=>{
      document.getElementById(id).addEventListener('input', updateRulesTotalBadge);
    });
  }
}
function updateRulesTotalBadge(){
  const vals = [
    toNumberSafe(document.getElementById('rule_vendedor').value),
    toNumberSafe(document.getElementById('rule_director').value),
    toNumberSafe(document.getElementById('rule_consultor').value),
    toNumberSafe(document.getElementById('rule_gasto').value),
    toNumberSafe(document.getElementById('rule_admin').value),
    toNumberSafe(document.getElementById('rule_fee').value),
  ];
  const total = vals.reduce((a,b)=>a+b,0);
  const badge = document.getElementById('rulesTotal');
  badge.textContent = `Total: ${total.toFixed(1)}%`;
  badge.classList.toggle('badge--ok', Math.abs(total-100)<0.01);
  badge.classList.toggle('badge--error', Math.abs(total-100)>=0.01);
}
function onSaveRules(){
  const pctToFrac = v => toNumberSafe(v)/100;
  const next = {
    Vendedor: pctToFrac(document.getElementById('rule_vendedor').value),
    Director: pctToFrac(document.getElementById('rule_director').value),
    Consultor: pctToFrac(document.getElementById('rule_consultor').value),
    Gasto: pctToFrac(document.getElementById('rule_gasto').value),
    Administracion: pctToFrac(document.getElementById('rule_admin').value),
    FeeConsultora: pctToFrac(document.getElementById('rule_fee').value),
  };
  const sum = Object.values(next).reduce((a,b)=>a+b,0);
  if (Math.abs(sum-1) > 0.0001){
    alert('Las reglas deben sumar exactamente 100%.');
    return;
  }
  RULES = next;
  saveRules();
  alert('✅ Reglas guardadas');
}

// ======= Tabla Proyectos =======
function renderTable(){
  const q = (document.getElementById('q').value||'').toLowerCase();
  const filtro = (document.getElementById('fEstado')?.value||'');
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = '';

  const estadoDisplay = (e, porc) => {
    const est = (e||'').toLowerCase();
    if (est === 'pagado') return 'Pagado';
    if (est === 'pagado parcial') return 'Pagado parcial';
    if (Number(porc) >= 100) return 'Pagado';
    if (Number(porc) > 0 && Number(porc) < 100 && est !== 'cancelado') return 'Pagado parcial';
    return e || 'En curso';
  };
  const estadoClass = (label) => {
    const map = {
      'Prospecto':'gray','Propuesta':'gray','Aprobado':'blue','En curso':'blue',
      'Pausado':'yellow','Finalizado':'green','Cancelado':'red','Facturado':'purple',
      'Pagado parcial':'orange','Pagado':'green-strong'
    };
    return `badge badge--${map[label]||'gray'}`;
  };

  const data = rows.filter(r => {
    const textOk = `${r.cliente} ${r.proyecto}`.toLowerCase().includes(q);
    const label = estadoDisplay(r.estado, r.porc_cobrado);
    const estadoOk = !filtro || filtro === label;
    return textOk && estadoOk;
  });

  for(const r of data){
    const pagado = cobrar(r.monto, r.porc_cobrado);
    const label = estadoDisplay(r.estado, r.porc_cobrado);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateDMY(r.fecha)}</td>
      <td>${r.cliente||''}</td>
      <td>${r.proyecto||''}</td>
      <td class="r">${fmt.format(toNumberSafe(r.monto))}</td>
      <td class="r">${toNumberSafe(r.porc_cobrado)}%</td>
      <td class="r">${fmt.format(pagado)}</td>
      <td>${r.vendedor||''}</td>
      <td>${r.director||''}</td>
      <td>${r.consultor||''}</td>
      <td>${r.administracion||''}</td>
      <td>${r.gasto||''}</td>
      <td>${r.fee_consultora||''}</td>
      <td><span class="${estadoClass(label)}">${label}</span></td>
      <td><button data-id="${r.id}">✏️</button></td>`;
    tr.querySelector('button').addEventListener('click', ()=>{
      fillForm(r);
      window.scrollTo({top:0, behavior:'smooth'});
    });
    tbody.appendChild(tr);
  }
}

// ======= KPIs / Resumen =======
function renderResumen(){
  let total = 0, pagado = 0;
  for(const r of rows){
    total += toNumberSafe(r.monto||0);
    pagado += cobrar(r.monto, r.porc_cobrado);
  }
  const saldo = Math.max(0, total - pagado);
  const dist = distribucion(pagado);

  document.getElementById('kpiVentas').textContent = fmt.format(total);
  document.getElementById('kpiCobrado').textContent = fmt.format(pagado);
  document.getElementById('kpiSaldo').textContent = fmt.format(saldo);

  const cont = document.getElementById('resumen');
  cont.innerHTML = `<p><strong>Total pagado:</strong> ${fmt.format(pagado)}</p>`+
    `<ul>`+
    Object.entries(dist).map(([k,v])=>`<li>${k}: <strong>${fmt.format(v)}</strong></li>`).join('')+
    `</ul>`;
}

// ======= Agregados por rol/persona =======
function computeAggregates(){
  const rolesTotals = { Vendedor:0, Director:0, Consultor:0, Gasto:0, Administracion:0, FeeConsultora:0 };
  const personasMap = new Map();

  const ROLE_FIELDS = {
    Vendedor: 'vendedor',
    Director: 'director',
    Consultor: 'consultor',
    Administracion: 'administracion',
    Gasto: 'gasto',
    FeeConsultora: 'fee_consultora'
  };

  for(const r of rows){
    const pagado = cobrar(r.monto, r.porc_cobrado);
    for(const [rol, pct] of Object.entries(RULES)){
      const m = pagado * pct;
      rolesTotals[rol] += m;
      const field = ROLE_FIELDS[rol];
      const nombre = normalizeName(r[field]);
      if (nombre){
        const key = `${rol}|${nombre}`.toLowerCase();
        if (!personasMap.has(key)){
          personasMap.set(key, { persona: nombre, rol, monto: 0, count: 0 });
        }
        const rec = personasMap.get(key);
        rec.monto += m;
        rec.count += 1;
      }
    }
  }
  return { rolesTotals, personas: Array.from(personasMap.values()) };
}

function renderRolesAndPersonas(){
  const { rolesTotals, personas } = computeAggregates();

  // Roles
  const tbRoles = document.querySelector('#tblRoles tbody');
  tbRoles.innerHTML = '';
  let totalRoles = 0;
  for(const rol of ['Vendedor','Director','Consultor','Gasto','Administracion','FeeConsultora']){
    const v = rolesTotals[rol] || 0;
    totalRoles += v;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${rol}</td><td class="r">${fmt.format(v)}</td>`;
    tbRoles.appendChild(tr);
  }
  document.getElementById('ttlRoles').textContent = fmt.format(totalRoles);

  // Personas
  const tbPers = document.querySelector('#tblPersonas tbody');
  tbPers.innerHTML = '';
  let totalPers = 0;
  personas.sort((a,b)=> b.monto - a.monto);
  for(const p of personas){
    totalPers += p.monto;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.persona}</td>
      <td>${p.rol}</td>
      <td class="r">${fmt.format(p.monto)}</td>
      <td class="r">${p.count}</td>`;
    tbPers.appendChild(tr);
  }
  document.getElementById('ttlPersonas').textContent = fmt.format(totalPers);
}

// ======= Gráficos (Chart.js) =======
function renderCharts(){
  const { rolesTotals, personas } = computeAggregates();

  // Pie por rol
  const rolesLabels = ['Vendedor','Director','Consultor','Gasto','Administracion','FeeConsultora'];
  const rolesData = rolesLabels.map(l=>rolesTotals[l]||0);
  if(chartRoles) chartRoles.destroy();
  chartRoles = new Chart(document.getElementById('chartRoles'), {
    type:'pie',
    data:{ labels: rolesLabels, datasets:[{ data: rolesData }] },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  // Pie por persona (limita y agrupa "Otros")
  const list = [...personas].sort((a,b)=>b.monto-a.monto);
  const total = list.reduce((s,x)=>s+x.monto,0) || 1;
  const labels=[], data=[];
  let otros=0;
  for(const p of list){
    const pct = p.monto/total;
    if (labels.length<12 && pct>=0.03){
      labels.push(`${p.persona} (${p.rol})`);
      data.push(p.monto);
    } else otros += p.monto;
  }
  if (otros>0){ labels.push('Otros'); data.push(otros); }

  if(chartPersonas) chartPersonas.destroy();
  chartPersonas = new Chart(document.getElementById('chartPersonas'), {
    type:'pie',
    data:{ labels, datasets:[{ data }] },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });
}

// ======= Selectores de gastos / disponible =======
function hydrateGastosSelectors(){
  const cSel = document.getElementById('g_cliente');
  const pSel = document.getElementById('g_proyecto');
  cSel.innerHTML = ''; pSel.innerHTML = '';

  const clientes = Array.from(new Set(rows.map(r=>r.cliente).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  cSel.insertAdjacentHTML('beforeend','<option value="" disabled selected>Selecciona cliente</option>');
  clientes.forEach(c=> cSel.insertAdjacentHTML('beforeend', `<option>${c}</option>`));

  pSel.insertAdjacentHTML('beforeend','<option value="" disabled selected>Selecciona proyecto</option>');
}

function onClienteGastoChange(){
  const cliente = document.getElementById('g_cliente').value;
  const pSel = document.getElementById('g_proyecto');
  pSel.innerHTML = '<option value="" disabled selected>Selecciona proyecto</option>';
  rows.filter(r=>r.cliente===cliente).forEach(r=>{
    pSel.insertAdjacentHTML('beforeend', `<option>${r.proyecto}</option>`);
  });
  updateDisponible();
}

function calcDisponible(cliente, proyecto){
  const pr = rows.find(r=>r.cliente===cliente && r.proyecto===proyecto);
  if(!pr) return {disponible:0, gastado:0, base:0};
  const pagado = cobrar(pr.monto, pr.porc_cobrado);
  const baseGasto = pagado * (RULES.Gasto || 0);
  const gastado = gastos
      .filter(g=>g.cliente===cliente && g.proyecto===proyecto)
      .reduce((s,g)=>s+toNumberSafe(g.monto),0);
  return { disponible: Math.max(0, baseGasto - gastado), gastado, base: baseGasto };
}

function updateDisponible(){
  const cliente = document.getElementById('g_cliente').value;
  const proyecto = document.getElementById('g_proyecto').value;
  const info = document.getElementById('boxDisponible');
  if(!cliente || !proyecto){ info.textContent=''; return; }
  const {disponible, gastado, base} = calcDisponible(cliente, proyecto);
  info.textContent = `Gasto disponible: ${fmt.format(disponible)}   (Gastado: ${fmt.format(gastado)} / Base: ${fmt.format(base)})`;
}

// ======= Submit Gasto =======
async function onSubmitGasto(e){
  e.preventDefault();
  const fecha = document.getElementById('g_fecha').value;
  const monto = toNumberSafe(document.getElementById('g_monto').value);
  const cliente = document.getElementById('g_cliente').value;
  const proyecto = document.getElementById('g_proyecto').value;

  if (!cliente || !proyecto){
    alert('Selecciona cliente y proyecto.');
    return;
  }
  const {disponible} = calcDisponible(cliente, proyecto);
  if (monto > disponible){
    alert('El monto del gasto excede lo disponible para este proyecto.');
    return;
  }

  try{
    await fetch(ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({ __kind:'gasto', fecha_gasto:fecha, monto, cliente, proyecto })
    });
  }catch(err){
    console.error('Error registrando gasto', err);
    alert('No se pudo registrar el gasto.');
    return;
  }

  document.getElementById('fgasto').reset();
  await reload();
  alert('✅ Gasto registrado');
}

// ======= Submit Proyecto (create/update) =======
async function onSubmitProyecto(e){
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  // Derivar % pagado desde monto_pagado cuando aplique
  const estado = (document.getElementById('estado').value||'').toLowerCase();
  const monto = toNumberSafe(document.querySelector('input[name="monto"]').value);
  const montPag = toNumberSafe(document.getElementById('monto_pagado').value);

  if (estado === 'pagado'){
    data.porc_cobrado = 100;
  } else if (estado === 'pagado parcial'){
    if (montPag && monto){
      data.porc_cobrado = Math.min(100, Math.max(0, Math.round((montPag/monto)*100)));
    }
  }

  if (data.monto!==undefined) data.monto = toNumberSafe(data.monto);
  if (data.porc_cobrado!==undefined) data.porc_cobrado = Math.min(100, Math.max(0, toNumberSafe(data.porc_cobrado)));
  if (!data.id) delete data.id;

  try{
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(data)
    });
  }catch(err){
    console.error('Error guardando proyecto:', err);
    alert('⚠️ No se pudo guardar. Revisa conexión/ENDPOINT/Deploy del Apps Script.');
    return;
  }

  clearForm();
  await reload();
  alert('✅ Cambios guardados');
}
