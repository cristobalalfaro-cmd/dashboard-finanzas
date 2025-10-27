/**
 * Code.gs — Backend Apps Script (SAFE)
 * Web API para proyectos y rendición de gastos (no destructivo)
 * Hojas requeridas:
 *  - 'data'   (proyectos)
 *  - 'gastos' (rendiciones)
 */

// ======= Config =======
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

// ======= Helpers seguros =======
function getOrCreateSheet(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/**
 * Asegura encabezados SIN BORRAR datos:
 * - Si la hoja está vacía, escribe los headers esperados.
 * - Si existen, crea un índice por nombre y agrega cualquier header faltante al final.
 * Retorna { sheet, headersRow:Array<string>, index: Map<headerName, colIndex1based> }
 */
function ensureHeadersSafe(sheet, expectedHeaders){
  let lastRow = sheet.getLastRow();
  let lastCol = sheet.getLastColumn();

  if (lastRow < 1) {
    // hoja vacía → escribimos headers
    sheet.getRange(1,1,1,expectedHeaders.length).setValues([expectedHeaders]);
    lastRow = 1;
    lastCol = expectedHeaders.length;
  }

  // leer fila 1 actual
  const existing = sheet.getRange(1,1,1,Math.max(lastCol, expectedHeaders.length)).getValues()[0];
  const headersRow = [...existing];

  // construir índice por nombre existente
  const index = new Map();
  for (let c=0; c<headersRow.length; c++){
    const name = String(headersRow[c]||'').trim();
    if (name) index.set(name, c+1); // 1-based
  }

  // agregar los headers faltantes al final
  let appended = false;
  for (const h of expectedHeaders){
    if (!index.has(h)){
      headersRow.push(h);
      index.set(h, headersRow.length); // nueva columna 1-based
      appended = true;
    }
  }
  if (appended){
    sheet.getRange(1,1,1,headersRow.length).setValues([headersRow]);
  }

  return { sheet, headersRow, index };
}

/** Lee todas las filas como objetos, mapeando por nombre de encabezado (robusto al orden). */
function readAllRows(sheet, headerIndex){
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow-1, lastCol).getValues();
  const out = [];

  // invertimos el map a obj {header -> colIdx}
  const idx = {};
  headerIndex.forEach((c, h) => { idx[h] = c; });

  for (const row of values){
    // construir objeto solo con nuestros headers esperados
    const o = {};
    Object.keys(idx).forEach(h=>{
      const col = idx[h]; // 1-based
      if (col && col <= row.length) o[h] = row[col-1];
      else o[h] = '';
    });
    // ignorar filas sin id (en la hoja de proyectos/gastos)
    out.push(o);
  }
  return out;
}

/** Busca el número de fila (1-based) de un valor en una columna dada */
function findRowByValue(sheet, col1based, value){
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const rng = sheet.getRange(2, col1based, lastRow-1, 1).getValues();
  for (let i=0; i<rng.length; i++){
    if (String(rng[i][0]) === String(value)) return 2 + i;
  }
  return -1;
}

/** Set de valores por header name → valor, respetando mapeo de columnas. */
function setRowValuesByHeaders(sheet, row1based, mapping, dataObj){
  // mapping: Map<headerName, colIndex>
  mapping.forEach((col, h)=>{
    if (Object.prototype.hasOwnProperty.call(dataObj, h)){
      sheet.getRange(row1based, col).setValue(dataObj[h]);
    }
  });
}

/** Construye un objeto con valores numéricos clamped, etc. */
function normalizeProyecto(body){
  const b = Object.assign({}, body);
  if (b.monto != null) b.monto = Number(b.monto || 0);
  if (b.porc_cobrado != null) {
    b.porc_cobrado = Math.max(0, Math.min(100, Number(b.porc_cobrado || 0)));
  }
  return b;
}

// ======= API =======
/**
 * GET:
 *  - /exec                  -> { ok:true, rows:[...] } (proyectos)
 *  - /exec?gastos=1         -> { ok:true, gastos:[...] } (rendiciones)
 */
