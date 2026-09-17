'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Loader2, CreditCard, DollarSign, TrendingUp } from 'lucide-react';
import api from '@/lib/api';

interface PaymentMethod {
  id: string; name: string; type: string; feePercent: number; isActive: boolean;
}

interface Payment {
  id: string; date: string; patientName: string; invoiceNumber: string; amount: number; method: string; methodType: string; reference: string; status: string;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  patientCode: string;
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  patientId: string;
  total: number;
  status: string;
}

interface PaymentSummary {
  todayTotal: number;
  allTimeTotal: number;
  byMethod: { method: string; total: number; count: number }[];
}

const METHOD_TYPE_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'EFT', label: 'EFT' },
  { value: 'DEBIT_ORDER', label: 'Debit Order' },
  { value: 'MEDICAL_AID', label: 'Medical Aid' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export default function PaymentsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [methodDialog, setMethodDialog] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [methodName, setMethodName] = useState('');
  const [methodType, setMethodType] = useState('');
  const [methodFee, setMethodFee] = useState('');
  const [saving, setSaving] = useState(false);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentPatientId, setPaymentPatientId] = useState('');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentMethodName, setPaymentMethodName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const formatDate = (value?: string | null) => (value ? new Date(value).toISOString().split('T')[0] : '');

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/payments/methods'),
      api.get('/payments'),
      api.get('/payments/summary'),
      api.get('/patients', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get('/invoices', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
    ]).then(([mRes, pRes, sRes, patientsRes, invoicesRes]) => {
      setMethods(mRes.data.data || []);
      setPayments((pRes.data.data || []).map((payment: any) => ({
        id: payment.id,
        date: formatDate(payment.paidAt || payment.createdAt),
        patientName: payment.patient ? `${payment.patient.firstName} ${payment.patient.lastName}` : payment.patientId,
        invoiceNumber: payment.invoice?.invoiceNumber || '-',
        amount: Number(payment.amount || 0),
        method: payment.methodName || payment.paymentMethod?.type || 'OTHER',
        methodType: payment.paymentMethod?.type || payment.methodName || 'OTHER',
        reference: payment.reference || '',
        status: payment.status,
      })));
      setSummary(sRes.data.data ? {
        todayTotal: Number(sRes.data.data.todayCollections || 0),
        allTimeTotal: Number(sRes.data.data.totalCollected || 0),
         byMethod: sRes.data.data.byMethod || [],
       } : null);
      setPatients((patientsRes.data.data || []).map((patient: any) => ({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        patientCode: patient.patientCode,
      })));
      setInvoices((invoicesRes.data.data || []).map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientId: invoice.patientId,
        total: Number(invoice.total || 0),
        status: invoice.status,
      })));
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetMethodForm = () => {
    setMethodName('');
    setMethodType('');
    setMethodFee('');
    setEditingMethod(null);
  };

  const openNewMethod = () => { resetMethodForm(); setMethodDialog(true); };

  const resetPaymentForm = () => {
    setPaymentPatientId('');
    setPaymentInvoiceId('');
    setPaymentAmount('');
    setPaymentMethodId('');
    setPaymentMethodName('');
    setPaymentReference('');
    setPaymentNotes('');
  };

  const openNewPayment = () => {
    resetPaymentForm();
    setPaymentDialog(true);
  };

  const handleInvoiceChange = (invoiceId: string) => {
    setPaymentInvoiceId(invoiceId);
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;

    setPaymentPatientId(invoice.patientId);
    setPaymentAmount(String(invoice.total));
  };

  const savePayment = async () => {
    if (!paymentPatientId || !paymentAmount || Number(paymentAmount) <= 0) {
      setError('Select a patient and enter a payment amount greater than zero.');
      return;
    }

    setPaymentSaving(true);
    setError(null);
    try {
      await api.post('/payments', {
        patientId: paymentPatientId,
        invoiceId: paymentInvoiceId || undefined,
        amount: Number(paymentAmount),
        paymentMethodId: paymentMethodId || undefined,
        methodName: paymentMethodId ? undefined : paymentMethodName || undefined,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      setPaymentDialog(false);
      resetPaymentForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const openEditMethod = (m: PaymentMethod) => {
    setEditingMethod(m);
    setMethodName(m.name);
    setMethodType(m.type);
    setMethodFee(String(m.feePercent || 0));
    setMethodDialog(true);
  };

  const saveMethod = async () => {
    setSaving(true);
    try {
      const payload = { name: methodName, type: methodType, feePercent: parseFloat(methodFee) || 0 };
      if (editingMethod) {
        await api.patch(`/payments/methods/${editingMethod.id}`, payload);
      } else {
        await api.post('/payments/methods', payload);
      }
      setMethodDialog(false);
      resetMethodForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/payments/methods/${id}`, { isActive });
      setMethods(prev => prev.map(m => m.id === id ? { ...m, isActive } : m));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteMethod = async (id: string) => {
    try {
      await api.delete(`/payments/methods/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (filterMethod && p.method !== filterMethod && p.methodType !== filterMethod) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    return true;
  });

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Record collections, manage payment methods, and review payment history</p>
          </div>
          <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
            <DialogTrigger asChild>
              <Button onClick={openNewPayment}><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Patient</Label>
                  <Select
                    options={patients.map((patient) => ({
                      value: patient.id,
                      label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})`,
                    }))}
                    value={paymentPatientId}
                    onChange={(event) => setPaymentPatientId(event.target.value)}
                    placeholder="Select patient"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Invoice (optional)</Label>
                  <Select
                    options={invoices
                      .filter((invoice) => !['PAID', 'VOID'].includes(invoice.status))
                      .map((invoice) => ({
                        value: invoice.id,
                        label: `${invoice.invoiceNumber} - R ${invoice.total.toLocaleString()} (${invoice.status.replace(/_/g, ' ')})`,
                      }))}
                    value={paymentInvoiceId}
                    onChange={(event) => handleInvoiceChange(event.target.value)}
                    placeholder="Unallocated payment"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    options={[{ value: '', label: 'Other / manual' }, ...methods.filter((method) => method.isActive).map((method) => ({ value: method.id, label: method.name }))]}
                    value={paymentMethodId}
                    onChange={(event) => setPaymentMethodId(event.target.value)}
                  />
                </div>
                {!paymentMethodId && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Manual Method Name</Label>
                    <Input value={paymentMethodName} onChange={(event) => setPaymentMethodName(event.target.value)} placeholder="e.g. Cash or bank transfer" />
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Reference / Receipt Number</Label>
                  <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional transaction reference" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} rows={3} placeholder="Optional payment notes" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline" disabled={paymentSaving}>Cancel</Button></DialogClose>
                <Button onClick={savePayment} disabled={paymentSaving}>
                  {paymentSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Record Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">R {summary.todayTotal.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">All Time Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">R {summary.allTimeTotal.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Breakdown by Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {summary.byMethod.map(bm => (
                  <div key={bm.method} className="flex items-center justify-between text-sm">
                    <span>{bm.method.replace(/_/g, ' ')}</span>
                    <span className="font-medium">R {bm.total.toLocaleString()} ({bm.count} txns)</span>
                  </div>
                ))}
                {summary.byMethod.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="methods">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{methods.length} method(s)</p>
            <Dialog open={methodDialog} onOpenChange={setMethodDialog}>
              <DialogTrigger asChild>
                <Button onClick={openNewMethod}><Plus className="h-4 w-4 mr-2" /> Add Method</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingMethod ? 'Edit Method' : 'Add Payment Method'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={methodName} onChange={(e) => setMethodName(e.target.value)} placeholder="e.g. Visa Credit Card" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select options={METHOD_TYPE_OPTIONS} value={methodType} onChange={(e) => setMethodType(e.target.value)} placeholder="Select type" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fee Percentage</Label>
                    <Input type="number" step="0.01" value={methodFee} onChange={(e) => setMethodFee(e.target.value)} placeholder="e.g. 2.5" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline" onClick={resetMethodForm}>Cancel</Button></DialogClose>
                    <Button onClick={saveMethod} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {editingMethod ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {methods.map(m => (
              <Card key={m.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
                  </div>
                  <Switch checked={m.isActive} onCheckedChange={(checked) => toggleMethod(m.id, checked)} />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="outline">{m.type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee</span>
                    <span>{m.feePercent || 0}%</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditMethod(m)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => deleteMethod(m.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {methods.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">No payment methods configured</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Method</Label>
                  <Select options={[{ value: '', label: 'All Methods' }, ...METHOD_TYPE_OPTIONS]} value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Status</Label>
                  <Select options={PAYMENT_STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-medium">{p.patientName}</TableCell>
                      <TableCell>{p.invoiceNumber}</TableCell>
                      <TableCell>R {p.amount.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{p.method.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell>{p.reference || '-'}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                  {filteredPayments.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payments found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
