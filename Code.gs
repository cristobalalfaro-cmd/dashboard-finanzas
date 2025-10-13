/**
 * Web API CRUD para proyectos + rendición de gastos
 */

const SHEET_PROY   = 'data';
const SHEET_GASTOS = 'gastos';

const HEADERS_PROY = [
  'id','fecha','cliente','proyecto','monto','porc_cobrado',
  'vendedor','director','consultor',
  'administracion','gasto','fee_consultora',
  'estado','fecha_estimada_pago','fecha_pago'
];

const HEADERS_GASTO = [
  'id_gasto','fecha_gasto','monto','cliente','proyecto','proyecto_id'
];

/** Obtiene (o crea) una hoja y asegura encabezados */
function _getSheet(name, headers){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const current = sh.getRange(1,1,1,headers.length).getValues()[0];
  if (current.join(',') !== headers.join(',')) {
    sh.clear();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sh;
}

/** GET:
 *  - /exec                -> proyectos
 *  - /exec?gastos=1       -> gastos
 */
function doGet(e){
  const sh = _getSheet(SHEET_PROY, HEADERS_PROY);
  const values = sh.getDataRange().getValues();
  const [head, ...rows] = values;
  const proys = rows
    .filter(r => r[0] !== '')
    .map(r => Object.fromEntries(head.map((h,i)=>[h, r[i]])));

  if (e && e.parameter && e.parameter.gastos){
    const sg = _getSheet(SHEET_GASTOS, HEADERS_GASTO);
    const vg = sg.getDataRange().getValues();
    const [hg, ...rg] = vg;
    const gastos = rg
      .filter(r=>r[0] !== '')
      .map(r=>Object.fromEntries(hg.map((h,i)=>[h, r[i]])));
    return ContentService
      .createTextOutput(JSON.stringify({ok:true, gastos}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ok:true, rows: proys}))
    .setMimeType(ContentService.MimeType.JSON);
}

/** POST:
 *  - {__kind:'gasto', fecha_gasto, monto, cliente, proyecto}  -> crea gasto
 *  - {proyecto ...}                                           -> crea/actualiza proyecto (si trae id = update)
 */
function doPost(e){
  const body = JSON.parse(e.postData.contents || '{}');

  // ===== Registrar GASTO =====
  if (body.__kind === 'gasto'){
    const sg = _getSheet(SHEET_GASTOS, HEADERS_GASTO);
    const sp = _getSheet(SHEET_PROY,   HEADERS_PROY);

    let proyecto_id = '';
    if (body.cliente && body.proyecto){
      const data = sp.getDataRange().getValues();
      for (let i=1; i<data.length; i++){
        if (data[i][2] == body.cliente && data[i][3] == body.proyecto){
          proyecto_id = data[i][0];
          break;
        }
      }
    }

    const newId = Date.now();
    const rowObj = {
      id_gasto     : newId,
      fecha_gasto  : body.fecha_gasto || '',
      monto        : Number(body.monto || 0),
      cliente      : body.cliente || '',
      proyecto     : body.proyecto || '',
      proyecto_id  : proyecto_id
    };
    const row = HEADERS_GASTO.map(h => (rowObj[h] !== undefined ? rowObj[h] : ''));
    sg.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ok:true, created:newId}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ===== Crear / Actualizar PROYECTO =====
  const sh = _getSheet(SHEET_PROY, HEADERS_PROY);

  body.monto        = Number(body.monto || 0);
  body.porc_cobrado = Math.min(100, Math.max(0, Number(body.porc_cobrado || 0)));

  if (body.id) {
    const data = sh.getDataRange().getValues();
    const idx = data.findIndex(row => row[0] == body.id);
    if (idx > 0) {
      const existing = sh.getRange(idx+1, 1, 1, HEADERS_PROY.length).getValues()[0];
      const next = HEADERS_PROY.map((h, i) =>
        body[h] !== undefined && body[h] !== null && body[h] !== ''
          ? body[h]
          : existing[i]
      );

      sh.getRange(idx+1, 1, 1, HEADERS_PROY.length).setValues([next]);

      return ContentService
        .createTextOutput(JSON.stringify({ok:true, updated: body.id}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ok:false, error:'id no encontrado'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const newId = Date.now();
  const row = HEADERS_PROY.map(h => h==='id' ? newId : (body[h] ?? ''));
  sh.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ok:true, created: newId}))
    .setMimeType(ContentService.MimeType.JSON);
}