function doGet(e){
  if (e && e.parameter && e.parameter.gastos){
    const { sheet, index } = ensureHeadersSafe(getOrCreateSheet(SHEET_GASTOS), HEADERS_GASTO);
    const data = readAllRows(sheet, index).filter(r => String(r.id_gasto||'').trim() !== '');
    return ContentService.createTextOutput(JSON.stringify({ ok:true, gastos:data }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const { sheet, index } = ensureHeadersSafe(getOrCreateSheet(SHEET_PROY), HEADERS_PROY);
  const data = readAllRows(sheet, index).filter(r => String(r.id||'').trim() !== '');
  return ContentService.createTextOutput(JSON.stringify({ ok:true, rows:data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST:
 *  - { __kind:'gasto', fecha_gasto, monto, cliente, proyecto }
 *      -> crea gasto en 'gastos'
 *  - { ...proyecto } con/ sin id
 *      -> si body.id existe: update en 'data'
 *      -> si no hay id: create en 'data'
 *
 * El front envía 'text/plain'; aquí parseamos JSON.
 */
function doPost(e){
  var body = {};
  try {
    body = JSON.parse(e.postData && e.postData.contents || '{}');
  } catch (err) {
    return jsonOut({ ok:false, error:'JSON inválido' });
  }

  if (body.__kind === 'gasto'){
    return createGasto(body);
  }
  return upsertProyecto(body);
}

// ======= Implementaciones =======
function createGasto(body){
  const { sheet: sg, index: ig } = ensureHeadersSafe(getOrCreateSheet(SHEET_GASTOS), HEADERS_GASTO);
  const { sheet: sp, index: ip } = ensureHeadersSafe(getOrCreateSheet(SHEET_PROY),   HEADERS_PROY);

  // Buscar id del proyecto por cliente + proyecto (si existe)
  let proyecto_id = '';
  if (body.cliente && body.proyecto){
    const all = readAllRows(sp, ip);
    const hit = all.find(r => String(r.cliente)===String(body.cliente) && String(r.proyecto)===String(body.proyecto));
    if (hit) proyecto_id = hit.id;
  }

  const newId = Date.now();
  const rowObj = {
    id_gasto    : newId,
    fecha_gasto : body.fecha_gasto || '',
    monto       : Number(body.monto || 0),
    cliente     : body.cliente || '',
    proyecto    : body.proyecto || '',
    proyecto_id : proyecto_id
  };

  // escribir por columnas mapeadas (agrega celdas necesarias si es más largo)
  const lastRow = sg.getLastRow();
  const targetRow = lastRow + 1;
  ig.forEach((col, h)=>{
    sg.getRange(targetRow, col).setValue(rowObj[h] !== undefined ? rowObj[h] : '');
  });

  return jsonOut({ ok:true, created:newId });
}

function upsertProyecto(bodyRaw){
  const { sheet: sh, index: ih } = ensureHeadersSafe(getOrCreateSheet(SHEET_PROY), HEADERS_PROY);
  const body = normalizeProyecto(bodyRaw);

  // UPDATE por id
  if (body.id){
    const idCol = ih.get('id');
    const row = findRowByValue(sh, idCol, body.id);
    if (row > 0){
      // solo sobrescribe campos presentes en body
      setRowValuesByHeaders(sh, row, ih, body);
      return jsonOut({ ok:true, updated: body.id });
    }
    return jsonOut({ ok:false, error:'id no encontrado' });
  }

  // CREATE
  const newId = Date.now();
  const rowObj = Object.assign(Object.fromEntries(HEADERS_PROY.map(h=>[h,''])), body, { id:newId });

  const lastRow = sh.getLastRow();
  const targetRow = lastRow + 1;
  ih.forEach((col, h)=>{
    sh.getRange(targetRow, col).setValue(rowObj[h] !== undefined ? rowObj[h] : '');
  });

  return jsonOut({ ok:true, created:newId });
}

// ======= Respuesta JSON =======
function jsonOut(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
