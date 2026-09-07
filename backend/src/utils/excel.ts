import ExcelJS from 'exceljs';

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

const headerKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const cellText = (value: unknown): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text.trim();
    if (typeof record.richText === 'object' && Array.isArray(record.richText)) {
      return record.richText.map((part: { text?: string }) => part.text || '').join('').trim();
    }
    if (typeof record.result !== 'undefined') return cellText(record.result);
    if (typeof record.hyperlink === 'string') return String(record.text || record.hyperlink);
  }
  return String(value).trim();
};

export const cellNumber = (value: unknown, fallback = 0) => {
  const text = cellText(value).replace(/,/g, '');
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const cellBoolean = (value: unknown) => {
  const text = cellText(value).toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'y';
};

export const buildSampleWorkbook = async (
  sheetName: string,
  columns: ExcelColumn[],
  sampleRows: Record<string, unknown>[],
  instructions: string[]
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SAS ERP';
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 18
  }));
  sheet.getRow(1).font = { bold: true };
  sampleRows.forEach((row) => sheet.addRow(row));

  const help = workbook.addWorksheet('Instructions');
  help.getColumn(1).width = 110;
  help.getCell('A1').value = 'How to use this file';
  help.getCell('A1').font = { bold: true, size: 14 };
  instructions.forEach((line, index) => {
    help.getCell(`A${index + 3}`).value = line;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const readSheetRows = async (buffer: Buffer, maxRows = 500) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('The Excel file has no worksheets.');
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = headerKey(cell.value);
  });

  const rows: Array<{ rowNumber: number; data: Record<string, string> }> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= maxRows) return;
    const data: Record<string, string> = {};
    let empty = true;
    headers.forEach((key, colNumber) => {
      if (!key) return;
      const text = cellText(row.getCell(colNumber).value);
      if (text) empty = false;
      data[key] = text;
    });
    if (!empty) {
      rows.push({ rowNumber, data });
    }
  });

  return rows;
};

export const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[headerKey(key)];
    if (value) return value;
  }
  return '';
};
