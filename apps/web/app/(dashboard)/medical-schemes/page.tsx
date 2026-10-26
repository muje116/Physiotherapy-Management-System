'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Loader2, Building2, FileText, CheckCircle, XCircle, Send } from 'lucide-react';
import api from '@/lib/api';

interface MedicalScheme {
  id: string; name: string; code: string; tariffVersion: string; contactNumber: string; email: string; isActive: boolean;
}

interface Claim {
  id: string;
  patientName: string;
  schemeName: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  submittedDate: string;
  responseDate: string;
}

interface ClaimsReport {
  approvalRate: string; totalSubmitted: number; approvedAmount: number;
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
  amount: number;
  status: string;
}

const CLAIM_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAID', label: 'Paid' },
];

const SCHEME_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function formatDate(value?: string | null) {
  return value ? new Date(value).toISOString().split('T')[0] : '';
}

export default function MedicalSchemesPage() {
  const [schemes, setSchemes] = useState<MedicalScheme[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [report, setReport] = useState<ClaimsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [schemeDialog, setSchemeDialog] = useState(false);
  const [editingScheme, setEditingScheme] = useState<MedicalScheme | null>(null);
  const [schemeName, setSchemeName] = useState('');
  const [schemeCode, setSchemeCode] = useState('');
  const [schemeTariff, setSchemeTariff] = useState('');
  const [schemeContact, setSchemeContact] = useState('');
  const [saving, setSaving] = useState(false);

  const [claimStatusFilter, setClaimStatusFilter] = useState('');
  const [claimSchemeFilter, setClaimSchemeFilter] = useState('');
  const [claimDateFrom, setClaimDateFrom] = useState('');
  const [claimDateTo, setClaimDateTo] = useState('');
  const [claimDialog, setClaimDialog] = useState(false);
  const [claimSaving, setClaimSaving] = useState(false);
  const [claimPatientId, setClaimPatientId] = useState('');
  const [claimSchemeId, setClaimSchemeId] = useState('');
  const [claimInvoiceId, setClaimInvoiceId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimTariffCode, setClaimTariffCode] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/medical-schemes'),
      api.get('/medical-schemes/claims'),
      api.get('/medical-schemes/claims/report'),
      api.get('/patients', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get('/invoices', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
    ]).then(([sRes, cRes, rRes, pRes, iRes]) => {
      setSchemes((sRes.data.data || []).map((scheme: any) => ({
        ...scheme,
        tariffVersion: scheme.tariffVersion || '',
        contactNumber: scheme.contactNumber || '',
        email: scheme.email || '',
      })));
      setClaims((cRes.data.data || []).map((claim: any) => ({
        id: claim.id,
        patientName: claim.patient ? `${claim.patient.firstName} ${claim.patient.lastName}` : claim.patientId,
        schemeName: claim.scheme?.name || claim.schemeId,
        invoiceNumber: claim.invoice?.invoiceNumber || '-',
        amount: Number(claim.amount || 0),
        status: claim.status,
        submittedDate: formatDate(claim.submittedAt || claim.createdAt),
        responseDate: formatDate(claim.responseAt),
      })));
      setReport(rRes.data.data || null);
      setPatients((pRes.data.data || []).map((patient: any) => ({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        patientCode: patient.patientCode,
      })));
      setInvoices((iRes.data.data || []).map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientId: invoice.patientId,
        amount: Number(invoice.total || 0),
        status: invoice.status,
      })));
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetSchemeForm = () => {
    setSchemeName('');
    setSchemeCode('');
    setSchemeTariff('');
    setSchemeContact('');
    setEditingScheme(null);
  };

  const openNewScheme = () => { resetSchemeForm(); setSchemeDialog(true); };

  const openEditScheme = (s: MedicalScheme) => {
    setEditingScheme(s);
    setSchemeName(s.name);
    setSchemeCode(s.code);
    setSchemeTariff(s.tariffVersion);
    setSchemeContact(s.contactNumber);
    setSchemeDialog(true);
  };

  const saveScheme = async () => {
    setSaving(true);
    try {
      const payload = { name: schemeName, code: schemeCode, tariffVersion: schemeTariff, contactNumber: schemeContact };
      if (editingScheme) {
        await api.patch(`/medical-schemes/${editingScheme.id}`, payload);
      } else {
        await api.post('/medical-schemes', payload);
      }
      setSchemeDialog(false);
      resetSchemeForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteScheme = async (id: string) => {
    try {
      await api.delete(`/medical-schemes/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleScheme = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/medical-schemes/${id}`, { isActive });
      setSchemes(prev => prev.map(s => s.id === id ? { ...s, isActive } : s));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submitClaim = async (id: string) => {
    try {
      await api.post(`/medical-schemes/claims/${id}/submit`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateClaimStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/medical-schemes/claims/${id}/status`, { status });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetClaimForm = () => {
    setClaimPatientId('');
    setClaimSchemeId('');
    setClaimInvoiceId('');
    setClaimAmount('');
    setClaimTariffCode('');
    setClaimNotes('');
  };

  const openNewClaim = () => {
    resetClaimForm();
    setClaimDialog(true);
  };

  const selectClaimInvoice = (invoiceId: string) => {
    setClaimInvoiceId(invoiceId);
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (invoice) {
      setClaimPatientId(invoice.patientId);
      setClaimAmount(invoice.amount.toFixed(2));
    }
  };

  const selectClaimPatient = (patientId: string) => {
    setClaimPatientId(patientId);
    if (claimInvoiceId && invoices.find((invoice) => invoice.id === claimInvoiceId)?.patientId !== patientId) {
      setClaimInvoiceId('');
    }
  };

  const saveClaim = async () => {
    const amount = Number(claimAmount);
    if (!claimPatientId || !claimSchemeId || !Number.isFinite(amount) || amount <= 0) {
      setError('Select a patient and scheme, then enter a claim amount greater than zero.');
      return;
    }

    setClaimSaving(true);
    setError(null);
    try {
      await api.post('/medical-schemes/claims', {
        patientId: claimPatientId,
        schemeId: claimSchemeId,
        invoiceId: claimInvoiceId || undefined,
        amount,
        tariffCode: claimTariffCode.trim() || undefined,
        notes: claimNotes.trim() || undefined,
      });
      setClaimDialog(false);
      resetClaimForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setClaimSaving(false);
    }
  };

  const filteredClaims = claims.filter(c => {
    if (claimStatusFilter && c.status !== claimStatusFilter) return false;
    if (claimSchemeFilter && c.schemeName !== claimSchemeFilter) return false;
    if (claimDateFrom && c.submittedDate < claimDateFrom) return false;
    if (claimDateTo && c.submittedDate > claimDateTo) return false;
    return true;
  });

  const claimableInvoices = invoices.filter((invoice) =>
    !['PAID', 'VOID', 'MEDICAL_AID_APPROVED'].includes(invoice.status)
    && (!claimPatientId || invoice.patientId === claimPatientId),
  );

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Medical Schemes</h1>
        <p className="text-muted-foreground">Manage medical aid schemes and claims</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {report && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{report.approvalRate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Submitted</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{report.totalSubmitted.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved Amount</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">R {report.approvedAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={claimDialog} onOpenChange={setClaimDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Create Medical-aid Claim</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select
                options={patients.map((patient) => ({
                  value: patient.id,
                  label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})`,
                }))}
                value={claimPatientId}
                onChange={(event) => selectClaimPatient(event.target.value)}
                placeholder="Select patient"
              />
            </div>
            <div className="space-y-2">
              <Label>Medical scheme</Label>
              <Select
                options={schemes.filter((scheme) => scheme.isActive).map((scheme) => ({ value: scheme.id, label: scheme.name }))}
                value={claimSchemeId}
                onChange={(event) => setClaimSchemeId(event.target.value)}
                placeholder="Select scheme"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice (optional)</Label>
              <Select
                options={claimableInvoices.map((invoice) => ({
                  value: invoice.id,
                  label: `${invoice.invoiceNumber} - R ${invoice.amount.toLocaleString()}`,
                }))}
                value={claimInvoiceId}
                onChange={(event) => selectClaimInvoice(event.target.value)}
                placeholder="No linked invoice"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Claim amount</Label>
                <Input type="number" min="0.01" step="0.01" value={claimAmount} onChange={(event) => setClaimAmount(event.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Tariff code</Label>
                <Input value={claimTariffCode} onChange={(event) => setClaimTariffCode(event.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={claimNotes} onChange={(event) => setClaimNotes(event.target.value)} rows={3} placeholder="Optional claim notes" />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline" disabled={claimSaving}>Cancel</Button></DialogClose>
              <Button onClick={() => void saveClaim()} disabled={claimSaving}>
                {claimSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create claim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="schemes">
        <TabsList>
          <TabsTrigger value="schemes">Schemes</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="schemes">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{schemes.length} scheme(s)</p>
            <Dialog open={schemeDialog} onOpenChange={setSchemeDialog}>
              <DialogTrigger asChild>
                <Button onClick={openNewScheme}><Plus className="h-4 w-4 mr-2" /> Add Scheme</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingScheme ? 'Edit Scheme' : 'Add Medical Scheme'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Scheme Name</Label>
                    <Input value={schemeName} onChange={(e) => setSchemeName(e.target.value)} placeholder="e.g. Discovery Health" />
                  </div>
                  <div className="space-y-2">
                    <Label>Scheme Code</Label>
                    <Input value={schemeCode} onChange={(e) => setSchemeCode(e.target.value)} placeholder="e.g. DISC-HLTH" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tariff Version</Label>
                    <Input value={schemeTariff} onChange={(e) => setSchemeTariff(e.target.value)} placeholder="e.g. 2024.1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input value={schemeContact} onChange={(e) => setSchemeContact(e.target.value)} placeholder="Contact name / number" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline" onClick={resetSchemeForm}>Cancel</Button></DialogClose>
                    <Button onClick={saveScheme} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {editingScheme ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Tariff Version</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemes.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="outline">{s.code}</Badge></TableCell>
                      <TableCell>{s.tariffVersion}</TableCell>
                      <TableCell>{s.contactNumber || '-'}</TableCell>
                      <TableCell>
                        <Switch checked={s.isActive} onCheckedChange={(checked) => toggleScheme(s.id, checked)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditScheme(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteScheme(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {schemes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schemes found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Claims</h2>
              <p className="text-sm text-muted-foreground">Track submissions and record funder responses.</p>
            </div>
            <Button onClick={openNewClaim}><Plus className="mr-2 h-4 w-4" /> New Claim</Button>
          </div>
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Status</Label>
                  <Select options={CLAIM_STATUS_OPTIONS} value={claimStatusFilter} onChange={(e) => setClaimStatusFilter(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Scheme</Label>
                  <Select
                    options={[{ value: '', label: 'All Schemes' }, ...schemes.map(s => ({ value: s.name, label: s.name }))]}
                    value={claimSchemeFilter}
                    onChange={(e) => setClaimSchemeFilter(e.target.value)}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={claimDateFrom} onChange={(e) => setClaimDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={claimDateTo} onChange={(e) => setClaimDateTo(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Response Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.patientName}</TableCell>
                      <TableCell>{c.schemeName}</TableCell>
                      <TableCell>{c.invoiceNumber}</TableCell>
                      <TableCell>R {c.amount.toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>{c.submittedDate || '-'}</TableCell>
                      <TableCell>{c.responseDate || '-'}</TableCell>
                      <TableCell className="text-right">
                        {(c.status === 'DRAFT' || c.status === 'REJECTED') && (
                          <Button variant="outline" size="sm" onClick={() => submitClaim(c.id)}>
                            <Send className="h-3 w-3 mr-1" /> {c.status === 'REJECTED' ? 'Resubmit' : 'Submit'}
                          </Button>
                        )}
                        {c.status === 'SUBMITTED' && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-green-600" onClick={() => updateClaimStatus(c.id, 'APPROVED')}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600" onClick={() => updateClaimStatus(c.id, 'REJECTED')}>
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        {c.status === 'ACKNOWLEDGED' && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-green-600" onClick={() => updateClaimStatus(c.id, 'APPROVED')}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600" onClick={() => updateClaimStatus(c.id, 'REJECTED')}>
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        {c.status === 'APPROVED' && (
                          <Button variant="outline" size="sm" className="text-blue-600" onClick={() => updateClaimStatus(c.id, 'PAID')}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredClaims.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No claims found</TableCell></TableRow>
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
