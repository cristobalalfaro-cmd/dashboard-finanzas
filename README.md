# Dashboard Financiero (Apps Script Web App → GitHub Pages)

Esta versión está **conectada** a tu Web App de **Google Apps Script**:
```
https://script.google.com/macros/s/AKfycbxMGzbCg6IgYd0PKFoYK2cplwOyNkb5gxb_UMSLvr_eiF3_KT2SxgQzK3u9-gG3H1ms/exec
```

## Estructura del Sheet (fila 1)
```
Cliente | Proyecto | Total Factura Proyecto (Bruto) |
Vendedor (Persona) | Director PM (Persona) | Consultor (Persona) |
Gasto Proyecto (Persona) | Administración (Persona) | Comité (Persona) |
Fecha Factura | Fecha Pago Proyectada | Estatus Factura | Rol Asignado
```

## Lógica de distribución por rol
Los montos por rol se **calculan automáticamente** desde el Total con la regla fija:
- Vendedor: **15%**
- Director PM: **18%**
- Consultor: **50%**
- Gasto Proyecto: **3%**
- Administración: **4%**
- Comité: **10%**

## Publicación
1. Sube estos archivos a un repo.
2. Activa **GitHub Pages** (branch `main`, root).
3. Abre la URL pública. El dashboard leerá los datos desde el Apps Script.

> Si cambias la URL del Web App, edita `config.js`.
