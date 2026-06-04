/**
 * Utility to generate Excel XML files (SpreadsheetML) client-side.
 * This format natively supports multiple sheets, column formatting, and custom colors,
 * opening correctly in Microsoft Excel, Google Sheets, and LibreOffice.
 */

interface ElectorRow {
  orden: number;
  nombre: string;
  apellido: string;
  ci: string;
  registrado: number;
  voted_at: string;
  mesa?: number;
}

const ESCAPE_CHARS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>"']/g, m => ESCAPE_CHARS[m]);
}

function formatDate(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('es-PY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/**
 * Builds a complete Excel XML spreadsheet string with one or more worksheets.
 */
function buildExcelXml(sheets: { name: string; rows: ElectorRow[] }[]): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Intelecciones</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#333333"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderSummary">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellString">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>`;

  for (const sheet of sheets) {
    const sheetName = escapeXml(sheet.name.substring(0, 31)); // Excel sheet names are capped at 31 chars
    const votedCount = sheet.rows.length;
    const registeredCount = sheet.rows.filter(r => r.registrado === 1).length;

    xml += `
 <Worksheet ss:Name="${sheetName}">
  <Table ss:ExpandedColumnCount="5" x:FullColumns="1" x:FullRows="1">
   <Column ss:Width="60"/>
   <Column ss:Width="250"/>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="160"/>
   
   <Row ss:Height="22">
    <Cell ss:MergeAcross="4" ss:StyleID="HeaderSummary">
      <Data ss:Type="String"> RESUMEN: Participantes: ${votedCount} | Registrados en Sistema: ${registeredCount} (${votedCount > 0 ? ((registeredCount / votedCount) * 100).toFixed(1) : 0}%)</Data>
    </Cell>
   </Row>
   <Row ss:Height="10"/> <!-- spacer -->
   
   <Row ss:Height="25">
    <Cell ss:StyleID="Header"><Data ss:Type="String">N° Orden</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nombre y Apellido</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">C.I. N°</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Registrado en Sistema</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Hora Comunicación (Sincronizado)</Data></Cell>
   </Row>`;

    if (sheet.rows.length === 0) {
      xml += `
   <Row ss:Height="20">
    <Cell ss:MergeAcross="4" ss:StyleID="CellCenter">
      <Data ss:Type="String">Sin registros de votantes que hayan participado aún.</Data>
    </Cell>
   </Row>`;
    } else {
      for (const row of sheet.rows) {
        const fullName = `${row.nombre || ''} ${row.apellido || ''}`.trim() || 'ELECTOR SIN NOMBRE';
        const inSystem = row.registrado === 1 ? 'SÍ (Captado)' : 'NO (Otros)';
        const formattedTime = formatDate(row.voted_at);

        xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${row.orden}</Data></Cell>
    <Cell ss:StyleID="CellString"><Data ss:Type="String">${escapeXml(fullName)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(row.ci)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(inSystem)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(formattedTime)}</Data></Cell>
   </Row>`;
      }
    }

    xml += `
  </Table>
 </Worksheet>`;
  }

  xml += `\n</Workbook>`;
  return xml;
}

/**
 * Downloads the XML content as an Excel file.
 */
function downloadFile(xmlContent: string, fileName: string) {
  const blob = new Blob([xmlContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`; // spreadsheetml is usually openable via .xls
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports detailed voter logs for a specific Mesa.
 */
export function exportMesaToExcel(localName: string, mesaNum: number, voters: ElectorRow[]) {
  const xml = buildExcelXml([{ name: `Mesa ${mesaNum}`, rows: voters }]);
  const cleanLocal = localName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  downloadFile(xml, `Votantes_${cleanLocal}_Mesa_${mesaNum}.xls`);
}

/**
 * Exports voter logs for an entire Local (creates one tab/worksheet per Mesa).
 */
export function exportLocalToExcel(localName: string, allVoters: ElectorRow[]) {
  // Group voters by mesa
  const mesasGrouped: Record<number, ElectorRow[]> = {};
  allVoters.forEach(v => {
    const m = v.mesa || 0;
    if (!mesasGrouped[m]) mesasGrouped[m] = [];
    mesasGrouped[m].push(v);
  });

  const sheets = Object.keys(mesasGrouped)
    .map(Number)
    .sort((a, b) => a - b)
    .map(mesaNum => ({
      name: `Mesa ${mesaNum}`,
      rows: mesasGrouped[mesaNum]
    }));

  // If no sheets, add a default empty sheet
  if (sheets.length === 0) {
    sheets.push({ name: 'Sin Mesas', rows: [] });
  }

  const xml = buildExcelXml(sheets);
  const cleanLocal = localName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  downloadFile(xml, `Votantes_Local_${cleanLocal}_Completo.xls`);
}
