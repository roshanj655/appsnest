import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { buildImportSample, runExcelImport, sampleFileName, type ImportKind } from '../services/excelImport';

export const downloadImportSample = (kind: ImportKind) => async (_req: TenantRequest, res: Response) => {
  try {
    const buffer = await buildImportSample(kind);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${sampleFileName(kind)}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: 'Unable to build the sample Excel file.' });
  }
};

export const importFromExcel = (kind: ImportKind) => async (req: TenantRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ message: 'Choose an .xlsx file to upload.' });
    }
    const result = await runExcelImport(kind, req, file.buffer);
    res.json({
      message: result.created
        ? `Imported ${result.created} record${result.created === 1 ? '' : 's'}.`
        : 'No records were imported.',
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ message: error?.message || 'Unable to import this Excel file.' });
  }
};
