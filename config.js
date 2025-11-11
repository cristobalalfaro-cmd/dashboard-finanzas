// Rellena estos valores antes de publicar.
// 1) Crea una API Key en Google Cloud y restríngele el uso al "Google Sheets API" + HTTP referrer de tu GitHub Pages.
// 2) Comparte el Google Sheets como "Cualquiera con el enlace: Lector".
// 3) Copia el ID de la hoja (lo que va entre /spreadsheets/d/ y /edit).
// 4) Ajusta el rango. Debe incluir la fila de encabezados.

window.APP_CONFIG = {
  GOOGLE_SHEETS_API_KEY: "TU_API_KEY_AQUI",
  SHEET_ID: "TU_SHEET_ID_AQUI",
  RANGE: "Hoja1!A1:T2000" // ajusta el nombre de la hoja y el rango
};
