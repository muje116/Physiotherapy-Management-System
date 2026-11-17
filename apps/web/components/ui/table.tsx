'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Copy, FileDown, FileSpreadsheet, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeRichText } from '@/components/ui/textarea';

type TableProps = React.TableHTMLAttributes<HTMLTableElement>;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function dataRows(table: HTMLTableElement) {
  return Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))
    .filter((row) => !row.querySelector('td[colspan]'));
}

function cleanTable(table: HTMLTableElement) {
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone.querySelectorAll('tbody tr').forEach((row) => {
    if (row.querySelector('td[colspan]')) row.remove();
    row.removeAttribute('hidden');
    row.removeAttribute('style');
  });
  return clone;
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readCell(cell: HTMLTableCellElement) {
  const raw = cell.innerText || cell.textContent || '';
  if (/<\/?(?:p|br|strong|b|em|i|u|ul|ol|li|h2|h3|blockquote)(?:\s|>)/i.test(raw)) {
    const content = document.createElement('div');
    content.innerHTML = sanitizeRichText(raw);
    return (content.innerText || content.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return raw.replace(/\s+/g, ' ').trim();
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, children, ...props }, forwardedRef) => {
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalRows, setTotalRows] = React.useState(0);
  const [matchedRows, setMatchedRows] = React.useState(0);

  React.useImperativeHandle(forwardedRef, () => tableRef.current as HTMLTableElement);

  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const allRows = Array.from(table.tBodies).flatMap((body) => Array.from(body.rows));
    const rows = dataRows(table);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = rows.filter((row) => !normalizedQuery || row.innerText.toLocaleLowerCase().includes(normalizedQuery));
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const activePage = Math.min(page, pages);
    const firstIndex = (activePage - 1) * pageSize;
    const visible = new Set(matches.slice(firstIndex, firstIndex + pageSize));

    allRows.forEach((row) => {
      const isEmptyMessage = row.querySelector('td[colspan]');
      row.hidden = isEmptyMessage ? Boolean(normalizedQuery) : !visible.has(row);
    });
    setTotalRows(rows.length);
    setMatchedRows(matches.length);
    if (activePage !== page) setPage(activePage);
  }, [children, query, page, pageSize]);

  const exportRows = () => tableRef.current ? dataRows(tableRef.current) : [];
  const filename = `table-${new Date().toISOString().slice(0, 10)}`;

  const copyTable = async () => {
    const table = tableRef.current;
    if (!table) return;
    const header = table.tHead?.rows[0];
    const lines = [
      ...(header ? [Array.from(header.cells, readCell).join('\t')] : []),
      ...exportRows().map((row) => Array.from(row.cells, readCell).join('\t')),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
  };

  const exportCsv = () => {
    const table = tableRef.current;
    if (!table) return;
    const header = table.tHead?.rows[0];
    const rows = [
      ...(header ? [Array.from(header.cells, readCell)] : []),
      ...exportRows().map((row) => Array.from(row.cells, readCell)),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadFile(`${filename}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  };

  const exportExcel = () => {
    const table = tableRef.current;
    if (!table) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${cleanTable(table).outerHTML}</body></html>`;
    downloadFile(`${filename}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
  };

  const exportPdf = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = cleanTable(table).outerHTML;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Table export</title><style>body{font:12px Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left}thead{display:table-header-group}tr{page-break-inside:avoid}@media print{body{padding:0}}</style></head><body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const totalPages = Math.max(1, Math.ceil(matchedRows / pageSize));
  const firstVisible = matchedRows ? (page - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(page * pageSize, matchedRows);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-2">
        <label className="flex min-w-[190px] flex-1 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm text-muted-foreground sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input aria-label="Search table rows" className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search table…" />
        </label>
        <div className="flex flex-wrap items-center gap-1">
          <ActionButton label="Copy" onClick={() => void copyTable()}><Copy className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="Excel" onClick={exportExcel}><FileSpreadsheet className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="CSV" onClick={exportCsv}><FileDown className="h-3.5 w-3.5" /></ActionButton>
          <ActionButton label="PDF" onClick={exportPdf}><FileDown className="h-3.5 w-3.5" /></ActionButton>
        </div>
      </div>
      <div className="relative w-full overflow-auto">
        <table ref={tableRef} className={cn('w-full caption-bottom text-sm', className)} {...props}>{children}</table>
        {totalRows > 0 && matchedRows === 0 && query.trim() && <div className="border-b p-6 text-center text-sm text-muted-foreground">No rows match “{query}”.</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select aria-label="Rows per page" className="h-8 rounded-md border bg-background px-2 text-foreground" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>Showing {firstVisible}–{lastVisible} of {matchedRows}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Page {Math.min(page, totalPages)} of {totalPages}</span>
          <button type="button" className="rounded-md border bg-background p-1.5 text-foreground disabled:opacity-40" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className="rounded-md border bg-background p-1.5 text-foreground disabled:opacity-40" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
});
Table.displayName = 'Table';

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted" title={`Export or ${label.toLowerCase()} table`}><span>{children}</span>{label}</button>;
}

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />);
TableHeader.displayName = 'TableHeader';
const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />);
TableBody.displayName = 'TableBody';
const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <tfoot ref={ref} className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />);
TableFooter.displayName = 'TableFooter';
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => <tr ref={ref} className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />);
TableRow.displayName = 'TableRow';
const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => <th ref={ref} className={cn('h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', className)} {...props} />);
TableHead.displayName = 'TableHead';
const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => <td ref={ref} className={cn('p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', className)} {...props} />);
TableCell.displayName = 'TableCell';
const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />);
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
