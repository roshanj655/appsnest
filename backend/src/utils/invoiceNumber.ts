export const financialYearLabel = (date = new Date()) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const start = value.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const nextFyInvoiceNumber = (
  lastNumber: string | undefined,
  prefix: string,
  date = new Date()
) => {
  const code = String(prefix || 'INV').trim().toUpperCase() || 'INV';
  const fy = financialYearLabel(date);
  const series = `${code}/${fy}/`;
  let seq = 1;
  if (lastNumber && lastNumber.startsWith(series)) {
    const parsed = parseInt(lastNumber.slice(series.length).replace(/\D/g, ''), 10);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return `${series}${String(seq).padStart(6, '0')}`;
};

export const fyInvoiceQuery = (prefix: string, date = new Date()) => {
  const code = String(prefix || 'INV').trim().toUpperCase() || 'INV';
  const fy = financialYearLabel(date);
  return new RegExp(`^${escapeRegex(code)}/${escapeRegex(fy)}/`);
};
