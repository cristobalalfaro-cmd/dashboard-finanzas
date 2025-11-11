(() => {
  const currencyFmt = (n) => {
    if (isNaN(n)) return "$ —";
    return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
  };

  // Porcentajes fijos (Vendedor, Director PM, Consultor, Gasto, Administración, Comité)
  const SPLIT = {
    vendedor: 0.15,
    director: 0.18,
    consultor: 0.50,
    gasto: 0.03,
    administracion: 0.04,
    comite: 0.10
  };

  const MONTHS_ES = {
    "ene":"01","enero":"01",
    "feb":"02","febrero":"02",
    "mar":"03","marzo":"03",
    "abr":"04","abril":"04",
    "may":"05","mayo":"05",
    "jun":"06","junio":"06",
    "jul":"07","julio":"07",
    "ago":"08","agosto":"08",
    "sept":"09","sep":"09","set":"09","septiembre":"09",
    "oct":"10","octubre":"10",
    "nov":"11","noviembre":"11",
    "dic":"12","diciembre":"12"
  };

  function parseSmartDate(str){
    if(!str) return null;
    let s = String(str).trim().toLowerCase();
    if(!s) return null;

    let d = new Date(s);
    if(!isNaN(d)) return d;

    let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if(m){
      const [_,dd,mm,yy] = m;
      const yyyy = yy.length===2 ? ("20"+yy) : yy;
      const iso = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
      let d2 = new Date(iso);
      if(!isNaN(d2)) return d2;
    }

    let m2 = s.match(/^(\d{1,2})[\/\-\.]([a-záéíóú]+)[\/\-\.](\d{2,4})$/i);
    if(m2){
      let dd = m2[1].padStart(2,"0");
      let mon = (MONTHS_ES[m2[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")]||"");
      let yy = m2[3];
      if(mon){
        const yyyy = yy.length===2 ? ("20"+yy) : yy;
        let d3 = new Date(`${yyyy}-${mon}-${dd}`);
        if(!isNaN(d3)) return d3;
      }
    }
    return null;
  }

  function headerIndexMap(headers){
    const norm = (s)=> s.toString().trim().toLowerCase();
    const want = {
      cliente: ["cliente"],
      proyecto: ["proyecto"],
      total: ["total factura proyecto (bruto)", "total proyecto (bruto)", "total"],
      vendedor_persona: ["vendedor (persona)", "vendedor persona", "responsable vendedor"],
      director_persona: ["director pm (persona)", "director pmo (persona)", "director pm persona", "responsable director"],
      consultor_persona: ["consultor (persona)", "consultor persona", "responsable consultor"],
      gasto_persona: ["gasto proyecto (persona)", "gasto (persona)", "responsable gasto"],
      administracion_persona: ["administración (persona)", "administracion (persona)", "responsable administración", "responsable administracion"],
      comite_persona: ["comité (persona)", "comite (persona)", "responsable comité", "responsable comite"],
      fecha_factura: ["fecha factu","fecha factura"],
      fecha_pago: ["fecha pago proyectada","fecha pago proyectad"],
      estatus: ["estatus factura","estado factura"],
      rol_asignado: ["rol asignado"]
    };
    const map = {};
    headers.forEach((h,i)=>{
      const nh = norm(h);
      for(const key in want){
        if(want[key].some(x=> nh.includes(x))) map[key]=i;
      }
    });
    return map;
  }

  async function fetchSheet(){
    const url = (window.APP_CONFIG && window.APP_CONFIG.WEB_APP_URL) || "";
    if(!url) throw new Error("Falta configurar WEB_APP_URL en config.js");
    const resp = await fetch(url, { cache: "no-store" });
    if(!resp.ok){
      const t = await resp.text();
      throw new Error(`Error al leer Web App: ${resp.status} ${t}`);
    }
    const data = await resp.json();
    // Espera { values: [...] } tal como devuelve code.gs
    return data.values || [];
  }

  function toRows(values){
    if(!values || values.length===0) return [];
    const headers = values[0];
    const idx = headerIndexMap(headers);
    const rows = [];
    for(let r=1; r<values.length; r++){
      const row = values[r];
      const get = (k)=> row[(idx[k] ?? -1)] ?? "";

      const totalRaw = +String(get("total")).replace(/[^\d\-.,]/g,"").replace(/\./g,"").replace(",",".") || 0;
      const vendedor = Math.round(totalRaw * SPLIT.vendedor);
      const director = Math.round(totalRaw * SPLIT.director);
      const consultor = Math.round(totalRaw * SPLIT.consultor);
      const gasto = Math.round(totalRaw * SPLIT.gasto);
      const administracion = Math.round(totalRaw * SPLIT.administracion);
      const comite = Math.round(totalRaw * SPLIT.comite);

      rows.push({
        cliente: get("cliente"),
        proyecto: get("proyecto"),
        total: totalRaw,
        vendedor,
        director,
        consultor,
        gasto,
        administracion,
        comite,
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

  function sumBy(rows, key){
    return rows.reduce((acc,r)=> acc + (Number(r[key])||0), 0);
  }

  function setKPIs(rows){
    const sumTotal = sumBy(rows, "total");
    const sumVend = sumBy(rows, "vendedor");
    const sumDir = sumBy(rows, "director");
    const sumCons = sumBy(rows, "consultor");
    const sumGasto = sumBy(rows, "gasto");
    const sumAdm = sumBy(rows, "administracion");
    const sumCom = sumBy(rows, "comite");

    document.getElementById("kpiTotalIngresos").textContent = currencyFmt(sumTotal);
    document.getElementById("kpiVendedor").textContent = currencyFmt(sumVend);
    document.getElementById("kpiDirectorPM").textContent = currencyFmt(sumDir);
    document.getElementById("kpiConsultor").textContent = currencyFmt(sumCons);
    document.getElementById("kpiGastoProyecto").textContent = currencyFmt(sumGasto);
    document.getElementById("kpiAdministracion").textContent = currencyFmt(sumAdm);
    document.getElementById("kpiComite").textContent = currencyFmt(sumCom);

    const ctx = document.getElementById("chartRoles");
    if(ctx){
      const data = {
        labels: ["Vendedor","Director PM","Consultor","Gasto Proyecto","Administración","Comité"],
        datasets: [{
          label: "Montos",
          data: [sumVend, sumDir, sumCons, sumGasto, sumAdm, sumCom],
          backgroundColor: ["#d0d0d0","#bdbdbd","#a8a8a8","#949494","#7f7f7f","#6b6b6b"]
        }]
      };
      new Chart(ctx, { type: "bar", data, options:{
        responsive:true,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: (ctx)=> currencyFmt(ctx.parsed.y) } } },
        scales:{
          x:{ ticks:{ color:"#e0e0e0" }, grid:{ color:"#2a2b2e" } },
          y:{ ticks:{ color:"#e0e0e0" }, grid:{ color:"#2a2b2e" } }
        }
      }});
    }
  }

  function renderLists(rows){
    const pagadas = rows.filter(r=> (r.estatus||"").toLowerCase().includes("pagad"));
    const porEmitir = rows.filter(r=> (r.estatus||"").toLowerCase().includes("por emitir"));

    const liFmt = (r)=>{
      const ff = r.fecha_factura ? r.fecha_factura.toLocaleDateString("es-CL") : "—";
      const fp = r.fecha_pago ? r.fecha_pago.toLocaleDateString("es-CL") : "—";
      return `<li><strong>${r.cliente}</strong> — ${r.proyecto} · Factura: ${ff} · Pago Proyectado: ${fp} · Total: ${currencyFmt(r.total)}</li>`;
    };

    document.getElementById("listPagadas").innerHTML = pagadas.map(liFmt).join("");
    document.getElementById("listPorEmitir").innerHTML = porEmitir.map(liFmt).join("");
  }

  function drawGantt(rows, months=6){
    const now = new Date();
    const startWindow = new Date(now.getFullYear(), now.getMonth(), 1);
    const endWindow = new Date(now.getFullYear(), now.getMonth()+months, 1);

    const tasks = rows
      .filter(r=> r.fecha_factura || r.fecha_pago)
      .map((r, idx)=>{
        const start = r.fecha_factura || r.fecha_pago;
        const end = r.fecha_pago || r.fecha_factura || start;
        return { id: "T"+idx, cliente: r.cliente, proyecto: r.proyecto, start, end };
      })
      .filter(t => t.start >= new Date(startWindow.getFullYear(), startWindow.getMonth()-1, 1) && t.start < endWindow);

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Task ID');
    data.addColumn('string', 'Task Name');
    data.addColumn('string', 'Resource');
    data.addColumn('date', 'Start Date');
    data.addColumn('date', 'End Date');
    data.addColumn('number', 'Duration');
    data.addColumn('number', 'Percent Complete');
    data.addColumn('string', 'Dependencies');

    tasks.forEach(t=>{
      const name = `${t.cliente} — ${t.proyecto}`;
      data.addRow([ t.id, name, "", t.start, t.end, null, 100, null ]);
    });

    const options = {
      height: Math.max(340, tasks.length * 32),
      gantt: {
        criticalPathEnabled: false,
        innerGridTrack: { fill: '#1a1b1d' },
        innerGridDarkTrack: { fill: '#151617' },
        labelStyle: { color: '#e6e6e6', fontName:'Inter' },
        percentEnabled: false,
        palette: [ { color:'#bdbdbd', dark:'#8c8c8c', light:'#dcdcdc' } ]
      },
      backgroundColor: '#1f2022'
    };

    const container = document.getElementById('gantt');
    const chart = new google.visualization.Gantt(container);
    chart.draw(data, options);
  }

  async function init(){
    const cfg = window.APP_CONFIG || {};
    if(cfg.WEB_APP_URL){
      const a = document.createElement("a");
      a.href = cfg.WEB_APP_URL;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Ver Web App (Sheet)";
      document.getElementById("sheetLink").appendChild(a);
    }

    let values = [];
    try{
      values = await fetchSheet();
    }catch(err){
      console.error(err);
      alert(err.message);
      return;
    }
    const rows = toRows(values);

    setKPIs(rows);
    renderLists(rows);

    google.charts.load('current', {'packages':['gantt']});
    const render = () => {
      const months = parseInt(document.getElementById('monthsWindow').value,10) || 6;
      drawGantt(rows, months);
    };
    google.charts.setOnLoadCallback(render);
    document.getElementById('monthsWindow').addEventListener('change', render);
  }

  window.addEventListener("DOMContentLoaded", init);
})();