# Dashboard Financiero v8.1

## Overview
A financial dashboard application that connects to Google Sheets to display financial data, including invoicing, payments, debt tracking, and financial planning. Built with vanilla HTML, CSS, and JavaScript.

**Purpose**: Track and visualize financial data including assigned income by owner, billing status, debt projection, and financial planning charts.

**Language**: Spanish (UI and documentation)

## Project Architecture

### Frontend Structure
- **index.html**: Main HTML structure with filters, KPI cards, charts, and tables
- **styles.css**: Complete styling with dark theme and responsive grid layouts
- **script.js**: Core application logic including data fetching, filtering, calculations, and chart rendering
- **config.js**: Configuration file containing Google Sheets Web App URL
- **server.py**: Simple Python HTTP server to serve static files on port 5000

### Key Features
1. **Dynamic Filters**: Year of billing, year of payment, invoice status, and owner (including "Equipo H&A" team)
2. **KPIs**: 
   - Assigned income breakdown by role (Seller 15%, Director PMO 18%, Consultant 50%, Project expenses 3%, Administration 4%, Committee 10%)
   - Billing status (paid, unpaid, not invoiced)
   - Retention and net income calculations (14.5% retention)
3. **Financial Debt Tracking**: 12-month projection with base debt of $31,000,000 and monthly charge of $6,000,000
4. **Planning Charts**: 6-month forward view and yearly view using Chart.js
5. **Invoice Lists**: Detailed listings of paid and pending invoices

### Data Source
- Connects to Google Sheets via Web App URL (configured in config.js)
- Fetches data via REST API call with no-cache policy
- Parses CSV-like data structure with flexible header matching

## Technical Setup

### Server Configuration
- **Web Server**: Python 3.11 HTTP server binding to 0.0.0.0:5000
- **Cache Control**: Disabled caching for development (no-cache headers)
- **Workflow**: Configured to run `python3 server.py` with webview output

### Dependencies
- **Chart.js 4.4.1**: Bar charts for financial planning visualization
- **ChartDataLabels 2.2.0**: Data labels on charts
- Loaded via CDN (no npm/package.json required)

### Port Configuration
- Frontend server: Port 5000 (required for Replit webview)
- No backend component

## Data Calculation Logic

### Income Assignment
- **Ingreso asignado (Bruto por Owner)**: Sum of percentage-based roles assigned to selected owner
- Roles split: Vendedor (15%), Director PMO (18%), Consultor (50%), Gasto Proyecto (3%), Administración (4%), Comité (10%)
- Total project amount is distributed across these roles, then filtered by owner

### Retention and Net Income
- **Previsión (Retención 14.5%)**: Applied to assigned income
- **Ingreso líquido**: Assigned income - 14.5%

### Debt Calculation
- Base debt: $31,000,000
- Monthly charge: $6,000,000
- Monthly reduction: Net income from "Equipo H&A" on paid invoices (85.5% of assigned amount)
- 12-month forward projection

## Recent Changes
- **2025-11-26**: Added "Salud Financiera" section (renamed from "Deuda Financiera")
  - Added "Ingresos bruto Equipo H&A" KPI (sum of all paid invoices assigned to Equipo H&A)
  - Added "Ingreso real Equipo H&A después de impuestos SII" KPI (bruto - 14.5%)
  - Added gauge chart showing debt status with color thresholds:
    - Green: < $10M CLP (healthy)
    - Yellow: $10M - $30M CLP (caution)
    - Red: >= $30M CLP (critical, max $50M)
  - Debt calculation now includes all paid H&A income from any month
  - Monthly charges of $6M start from December 2025

- **2025-11-26**: Updated Status facturación section
  - Renamed "Monto total pagado (asignado)" to "Facturas emitidas - pagadas"
  - Renamed "Monto total no pagado (asignado)" to "Facturas emitidas - no pagadas"
  - Changed calculation for "Facturas emitidas - no pagadas" to use "Total Factura Proyecto (Bruto)" column for rows with status "Emitida"

- **2025-11-26**: Added Cliente and Proyecto filters
  - Added "Cliente" and "Proyecto" filter dropdowns to the Filtros section
  - Both filters are populated dynamically from Google Sheets data
  - Updated CSS grid to use auto-fit for responsive filter layout
  - Updated JavaScript to populate and apply new filters in data filtering logic

- **2025-11-26**: Initial Replit setup
  - Created Python HTTP server with cache-control headers
  - Configured workflow for port 5000 webview
  - Added .gitignore for Python environment
  - Created project documentation (replit.md)

## Development Notes
- This is a static frontend application with no build process
- Data is fetched from external Google Sheets Web App
- No authentication required for data access
- All calculations performed client-side
- Dark theme optimized UI with responsive design
