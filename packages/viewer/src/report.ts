/**
 * Generic display of analysis plugin reports (JSON objects): numbers, yes/no flags, sizes and
 * lists become rows; a `warnings` array is shown separately. Plugin-agnostic by design.
 */

/** A report as an analysis plugin returns it, or the error running it. */
export type Report = Record<string, unknown>;
export type Reports = Record<string, Report | { error: string }>;

export type FormattedReport = {
  rows: [label: string, value: string][];
  warnings: string[];
  error?: string;
};

/** `bedContactArea` → `bed contact area`. */
export const humanize = (key: string) =>
  key
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/[_-]+/g, ' ')
    .toLowerCase();

export function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString('en-US');
    const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 1 ? 1 : 3;
    return value.toLocaleString('en-US', { maximumFractionDigits: digits });
  }
  if (Array.isArray(value))
    return value.every((v) => typeof v === 'number')
      ? value.map((item) => formatValue(item)).join(' × ')
      : value.map((item) => formatValue(item)).join(', ');
  if (value === null || value === undefined) return '–';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function formatReport(report: Report | { error: string }): FormattedReport {
  if ('error' in report && typeof report.error === 'string' && Object.keys(report).length === 1)
    return { rows: [], warnings: [], error: report.error };
  const { warnings: raw } = report as Report;
  const warnings = Array.isArray(raw) ? raw.map(String) : [];
  const rows = Object.entries(report)
    .filter(([key]) => key !== 'warnings')
    .map(([key, value]) => [humanize(key), formatValue(value)] as [string, string]);
  return { rows, warnings };
}
