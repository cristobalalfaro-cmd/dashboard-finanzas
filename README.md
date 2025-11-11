# Dashboard Financiero (Google Sheets → GitHub Pages)

Dashboard en tonos grises/blanco/negro que consume **Google Sheets** como fuente de datos.
Muestra:
- **KPIs**: Total Ingresos (Bruto) y distribución por rol (Vendedor, Director PM, Consultor, Gasto Proyecto, Administración, Comité).
- **Gantt** de facturación (6 meses desde el mes actual) con *Fecha de Factura* y *Fecha de Pago Proyectado*.
- **Listados**: Proyectos *Pagados* y *Por emitir* (desde la columna **Estatus Factura**).

## 1) Estructura del Google Sheets
Encabezados (fila 1) recomendados:
```
Cliente | Proyecto | Total Factura Proyecto (Bruto) | Vendedor (Persona) | Director PM (Persona) | Consultor (Persona) | Gasto Proyecto (Persona) | Administración (Persona) | Comité (Persona) | Fecha Factura | Fecha Pago Proyectada | Estatus Factura | Rol Asignado
```

- Las columnas numéricas pueden estar con formato CLP; el script limpia puntos/commas automáticamente.
- Formatos de fecha soportados: `DD/MM/AAAA`, `DD-MM-AAAA`, `DD-MMM-YY` en español (ej.: `03-sept-25`).

> **Tip:** Si ya tienes un Sheet con otros nombres, puedes renombrar los encabezados o ampliar el mapeo en `script.js → headerIndexMap()`.

## 2) Configuración
Edita `config.js` y completa:

```js
window.APP_CONFIG = {
  GOOGLE_SHEETS_API_KEY: "TU_API_KEY_AQUI",
  SHEET_ID: "TU_SHEET_ID_AQUI",
  RANGE: "Hoja1!A1:T2000"
};
```

### Recomendaciones de seguridad
- Restringe la **API Key** a:
  - **API:** Google Sheets API
  - **HTTP referrers:** tu dominio de GitHub Pages (por ej. `https://<tu-usuario>.github.io/*`)
- Comparte el Google Sheets como **"Cualquiera con el enlace: Lector"**.

## 3) Publicar en GitHub Pages
1. Sube todos los archivos del ZIP a un repo.
2. Activa GitHub Pages (branch `main` / carpeta root).
3. Abre la URL pública y prueba.

## 4) Librerías
- **Chart.js**: para el gráfico de distribución por rol (bar chart).
- **Google Charts (Gantt)**: para el gantt de facturación (paleta gris).

## 5) Personalización rápida
- Cambia los colores en `styles.css` (variables `--bg`, `--panel`, etc.).
- Ajusta el rango o nombres de hoja en `config.js`.
- Añade más estados a los listados en `script.js` (función `renderLists`).

---

Hecho para uso con tonos **gris/blanco/negro** y despliegue simple en **GitHub Pages**.


## Importante sobre la distribución por rol
El dashboard **no** lee montos por rol desde el Sheet. Calcula automáticamente cada monto a partir del **Total del Proyecto** con esta regla fija:

- Vendedor: **15%**
- Director PM: **18%**
- Consultor: **50%**
- Gasto Proyecto: **3%**
- Administración: **4%**
- Comité: **10%**

> En el Sheet solo necesitas registrar los **nombres** de las personas responsables en estas columnas:
> `Vendedor (Persona)`, `Director PM (Persona)`, `Consultor (Persona)`, `Gasto Proyecto (Persona)`, `Administración (Persona)`, `Comité (Persona)`.
