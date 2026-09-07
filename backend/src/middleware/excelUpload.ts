import multer from 'multer';
import { NextFunction, Request, Response } from 'express';

const isExcel = (file: Express.Multer.File) => {
  const name = String(file.originalname || '').toLowerCase();
  const type = String(file.mimetype || '').toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    type.includes('spreadsheetml') ||
    type.includes('excel')
  );
};

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!isExcel(file)) {
      cb(new Error('Upload an .xlsx Excel file.'));
      return;
    }
    cb(null, true);
  }
});

export const excelFile = (req: Request, res: Response, next: NextFunction) => {
  excelUpload.single('file')(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : 'Unable to read the Excel file.';
      return res.status(400).json({ message });
    }
    next();
  });
};
