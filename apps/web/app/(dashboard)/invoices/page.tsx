'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Download, Eye, Loader2, CheckCircle2, Send } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patient: string;
  amount: number;
  date: string;
  due: string;
  status: string;
}

interface InvoiceLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface InvoiceDetail extends InvoiceRow {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  paymentMethod?: string | null;
  paidAt?: string | null;
  medicalAidClaim?: Record<string, unknown> | null;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  patientCode: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  isActive: boolean;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toISOString().split('T')[0] : '-';
}

function formatMoney(value: number) {
  return `R ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mapInvoice(invoice: any): InvoiceRow {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    patientId: invoice.patientId,
    patient: invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : 'Unknown patient',
    amount: Number(invoice.total || 0),
    date: formatDate(invoice.createdAt),
    due: formatDate(invoice.dueDate),
    status: invoice.status,
  };
}

function mapInvoiceDetail(invoice: any): InvoiceDetail {
  return {
    ...mapInvoice(invoice),
    lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems.map((item: any) => ({
      description: String(item.description || 'Service'),
      qty: Number(item.qty || 0),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(item.total || 0),
    })) : [],
    subtotal: Number(invoice.subtotal || 0),
    vatAmount: Number(invoice.vatAmount || 0),
    paymentMethod: invoice.paymentMethod,
    paidAt: invoice.paidAt,
    medicalAidClaim: invoice.medicalAidClaim,
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formPatientId, setFormPatientId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnitPrice, setFormUnitPrice] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [markPaidMethod, setMarkPaidMethod] = useState('');

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/invoices', { params: { page: 1, limit: 100 } }),
      api.get('/patients', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get('/payments/methods').catch(() => ({ data: { data: [] } })),
    ])
      .then(([invoiceResponse, patientResponse, methodResponse]) => {
        setInvoices((invoiceResponse.data.data || []).map(mapInvoice));
        setPatients((patientResponse.data.data || []).map((patient: any) => ({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          patientCode: patient.patientCode,
        })));
        setMethods((methodResponse.data.data || []).map((method: any) => ({
          id: method.id,
          name: method.name,
          isActive: method.isActive,
        })));
      })
      .catch((err) => setError(err.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetCreateForm = () => {
    setFormPatientId('');
    setFormDescription('');
    setFormQuantity('1');
    setFormUnitPrice('');
    setFormDueDate('');
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const createInvoice = async () => {
    const quantity = Number(formQuantity);
    const unitPrice = Number(formUnitPrice);

    if (!formPatientId || !formDescription.trim() || quantity <= 0 || unitPrice <= 0) {
      setError('Select a patient and provide a description, quantity, and amount greater than zero.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post('/invoices', {
        patientId: formPatientId,
        lineItems: [{
          description: formDescription.trim(),
          qty: quantity,
          unitPrice,
          total: Math.round(quantity * unitPrice * 100) / 100,
        }],
        dueDate: formDueDate ? new Date(`${formDueDate}T23:59:59`).toISOString() : undefined,
      });
      setCreateOpen(false);
      resetCreateForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const openInvoice = async (row: InvoiceRow) => {
    setBusyAction(row.id);
    setSelectedInvoice({ ...row, lineItems: [], subtotal: 0, vatAmount: 0 });
    setViewOpen(true);
    try {
      const response = await api.get(`/invoices/${row.id}`);
      setSelectedInvoice(mapInvoiceDetail(response.data.data));
    } catch (err: any) {
      setViewOpen(false);
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const downloadInvoice = async (row: InvoiceRow) => {
    setBusyAction(`download-${row.id}`);
    setError(null);
    try {
      const response = await api.get(`/invoices/${row.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${row.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const sendInvoice = async (row: InvoiceRow) => {
    setBusyAction(`send-${row.id}`);
    setError(null);
    try {
      await api.post(`/invoices/${row.id}/send`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const openMarkPaid = (invoice: InvoiceRow | InvoiceDetail) => {
    setSelectedInvoice('lineItems' in invoice ? invoice : { ...invoice, lineItems: [], subtotal: 0, vatAmount: 0 });
    setMarkPaidMethod('');
    setViewOpen(false);
    setMarkPaidOpen(true);
  };

  const markPaid = async () => {
    if (!selectedInvoice) return;

    setBusyAction(`paid-${selectedInvoice.id}`);
    setError(null);
    try {
      const response = await api.post(`/invoices/${selectedInvoice.id}/mark-paid`, {
        paymentMethod: markPaidMethod || undefined,
      });
      setMarkPaidOpen(false);
      setSelectedInvoice(mapInvoiceDetail(response.data.data));
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const filtered = invoices.filter((invoice) => {
    const matchesSearch = !search
      || invoice.patient.toLowerCase().includes(search.toLowerCase())
      || invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (error && invoices.length === 0) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Create invoices, manage billing, and record payments</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Invoice
        </Button>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select
                options={patients.map((patient) => ({ value: patient.id, label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})` }))}
                value={formPatientId}
                onChange={(event) => setFormPatientId(event.target.value)}
                placeholder="Select patient"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDescription} onChange={(event) => setFormDescription(event.target.value)} placeholder="e.g. Physiotherapy consultation" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" step="1" value={formQuantity} onChange={(event) => setFormQuantity(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input type="number" min="0.01" step="0.01" value={formUnitPrice} onChange={(event) => setFormUnitPrice(event.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={formDueDate} onChange={(event) => setFormDueDate(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline" disabled={saving}>Cancel</Button></DialogClose>
              <Button onClick={createInvoice} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedInvoice?.invoiceNumber || 'Invoice details'}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-5">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Patient</p><p className="font-medium">{selectedInvoice.patient}</p></div>
                <div><p className="text-muted-foreground">Status</p><StatusBadge status={selectedInvoice.status} /></div>
                <div><p className="text-muted-foreground">Due date</p><p className="font-medium">{selectedInvoice.due}</p></div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedInvoice.lineItems.map((item, index) => (
                    <TableRow key={`${item.description}-${index}`}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.total)}</TableCell>
                    </TableRow>
                  ))}
                  {selectedInvoice.lineItems.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Loading invoice details...</TableCell></TableRow>}
                </TableBody>
              </Table>
              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(selectedInvoice.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{formatMoney(selectedInvoice.vatAmount)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatMoney(selectedInvoice.amount)}</span></div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => void downloadInvoice(selectedInvoice)} disabled={busyAction === `download-${selectedInvoice.id}`}>
                  {busyAction === `download-${selectedInvoice.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download PDF
                </Button>
                {!['PAID', 'VOID'].includes(selectedInvoice.status) && (
                  <Button onClick={() => openMarkPaid(selectedInvoice)}><CheckCircle2 className="mr-2 h-4 w-4" /> Mark Paid</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Invoice Paid</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Record the outstanding balance for {selectedInvoice?.invoiceNumber} as a payment.</p>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                options={[{ value: '', label: 'Other / manual' }, ...methods.filter((method) => method.isActive).map((method) => ({ value: method.name, label: method.name }))]}
                value={markPaidMethod}
                onChange={(event) => setMarkPaidMethod(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline" disabled={busyAction === `paid-${selectedInvoice?.id}`}>Cancel</Button></DialogClose>
              <Button onClick={markPaid} disabled={busyAction === `paid-${selectedInvoice?.id}`}>
                {busyAction === `paid-${selectedInvoice?.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by invoice or patient..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select
              placeholder="All Statuses"
              options={[
                { value: 'PAID', label: 'Paid' },
                { value: 'UNPAID', label: 'Unpaid' },
                { value: 'OVERDUE', label: 'Overdue' },
                { value: 'SUBMITTED_TO_MEDICAL_AID', label: 'Submitted to medical aid' },
                { value: 'MEDICAL_AID_APPROVED', label: 'Medical aid approved' },
                { value: 'MEDICAL_AID_REJECTED', label: 'Medical aid rejected' },
                { value: 'VOID', label: 'Void' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.patient}</TableCell>
                  <TableCell>{formatMoney(invoice.amount)}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.due}</TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => void openInvoice(invoice)} disabled={busyAction === invoice.id}>
                        {busyAction === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="mr-1 h-3 w-3" />} View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void downloadInvoice(invoice)} disabled={busyAction === `download-${invoice.id}`} aria-label={`Download ${invoice.invoiceNumber}`}>
                        {busyAction === `download-${invoice.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      </Button>
                      {!['PAID', 'VOID'].includes(invoice.status) && (
                        <Button variant="ghost" size="sm" onClick={() => openMarkPaid(invoice)} disabled={busyAction === `paid-${invoice.id}`}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => void sendInvoice(invoice)} disabled={busyAction === `send-${invoice.id}`} aria-label={`Send ${invoice.invoiceNumber}`}>
                        {busyAction === `send-${invoice.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
