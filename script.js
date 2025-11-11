(() => {
  const currencyFmt = (n) => isNaN(n) ? "$ —" :
    n.toLocaleString("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 });

  const SPLIT = { vendedor:.15, director:.18, consultor:.50, gasto:.03, administracion:.04, comite:.10 };

  const MONTHS_ES = {"ene":"01","enero":"01","feb":"02","febrero":"02","mar":"03","marzo":"03","abr":"04","abril":"04","may":"05","mayo":"05","jun":"06","junio":"06","jul":"07","julio":"07","ago":"08","agosto":"08","sept":"09","sep":"09","set":"09","septiembre":"09","oct":"10","octubre":"10","nov":"11","noviembre":"11","dic":"12","diciembre":"12"};
  const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  function parseSmartDate(str){
    if(!str) return null;
    let s = String(str).trim().toLowerCase();
    let d = new Date(s); if(!isNaN(d)) return d;
    let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if(m){ const [_,dd,mm,yy]=m; const yyyy = yy.length===2 ? ("20"+yy) : yy;
      let d2 = new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`); if(!isNaN(d2)) return d2; }
    let m2 = s.match(/^(\d{1,2})[\/\-\.]([a-záéíóú]+)[\/\-\.](\d{2,4})$/i);
    if(m2){ let dd=m2[1].padStart(2,"0"), mon=(MONTHS_ES[m2[2].normalize("NFD").replace(/[\u0300-\u036f]/g,"")]||""), yy=m2[3];
      if(mon){ const yyyy= yy.length===2?("20"+yy):yy; let d3 = new Date(`${yyyy}-${mon}-${dd}`); if(!isNaN(d3)) return d3; } }
    return null;
  }

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
    if(!resp.ok){ throw new Error(`Error Web App: ${resp.status}`); }
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

  function currencyCeil(n, step){ const s = step||3000000; return Math.ceil((n||0) / s) * s; }
  function sumBy(rows,key){ return rows.reduce((a,r)=> a+(Number(r[key])||0),0); }

  function applyFilters(allRows){
    const fy = document.getElementById("filterYearFactura").value;
    const py = document.getElementById("filterYearPago").value;
    const est = (document.getElementById("filterEstatus").value || "").toLowerCase();

    return allRows.filter(r=>{
      let ok = true;
      if(fy){ ok = ok && r.fecha_factura && r.fecha_factura.getFullYear().toString()===fy; }
      if(py){ ok = ok && r.fecha_pago && r.fecha_pago.getFullYear().toString()===py; }
      if(est){ ok = ok && (r.estatus||"").toLowerCase().includes(est); }
      return ok;
    });
  }

  function setKPIs(rows){
    document.getElementById("kpiTotalIngresos").textContent = currencyFmt(sumBy(rows,"total"));
    document.getElementById("kpiVendedor").textContent = currencyFmt(sumBy(rows,"vendedor"));
    document.getElementById("kpiDirectorPM").textContent = currencyFmt(sumBy(rows,"director"));
    document.getElementById("kpiConsultor").textContent = currencyFmt(sumBy(rows,"consultor"));
    document.getElementById("kpiGastoProyecto").textContent = currencyFmt(sumBy(rows,"gasto"));
    document.getElementById("kpiAdministracion").textContent = currencyFmt(sumBy(rows,"administracion"));
    document.getElementById("kpiComite").textContent = currencyFmt(sumBy(rows,"comite"));
  }

  function setStatusKPIs(rows){
    const pagado = rows.filter(r=> (r.estatus||"").toLowerCase().includes("pagad"));
    const noPagado = rows.filter(r=> (r.estatus||"").toLowerCase().includes("cobrada"));
    const noFacturado = rows.filter(r=> (r.estatus||"").toLowerCase().includes("por emitir"));
    document.getElementById("kpiPagado").textContent = currencyFmt(sumBy(pagado,"total"));
    document.getElementById("kpiNoPagado").textContent = currencyFmt(sumBy(noPagado,"total"));
    document.getElementById("kpiNoFacturado").textContent = currencyFmt(sumBy(noFacturado,"total"));
  }

  function renderLists(rows){
    const pagadas = rows.filter(r=> (r.estatus||"").toLowerCase().includes("pagad"));
    const porEmitir = rows.filter(r=> (r.estatus||"").toLowerCase().includes("por emitir"));
    const li = r => `<li><strong>${r.cliente}</strong> — ${r.proyecto} · Factura: ${r.fecha_factura? r.fecha_factura.toLocaleDateString("es-CL"):"—"} · Pago Proyectado: ${r.fecha_pago? r.fecha_pago.toLocaleDateString("es-CL"):"—"} · Total: ${currencyFmt(r.total)}</li>`;
    document.getElementById("listPagadas").innerHTML = pagadas.map(li).join("");
    document.getElementById("listPorEmitir").innerHTML = porEmitir.map(li).join("");
  }

  let chartNext6 = null, chartYear = null;
  function buildBarChart(ctx, labels, facturacion, ingresos){
    if(!ctx) return null;
    const maxVal = Math.max(...facturacion, ...ingresos, 0);
    const step = 3000000;
    const yMax = Math.max(step, currencyCeil(maxVal * 1.15, step));
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
          datalabels: { color:"#fff", anchor:"end", align:"end", formatter:(v)=> currencyFmt(v), clamp:true },
          tooltip: { callbacks: { label:(c)=> `${c.dataset.label}: ${currencyFmt(c.parsed.y)}` } }
        },
        scales: {
          x: { ticks:{ color:"#e0e0e0" }, grid:{ color:"#2a2b2e" } },
          y: { ticks:{ color:"#e0e0e0", stepSize: step, callback:(v)=> currencyFmt(v) }, grid:{ color:"#2a2b2e" }, suggestedMax: yMax }
        }
      },
      plugins: [ChartDataLabels]
    };
    return new Chart(ctx, config);
  }

  function makeSeriesByMonth(rows, monthsList){
    const fact = monthsList.map(({y,m})=> rows.filter(r=> r.fecha_factura && r.fecha_factura.getFullYear()===y && r.fecha_factura.getMonth()===m).reduce((a,r)=> a+(r.total||0),0));
    const ing  = monthsList.map(({y,m})=> rows.filter(r=> r.fecha_pago && r.fecha_pago.getFullYear()===y && r.fecha_pago.getMonth()===m).reduce((a,r)=> a+(r.total||0),0));
    return { fact, ing };
  }

  function renderPlanningNext6(rows){
    const now = new Date();
    const monthsList = Array.from({length:6}).map((_,i)=>{
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      return { y:d.getFullYear(), m:d.getMonth(), label:`${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` };
    });
    const { fact, ing } = makeSeriesByMonth(rows, monthsList);
    if(chartNext6) chartNext6.destroy();
    chartNext6 = buildBarChart(document.getElementById("chartNext6"), monthsList.map(x=>x.label), fact, ing);
  }

  function renderPlanningYear(rows){
    const fySel = document.getElementById("filterYearFactura").value;
    const year = fySel ? parseInt(fySel,10) : (new Date()).getFullYear();
    const monthsList = Array.from({length:12}).map((_,i)=>({ y: year, m: i, label: MONTH_LABELS[i] }));
    const { fact, ing } = makeSeriesByMonth(rows, monthsList);
    if(chartYear) chartYear.destroy();
    chartYear = buildBarChart(document.getElementById("chartYear"), monthsList.map(x=>x.label), fact, ing);
  }

  function drawGantt(rows, months=6){
    const now = new Date(); const startWindow = new Date(now.getFullYear(), now.getMonth(), 1); const endWindow = new Date(now.getFullYear(), now.getMonth()+months, 1);
    const tasks = rows.filter(r=> r.fecha_factura || r.fecha_pago).map((r,i)=>{
      const start = r.fecha_factura || r.fecha_pago; const end = r.fecha_pago || r.fecha_factura || start;
      return { id:"T"+i, name:`${r.cliente} — ${r.proyecto}`, start, end }; })
      .filter(t=> t.start >= new Date(startWindow.getFullYear(), startWindow.getMonth()-1,1) && t.start < endWindow);

    const data = new google.visualization.DataTable();
    data.addColumn('string','Task ID'); data.addColumn('string','Task Name'); data.addColumn('string','Resource');
    data.addColumn('date','Start Date'); data.addColumn('date','End Date'); data.addColumn('number','Duration');
    data.addColumn('number','Percent Complete'); data.addColumn('string','Dependencies');
    tasks.forEach(t=> data.addRow([t.id, t.name, "", t.start, t.end, null, 100, null]));

    const options = { height: Math.max(340, tasks.length*32), gantt:{ criticalPathEnabled:false, innerGridTrack:{fill:'#1a1b1d'}, innerGridDarkTrack:{fill:'#151617'}, labelStyle:{color:'#e6e6e6',fontName:'Inter'}, percentEnabled:false, palette:[{color:'#bdbdbd',dark:'#8c8c8c',light:'#dcdcdc'}] }, backgroundColor:'#1f2022' };
    new google.visualization.Gantt(document.getElementById('gantt')).draw(data, options);
  }

  let RAW_ROWS = [];

  function populateFilters(allRows){
    const yearsFactura = Array.from(new Set(allRows.filter(r=>r.fecha_factura).map(r=> r.fecha_factura.getFullYear()))).sort();
    const yearsPago = Array.from(new Set(allRows.filter(r=>r.fecha_pago).map(r=> r.fecha_pago.getFullYear()))).sort();
    const estatus = Array.from(new Set(allRows.map(r=> (r.estatus||"").trim()).filter(Boolean))).sort();

    const fillSelect = (selId, arr) => {
      const sel = document.getElementById(selId);
      const current = sel.value;
      sel.innerHTML = '<option value="">Todos</option>' + arr.map(v=> `<option value="${v}">${v}</option>`).join('');
      if(arr.includes(parseInt(current))) sel.value = current;
    };
    fillSelect("filterYearFactura", yearsFactura);
    fillSelect("filterYearPago", yearsPago);

    const selEst = document.getElementById("filterEstatus");
    const curEst = selEst.value;
    selEst.innerHTML = '<option value="">Todos</option>' + estatus.map(v=> `<option value="${v}">${v}</option>`).join('');
    if(estatus.includes(curEst)) selEst.value = curEst;
  }

  function renderAll(){
    const rows = applyFilters(RAW_ROWS);
    setKPIs(rows);
    setStatusKPIs(rows);
    renderPlanningNext6(rows);
    renderPlanningYear(rows);
    renderLists(rows);

    google.charts.load('current',{packages:['gantt']});
    const render = () => {
      const months = parseInt(document.getElementById('monthsWindow').value,10) || 6;
      drawGantt(rows, months);
    };
    google.charts.setOnLoadCallback(render);
    document.getElementById('monthsWindow').onchange = render;
  }

  async function refreshData(){
    const cfg = window.APP_CONFIG || {};
    if(cfg.WEB_APP_URL){
      const a = document.createElement("a");
      a.href = cfg.WEB_APP_URL; a.target="_blank"; a.rel="noopener"; a.textContent = "Ver Web App (Sheet)";
      const cont = document.getElementById("sheetLink");
      cont.innerHTML = "";
      cont.appendChild(a);
    }
    const values = await fetchSheet();
    RAW_ROWS = toRows(values);
    populateFilters(RAW_ROWS);
    renderAll();
  }

  function bindUI(){
    document.getElementById("btnRefresh").addEventListener("click", async ()=>{
      const b = document.getElementById("btnRefresh");
      b.disabled = true;
      try{ await refreshData(); } finally{ b.disabled = false; }
    });
    ["filterYearFactura","filterYearPago","filterEstatus"].forEach(id=>{
      document.getElementById(id).addEventListener("change", renderAll);
    });
    document.getElementById("btnClearFilters").addEventListener("click", ()=>{
      ["filterYearFactura","filterYearPago","filterEstatus"].forEach(id=> document.getElementById(id).value="");
      renderAll();
    });
  }

  window.addEventListener("DOMContentLoaded", async ()=>{
    bindUI();
    try{ await refreshData(); }catch(err){ console.error(err); alert(err.message); }
  });
})();