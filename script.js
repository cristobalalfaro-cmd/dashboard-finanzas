(() => {
  const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const SPLIT = { vendedor:.15, director:.18, consultor:.50, gasto:.03, administracion:.04, comite:.10 };

  const fmt = (n) => isNaN(n) ? "$ —" :
    n.toLocaleString("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 });

  function parseSmartDate(str){
    if(!str) return null;
    const s = String(str).trim().toLowerCase();
    const d = new Date(s); if(!isNaN(d)) return d;
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if(m){
      const [_,dd,mm,yy]=m; const yyyy = yy.length===2 ? ("20"+yy) : yy;
      const d2 = new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`);
      if(!isNaN(d2)) return d2;
    }
    return null;
  }
  const sumBy = (rows,key)=> rows.reduce((a,r)=> a+(Number(r[key])||0),0);

  function headerIndexMap(headers){
    const norm = s=> s.toString().trim().toLowerCase();
    const want = {
      cliente:["cliente"], proyecto:["proyecto"],
      total:["total factura proyecto (bruto)","total proyecto (bruto)","total"],
      vendedor_persona:["vendedor (persona)","vendedor persona"],
      director_persona:["director pm (persona)","director pmo (persona)","director pm persona"],
      consultor_persona:["consultor (persona)","consultor persona"],
      gasto_persona:["gasto proyecto (persona)","gasto (persona)"],
      administracion_persona:["administración (persona)","administracion (persona)"],
      comite_persona:["comité (persona)","comite (persona)"],
      fecha_factura:["fecha factu","fecha factura"],
      fecha_pago:["fecha pago proyectada","fecha pago proyectad"],
      estatus:["estatus factura","estado factura"],
      rol_asignado:["rol asignado"]
    };
    const map={};
    headers.forEach((h,i)=>{ const nh=norm(h); for(const k in want){ if(want[k].some(x=>nh.includes(x))) map[k]=i; } });
    return map;
  }

  async function fetchSheet(){
    const url = (window.APP_CONFIG && window.APP_CONFIG.WEB_APP_URL) || "";
    if(!url) throw new Error("Falta configurar WEB_APP_URL en config.js");
    const resp = await fetch(url, { cache:"no-store" });
    if(!resp.ok) throw new Error(`Error Web App: ${resp.status}`);
    const data = await resp.json();
    return data.values || [];
  }

  function toRows(values){
    if(!values || !values.length) return [];
    const headers = values[0];
    const idx = headerIndexMap(headers);
    const rows = [];
    for(let r=1; r<values.length; r++){
      const row = values[r]; if(!row || !row.length) continue;
      const get = k => row[(idx[k]??-1)] ?? "";
      const totalRaw = +String(get("total")).replace(/[^\d\-.,]/g,"").replace(/\./g,"").replace(",",".") || 0;
      rows.push({
        cliente: get("cliente"),
        proyecto: get("proyecto"),
        total: totalRaw,
        vendedor: Math.round(totalRaw*SPLIT.vendedor),
        director: Math.round(totalRaw*SPLIT.director),
        consultor: Math.round(totalRaw*SPLIT.consultor),
        gasto: Math.round(totalRaw*SPLIT.gasto),
        administracion: Math.round(totalRaw*SPLIT.administracion),
        comite: Math.round(totalRaw*SPLIT.comite),
        vendedor_persona: (get("vendedor_persona")||"").toString().trim(),
        director_persona: (get("director_persona")||"").toString().trim(),
        consultor_persona: (get("consultor_persona")||"").toString().trim(),
        gasto_persona: (get("gasto_persona")||"").toString().trim(),
        administracion_persona: (get("administracion_persona")||"").toString().trim(),
        comite_persona: (get("comite_persona")||"").toString().trim(),
        fecha_factura: parseSmartDate(get("fecha_factura")),
        fecha_pago: parseSmartDate(get("fecha_pago")),
        estatus: (get("estatus")||"").toString().trim(),
        rol_asignado: (get("rol_asignado")||"").toString().trim()
      });
    }
    return rows;
  }

  const EQUIPO_HA = new Set(["owner h&a","loreto naranjo","cristóbal alfaro","cristobal alfaro"]);
  const getOwnerSet = (selected)=>{
    if(!selected) return null;
    const s = selected.toLowerCase();
    if(s.includes("equipo h")) return EQUIPO_HA;
    return new Set([s]);
  };
  function ownerAmountForRow(r, ownerSet){
    if(!ownerSet) return r.total;
    let sum = 0;
    if(ownerSet.has((r.vendedor_persona||"").toLowerCase())) sum += r.vendedor;
    if(ownerSet.has((r.director_persona||"").toLowerCase())) sum += r.director;
    if(ownerSet.has((r.consultor_persona||"").toLowerCase())) sum += r.consultor;
    if(ownerSet.has((r.gasto_persona||"").toLowerCase())) sum += r.gasto;
    if(ownerSet.has((r.administracion_persona||"").toLowerCase())) sum += r.administracion;
    if(ownerSet.has((r.comite_persona||"").toLowerCase())) sum += r.comite;
    return sum;
  }
  function ownerRoleBreakdown(r, ownerSet){
    if(!ownerSet){
      return { vendedor:r.vendedor, director:r.director, consultor:r.consultor, gasto:r.gasto, administracion:r.administracion, comite:r.comite };
    }
    return {
      vendedor: ownerSet.has((r.vendedor_persona||"").toLowerCase()) ? r.vendedor : 0,
      director: ownerSet.has((r.director_persona||"").toLowerCase()) ? r.director : 0,
      consultor: ownerSet.has((r.consultor_persona||"").toLowerCase()) ? r.consultor : 0,
      gasto: ownerSet.has((r.gasto_persona||"").toLowerCase()) ? r.gasto : 0,
      administracion: ownerSet.has((r.administracion_persona||"").toLowerCase()) ? r.administracion : 0,
      comite: ownerSet.has((r.comite_persona||"").toLowerCase()) ? r.comite : 0
    };
  }

  function populateFilters(allRows){
    const yearsFactura = Array.from(new Set(allRows.filter(r=>r.fecha_factura).map(r=> r.fecha_factura.getFullYear()))).sort();
    const yearsPago = Array.from(new Set(allRows.filter(r=>r.fecha_pago).map(r=> r.fecha_pago.getFullYear()))).sort();
    const estatus = Array.from(new Set(allRows.map(r=> (r.estatus||"").trim()).filter(Boolean))).sort();
    const owners = Array.from(new Set(allRows.flatMap(r=>[
      r.vendedor_persona, r.director_persona, r.consultor_persona, r.gasto_persona, r.administracion_persona, r.comite_persona
    ]).map(x=> (x||"").trim()).filter(Boolean))).sort();

    const selOwner = document.getElementById("filterOwner");
    selOwner.innerHTML = '<option value="">Todos</option>' +
      '<option value="Equipo H&A">Equipo H&A</option>' +
      owners.map(v=> `<option value="${v}">${v}</option>`).join('');

    const fillSelect = (selId, arr) => {
      const sel = document.getElementById(selId);
      sel.innerHTML = '<option value="">Todos</option>' + arr.map(v=> `<option value="${v}">${v}</option>`).join('');
    };
    fillSelect("filterYearFactura", yearsFactura);
    fillSelect("filterYearPago", yearsPago);

    const selEst = document.getElementById("filterEstatus");
    selEst.innerHTML = '<option value="">Todos</option>' + estatus.map(v=> `<option value="${v}">${v}</option>`).join('');
  }

  function setStatusKPIs(rows){
    const by = (pred)=> rows.filter(pred).reduce((a,r)=> a + (r.owner_total||0), 0);
    const pagado = by(r=> (r.estatus||"").toLowerCase().includes("pagad"));
    const noPagado = by(r=> (r.estatus||"").toLowerCase().includes("cobrada"));
    const noFacturado = by(r=> (r.estatus||"").toLowerCase().includes("por emitir"));
    document.getElementById("kpiPagado").textContent = fmt(pagado);
    document.getElementById("kpiNoPagado").textContent = fmt(noPagado);
    document.getElementById("kpiNoFacturado").textContent = fmt(noFacturado);
  }
  function renderLists(rows){
    const pagadas = rows.filter(r=> (r.estatus||"").toLowerCase().includes("pagad"));
    const porEmitir = rows.filter(r=> (r.estatus||"").toLowerCase().includes("por emitir"));
    const li = r => `<li><strong>${r.cliente}</strong> — ${r.proyecto} · Factura: ${r.fecha_factura? r.fecha_factura.toLocaleDateString("es-CL"):"—"} · Pago Proyectado/Pagado: ${r.fecha_pago? r.fecha_pago.toLocaleDateString("es-CL"):"—"} · Asignado: ${fmt(r.owner_total||0)}</li>`;
    document.getElementById("listPagadas").innerHTML = pagadas.map(li).join("");
    document.getElementById("listPorEmitir").innerHTML = porEmitir.map(li).join("");
  }

  function setKPIs(rows){
    document.getElementById("kpiTotalIngresos").textContent = fmt(sumBy(rows,"owner_total"));
    document.getElementById("kpiVendedor").textContent = fmt(sumBy(rows,"vendedor"));
    document.getElementById("kpiDirectorPM").textContent = fmt(sumBy(rows,"director"));
    document.getElementById("kpiConsultor").textContent = fmt(sumBy(rows,"consultor"));
    document.getElementById("kpiGastoProyecto").textContent = fmt(sumBy(rows,"gasto"));
    document.getElementById("kpiAdministracion").textContent = fmt(sumBy(rows,"administracion"));
    document.getElementById("kpiComite").textContent = fmt(sumBy(rows,"comite"));
  }
  function setPrevisionLiquidos(rows){
    const asignado = sumBy(rows, "owner_total");
    const ret = Math.round(asignado * 0.145);
    const liquido = asignado - ret;
    document.getElementById("kpiAsignadoBruto").textContent = fmt(asignado);
    document.getElementById("kpiRetencion").textContent = fmt(ret);
    document.getElementById("kpiIngresoLiquido").textContent = fmt(liquido);
  }

  let chartNext6 = null, chartYear = null;
  function buildBarChart(ctx, labels, facturacion, ingresos){
    if(!ctx) return null;
    const maxVal = Math.max(...facturacion, ...ingresos, 0);
    const step = 3000000;
    const yMax = Math.max(step, Math.ceil((maxVal * 1.15) / step) * step);
    const config = {
      type: "bar",
      data: { labels, datasets: [
        { label:"Facturación", data: facturacion, backgroundColor:"#E53935" },
        { label:"Ingresos", data: ingresos, backgroundColor:"#43A047" }
      ]},
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color:"#e0e0e0" } },
          datalabels: { color:"#fff", anchor:"end", align:"end", formatter:(v)=> fmt(v), clamp:true },
          tooltip: { callbacks: { label:(c)=> `${c.dataset.label}: ${fmt(c.parsed.y)}` } }
        },
        scales: {
          x: { ticks:{ color:"#e0e0e0" }, grid:{ color:"#2a2b2e" } },
          y: { ticks:{ color:"#e0e0e0", stepSize: step, callback:(v)=> fmt(v) }, grid:{ color:"#2a2b2e" }, suggestedMax: yMax }
        }
      },
      plugins: [ChartDataLabels]
    };
    return new Chart(ctx, config);
  }
  function makeSeriesByMonth_owner(rows, monthsList){
    const fact = monthsList.map(({y,m})=> rows.filter(r=> r.fecha_factura && r.fecha_factura.getFullYear()===y && r.fecha_factura.getMonth()===m).reduce((a,r)=> a+(r.owner_total||0),0));
    const ing  = monthsList.map(({y,m})=> rows.filter(r=> r.fecha_pago && r.fecha_pago.getFullYear()===y && r.fecha_pago.getMonth()===m).reduce((a,r)=> a+(r.owner_total||0),0));
    return { fact, ing };
  }
  function renderPlanningNext6(rows){
    const now = new Date();
    const monthsList = Array.from({length:6}).map((_,i)=>{
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      return { y:d.getFullYear(), m:d.getMonth(), label:`${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` };
    });
    const { fact, ing } = makeSeriesByMonth_owner(rows, monthsList);
    if(chartNext6) chartNext6.destroy();
    chartNext6 = buildBarChart(document.getElementById("chartNext6"), monthsList.map(x=>x.label), fact, ing);
  }
  function renderPlanningYear(rows){
    const fySel = document.getElementById("filterYearFactura").value;
    const year = fySel ? parseInt(fySel,10) : (new Date()).getFullYear();
    const monthsList = Array.from({length:12}).map((_,i)=>({ y:year, m:i, label: MONTH_LABELS[i] }));
    const { fact, ing } = makeSeriesByMonth_owner(rows, monthsList);
    if(chartYear) chartYear.destroy();
    chartYear = buildBarChart(document.getElementById("chartYear"), monthsList.map(x=>x.label), fact, ing);
  }

  function equipoHAIngresosByMonth(allRows){
    const map = new Map();
    for(const r of allRows){
      if(!r.fecha_pago) continue;
      if(!((r.estatus||"").toLowerCase().includes("pagad"))) continue;
      let asignado = 0;
      if(EQUIPO_HA.has((r.vendedor_persona||"").toLowerCase())) asignado += r.vendedor;
      if(EQUIPO_HA.has((r.director_persona||"").toLowerCase())) asignado += r.director;
      if(EQUIPO_HA.has((r.consultor_persona||"").toLowerCase())) asignado += r.consultor;
      if(EQUIPO_HA.has((r.gasto_persona||"").toLowerCase())) asignado += r.gasto;
      if(EQUIPO_HA.has((r.administracion_persona||"").toLowerCase())) asignado += r.administracion;
      if(EQUIPO_HA.has((r.comite_persona||"").toLowerCase())) asignado += r.comite;
      const key = `${r.fecha_pago.getFullYear()}-${String(r.fecha_pago.getMonth()+1).padStart(2,"0")}`;
      map.set(key, (map.get(key)||0) + asignado);
    }
    return map;
  }
  function renderDebt(allRows){
    const RET = 0.145;
    const FIX = 6000000;
    const START_DEBT = 31000000;
    document.getElementById("kpiDebtNow").textContent = fmt(START_DEBT);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const asignadoMap = equipoHAIngresosByMonth(allRows);

    let debt = START_DEBT;
    const tbody = document.getElementById("debtRows");
    tbody.innerHTML = "";
    for(let i=0;i<12;i++){
      const d = new Date(start.getFullYear(), start.getMonth()+i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const asignadoMes = asignadoMap.get(key)||0;
      const liquidoMes = Math.round(asignadoMes * (1 - RET));
      const variacion = liquidoMes - FIX;
      debt = debt - Math.max(0, variacion) + Math.max(0, -variacion);
      const row = `<tr>
        <td>${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}</td>
        <td>${fmt(FIX)}</td>
        <td>${fmt(liquidoMes)}</td>
        <td style="color:${variacion>=0?'#43A047':'#E53935'}">${variacion>=0?'+':''}${fmt(variacion)}</td>
        <td>${fmt(debt)}</td>
      </tr>`;
      tbody.insertAdjacentHTML("beforeend", row);
    }
  }

  let RAW_ROWS = [];

  function applyFilters(allRows){
    const fy = document.getElementById("filterYearFactura").value;
    const py = document.getElementById("filterYearPago").value;
    const est = (document.getElementById("filterEstatus").value || "").toLowerCase();
    const ownerSel = document.getElementById("filterOwner").value;
    const ownerSet = getOwnerSet(ownerSel);

    const base = allRows.filter(r=>{
      let ok = true;
      if(fy){ ok = ok && r.fecha_factura && r.fecha_factura.getFullYear().toString()===fy; }
      if(py){ ok = ok && r.fecha_pago && r.fecha_pago.getFullYear().toString()===py; }
      if(est){ ok = ok && (r.estatus||"").toLowerCase().includes(est); }
      return ok;
    });

    return base.map(r=>{
      const ownerTotal = ownerAmountForRow(r, ownerSet);
      const breakdown = ownerRoleBreakdown(r, ownerSet);
      return { ...r, owner_total: ownerTotal, ...Object.fromEntries(Object.entries(breakdown)) };
    });
  }

  function renderAll(){
    const rows = applyFilters(RAW_ROWS);
    setKPIs(rows);
    setStatusKPIs(rows);
    setPrevisionLiquidos(rows);
    renderPlanningNext6(rows);
    renderPlanningYear(rows);
    renderLists(rows);
    renderDebt(RAW_ROWS);
  }

  async function refreshData(){
    const cfg = window.APP_CONFIG || {};
    if(cfg.WEB_APP_URL){
      const a = document.createElement("a"); a.href = cfg.WEB_APP_URL; a.target="_blank"; a.rel="noopener"; a.textContent = "Ver Web App (Sheet)";
      const cont = document.getElementById("sheetLink"); cont.innerHTML = ""; cont.appendChild(a);
    }
    const values = await fetchSheet();
    RAW_ROWS = toRows(values);
    populateFilters(RAW_ROWS);
    renderAll();
  }

  function bindUI(){
    document.getElementById("btnRefresh").addEventListener("click", async ()=>{
      const b = document.getElementById("btnRefresh"); b.disabled = true;
      try{ await refreshData(); } finally{ b.disabled = false; }
    });
    ["filterYearFactura","filterYearPago","filterEstatus","filterOwner"].forEach(id=>{
      document.getElementById(id).addEventListener("change", renderAll);
    });
    document.getElementById("btnClearFilters").addEventListener("click", ()=>{
      ["filterYearFactura","filterYearPago","filterEstatus","filterOwner"].forEach(id=> document.getElementById(id).value="");
      renderAll();
    });
  }

  window.addEventListener("DOMContentLoaded", async ()=>{
    bindUI();
    try{ await refreshData(); }catch(err){ console.error(err); alert(err.message); }
  });
})();