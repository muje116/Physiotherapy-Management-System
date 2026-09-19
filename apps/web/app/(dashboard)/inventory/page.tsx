'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, Boxes, ClipboardPlus, Loader2, Package, Pencil, Plus, Search, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type View = 'drugs' | 'assets';
type StockAction = 'receive' | 'issue' | 'adjust' | null;

interface Drug {
  id: string;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  unit: string;
  batchNumber: string;
  expiryDate?: string | null;
  supplier?: string | null;
  storageLocation?: string | null;
  quantityOnHand: number;
  reorderLevel: number;
  isActive: boolean;
}

interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  location?: string | null;
  status: string;
  condition: string;
  assignedTo?: { firstName: string; lastName: string; jobTitle?: string | null } | null;
}

interface Option {
  value: string;
  label: string;
}

const assetStatusOptions = [
  { value: 'IN_SERVICE', label: 'In service' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'LOST', label: 'Lost' },
];

function errorMessage(error: any) {
  return error?.response?.data?.error?.message || error?.message || 'Something went wrong';
}

function dateLabel(value?: string | null) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleDateString();
}

export default function InventoryPage() {
  const [view, setView] = useState<View>('drugs');
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState({ drugCount: 0, totalUnits: 0, lowStockCount: 0, expiringSoonCount: 0, expiredCount: 0, assetCount: 0 });
  const [patients, setPatients] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drugDialogOpen, setDrugDialogOpen] = useState(false);
  const [drugForm, setDrugForm] = useState({ name: '', genericName: '', strength: '', dosageForm: '', unit: 'unit', batchNumber: '', expiryDate: '', supplier: '', storageLocation: '', initialQuantity: '0', reorderLevel: '0', unitCost: '' });
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ assetTag: '', name: '', category: '', description: '', serialNumber: '', location: '', condition: 'GOOD', status: 'IN_SERVICE', purchaseDate: '', purchaseCost: '', warrantyExpiresAt: '', assignedToUserId: '' });
  const [stockAction, setStockAction] = useState<StockAction>(null);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: '', quantityDelta: '', patientId: '', recipientUserId: '', reason: '', reference: '', notes: '' });

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, drugsResponse, assetsResponse, patientsResponse, usersResponse] = await Promise.all([
        api.get('/inventory/summary'),
        api.get('/inventory/drugs', { params: { page: 1, limit: 100, activeOnly: false } }),
        api.get('/inventory/assets', { params: { page: 1, limit: 100 } }),
        api.get('/patients', { params: { page: 1, limit: 100, isActive: true } }).catch(() => ({ data: { data: [] } })),
        api.get('/users', { params: { page: 1, limit: 100 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(summaryResponse.data.data);
      setDrugs(drugsResponse.data.data || []);
      setAssets(assetsResponse.data.data || []);
      setPatients((patientsResponse.data.data || []).map((patient: any) => ({ value: patient.id, label: `${patient.firstName} ${patient.lastName} (${patient.patientCode})` })));
      setEmployees((usersResponse.data.data || []).filter((user: any) => user.isActive).map((user: any) => ({ value: user.id, label: `${user.firstName} ${user.lastName}${user.jobTitle ? ` - ${user.jobTitle}` : ''}` })));
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInventory();
  }, []);

  const filteredDrugs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return drugs;
    return drugs.filter((drug) => `${drug.name} ${drug.genericName || ''} ${drug.batchNumber} ${drug.supplier || ''}`.toLowerCase().includes(query));
  }, [drugs, search]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => `${asset.assetTag} ${asset.name} ${asset.category} ${asset.serialNumber || ''}`.toLowerCase().includes(query));
  }, [assets, search]);

  const resetDrugForm = () => setDrugForm({ name: '', genericName: '', strength: '', dosageForm: '', unit: 'unit', batchNumber: '', expiryDate: '', supplier: '', storageLocation: '', initialQuantity: '0', reorderLevel: '0', unitCost: '' });
  const resetAssetForm = () => setAssetForm({ assetTag: '', name: '', category: '', description: '', serialNumber: '', location: '', condition: 'GOOD', status: 'IN_SERVICE', purchaseDate: '', purchaseCost: '', warrantyExpiresAt: '', assignedToUserId: '' });
  const resetStockForm = () => setStockForm({ quantity: '', quantityDelta: '', patientId: '', recipientUserId: '', reason: '', reference: '', notes: '' });

  const createDrug = async () => {
    if (!drugForm.name.trim() || Number(drugForm.initialQuantity) < 0) {
      setError('Enter a drug name and a valid opening quantity.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/inventory/drugs', {
        ...drugForm,
        batchNumber: drugForm.batchNumber || undefined,
        expiryDate: drugForm.expiryDate ? new Date(`${drugForm.expiryDate}T00:00:00`).toISOString() : undefined,
        initialQuantity: Number(drugForm.initialQuantity),
        reorderLevel: Number(drugForm.reorderLevel),
        unitCost: drugForm.unitCost ? Number(drugForm.unitCost) : undefined,
      });
      setDrugDialogOpen(false);
      resetDrugForm();
      await fetchInventory();
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const createAsset = async () => {
    if (!assetForm.assetTag.trim() || !assetForm.name.trim() || !assetForm.category.trim()) {
      setError('Asset tag, name, and category are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/inventory/assets', {
        ...assetForm,
        purchaseDate: assetForm.purchaseDate ? new Date(`${assetForm.purchaseDate}T00:00:00`).toISOString() : undefined,
        warrantyExpiresAt: assetForm.warrantyExpiresAt ? new Date(`${assetForm.warrantyExpiresAt}T00:00:00`).toISOString() : undefined,
        purchaseCost: assetForm.purchaseCost ? Number(assetForm.purchaseCost) : undefined,
        assignedToUserId: assetForm.assignedToUserId || null,
      });
      setAssetDialogOpen(false);
      resetAssetForm();
      await fetchInventory();
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openStockAction = (action: StockAction, drug: Drug) => {
    setSelectedDrug(drug);
    resetStockForm();
    setStockAction(action);
  };

  const saveStockAction = async () => {
    if (!selectedDrug || !stockAction) return;
    setSaving(true);
    setError(null);
    try {
      if (stockAction === 'receive') {
        await api.post(`/inventory/drugs/${selectedDrug.id}/receive`, { quantity: Number(stockForm.quantity), reference: stockForm.reference || undefined, reason: stockForm.reason || undefined, notes: stockForm.notes || undefined });
      } else if (stockAction === 'adjust') {
        if (!Number(stockForm.quantityDelta)) throw new Error('Enter a non-zero stock adjustment.');
        await api.post(`/inventory/drugs/${selectedDrug.id}/adjust`, { quantityDelta: Number(stockForm.quantityDelta), reason: stockForm.reason, reference: stockForm.reference || undefined, notes: stockForm.notes || undefined });
      } else {
        if (!stockForm.patientId && !stockForm.recipientUserId) throw new Error('Select a patient or employee recipient.');
        await api.post(`/inventory/drugs/${selectedDrug.id}/issue`, { quantity: Number(stockForm.quantity), patientId: stockForm.patientId || undefined, recipientUserId: stockForm.recipientUserId || undefined, reason: stockForm.reason || undefined, reference: stockForm.reference || undefined, notes: stockForm.notes || undefined });
      }
      setStockAction(null);
      setSelectedDrug(null);
      await fetchInventory();
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const retireAsset = async (asset: Asset) => {
    if (!window.confirm(`Retire asset ${asset.assetTag}?`)) return;
    setError(null);
    try {
      await api.delete(`/inventory/assets/${asset.id}`);
      await fetchInventory();
    } catch (err: any) {
      setError(errorMessage(err));
    }
  };

  if (loading) return <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-32 animate-pulse rounded bg-muted" /><div className="h-96 animate-pulse rounded bg-muted" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory & Assets</h1>
          <p className="text-muted-foreground">Track equipment, medicine batches, stock movements, and accountability.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetAssetForm(); setAssetDialogOpen(true); }}><Archive className="mr-2 h-4 w-4" /> Add Asset</Button>
          <Button onClick={() => { resetDrugForm(); setDrugDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Drug</Button>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard icon={Package} label="Drug batches" value={summary.drugCount} />
        <SummaryCard icon={Boxes} label="Units on hand" value={summary.totalUnits} />
        <SummaryCard icon={TriangleAlert} label="Low stock" value={summary.lowStockCount} tone={summary.lowStockCount > 0 ? 'warning' : undefined} />
        <SummaryCard icon={TriangleAlert} label="Expiring / expired" value={summary.expiringSoonCount + summary.expiredCount} tone={summary.expiredCount > 0 ? 'danger' : undefined} />
        <SummaryCard icon={Archive} label="Active assets" value={summary.assetCount} />
      </div>

      <Tabs value={view} onValueChange={(value) => { setView(value as View); setSearch(''); }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList><TabsTrigger value="drugs">Drug inventory</TabsTrigger><TabsTrigger value="assets">Assets</TabsTrigger></TabsList>
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder={view === 'drugs' ? 'Search drugs or batches...' : 'Search assets...'} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>

        <TabsContent value="drugs">
          <Card>
            <CardHeader><CardTitle>Drug stock</CardTitle><CardDescription>Issue to a patient or employee and the available balance is reduced immediately.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Batch / expiry</TableHead><TableHead>Location</TableHead><TableHead>On hand</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredDrugs.map((drug) => {
                    const low = drug.quantityOnHand <= drug.reorderLevel;
                    const expired = Boolean(drug.expiryDate && new Date(drug.expiryDate) < new Date());
                    return <TableRow key={drug.id}>
                      <TableCell><div className="font-medium">{drug.name} {drug.strength || ''}</div><div className="text-xs text-muted-foreground">{drug.genericName || drug.dosageForm || 'No extra details'}</div></TableCell>
                      <TableCell><div>{drug.batchNumber}</div><div className={expired ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{dateLabel(drug.expiryDate)}</div></TableCell>
                      <TableCell>{drug.storageLocation || '-'}</TableCell>
                      <TableCell><span className={low ? 'font-semibold text-amber-600' : 'font-semibold'}>{drug.quantityOnHand} {drug.unit}</span><div className="text-xs text-muted-foreground">Reorder at {drug.reorderLevel}</div></TableCell>
                      <TableCell><StatusBadge status={!drug.isActive ? 'INACTIVE' : expired ? 'EXPIRED' : low ? 'LOW_STOCK' : 'AVAILABLE'} /></TableCell>
                      <TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => openStockAction('receive', drug)}><Package className="mr-1 h-3 w-3" /> Receive</Button><Button size="sm" onClick={() => openStockAction('issue', drug)} disabled={drug.quantityOnHand === 0}><ClipboardPlus className="mr-1 h-3 w-3" /> Issue</Button><Button size="sm" variant="ghost" onClick={() => openStockAction('adjust', drug)}><Pencil className="h-3 w-3" /></Button></div></TableCell>
                    </TableRow>;
                  })}
                  {filteredDrugs.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No drug inventory records found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader><CardTitle>Hospital assets</CardTitle><CardDescription>Keep equipment ownership, location, lifecycle status, and condition visible.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead><TableHead>Assigned to</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => <TableRow key={asset.id}>
                    <TableCell><div className="font-medium">{asset.name}</div><div className="text-xs text-muted-foreground">{asset.assetTag}</div></TableCell>
                    <TableCell>{asset.category}<div className="text-xs text-muted-foreground">{asset.condition}</div></TableCell>
                    <TableCell>{asset.location || '-'}</TableCell>
                    <TableCell>{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : 'Unassigned'}</TableCell>
                    <TableCell><StatusBadge status={asset.status} /></TableCell>
                    <TableCell className="text-right">{asset.status !== 'RETIRED' && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void retireAsset(asset)}>Retire</Button>}</TableCell>
                  </TableRow>)}
                  {filteredAssets.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No assets found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={drugDialogOpen} onOpenChange={setDrugDialogOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add drug inventory batch</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2">
          <Field label="Medicine name" value={drugForm.name} onChange={(value) => setDrugForm({ ...drugForm, name: value })} />
          <Field label="Generic name" value={drugForm.genericName} onChange={(value) => setDrugForm({ ...drugForm, genericName: value })} />
          <Field label="Strength" value={drugForm.strength} onChange={(value) => setDrugForm({ ...drugForm, strength: value })} placeholder="500 mg" />
          <Field label="Dosage form" value={drugForm.dosageForm} onChange={(value) => setDrugForm({ ...drugForm, dosageForm: value })} placeholder="Tablet" />
          <Field label="Unit" value={drugForm.unit} onChange={(value) => setDrugForm({ ...drugForm, unit: value })} />
          <Field label="Batch number" value={drugForm.batchNumber} onChange={(value) => setDrugForm({ ...drugForm, batchNumber: value })} placeholder="Optional" />
          <Field label="Opening quantity" type="number" value={drugForm.initialQuantity} onChange={(value) => setDrugForm({ ...drugForm, initialQuantity: value })} />
          <Field label="Reorder level" type="number" value={drugForm.reorderLevel} onChange={(value) => setDrugForm({ ...drugForm, reorderLevel: value })} />
          <Field label="Expiry date" type="date" value={drugForm.expiryDate} onChange={(value) => setDrugForm({ ...drugForm, expiryDate: value })} />
          <Field label="Supplier" value={drugForm.supplier} onChange={(value) => setDrugForm({ ...drugForm, supplier: value })} />
          <Field label="Storage location" value={drugForm.storageLocation} onChange={(value) => setDrugForm({ ...drugForm, storageLocation: value })} />
          <Field label="Unit cost" type="number" value={drugForm.unitCost} onChange={(value) => setDrugForm({ ...drugForm, unitCost: value })} />
        </div><div className="flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => void createDrug()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save drug</Button></div></DialogContent>
      </Dialog>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add hospital asset</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2">
          <Field label="Asset tag" value={assetForm.assetTag} onChange={(value) => setAssetForm({ ...assetForm, assetTag: value })} />
          <Field label="Asset name" value={assetForm.name} onChange={(value) => setAssetForm({ ...assetForm, name: value })} />
          <Field label="Category" value={assetForm.category} onChange={(value) => setAssetForm({ ...assetForm, category: value })} placeholder="Equipment" />
          <Field label="Serial number" value={assetForm.serialNumber} onChange={(value) => setAssetForm({ ...assetForm, serialNumber: value })} />
          <Field label="Location" value={assetForm.location} onChange={(value) => setAssetForm({ ...assetForm, location: value })} />
          <Field label="Condition" value={assetForm.condition} onChange={(value) => setAssetForm({ ...assetForm, condition: value })} />
          <div className="space-y-2"><Label>Status</Label><Select options={assetStatusOptions} value={assetForm.status} onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value })} /></div>
          <div className="space-y-2"><Label>Assigned employee</Label><Select options={[{ value: '', label: 'Unassigned' }, ...employees]} value={assetForm.assignedToUserId} onChange={(event) => setAssetForm({ ...assetForm, assignedToUserId: event.target.value })} /></div>
          <Field label="Purchase date" type="date" value={assetForm.purchaseDate} onChange={(value) => setAssetForm({ ...assetForm, purchaseDate: value })} />
          <Field label="Purchase cost" type="number" value={assetForm.purchaseCost} onChange={(value) => setAssetForm({ ...assetForm, purchaseCost: value })} />
          <Field label="Warranty expiry" type="date" value={assetForm.warrantyExpiresAt} onChange={(value) => setAssetForm({ ...assetForm, warrantyExpiresAt: value })} />
          <Field label="Description" value={assetForm.description} onChange={(value) => setAssetForm({ ...assetForm, description: value })} />
        </div><div className="flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => void createAsset()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save asset</Button></div></DialogContent>
      </Dialog>

      <Dialog open={Boolean(stockAction)} onOpenChange={(open) => { if (!open) { setStockAction(null); setSelectedDrug(null); } }}>
        <DialogContent><DialogHeader><DialogTitle>{stockAction === 'receive' ? 'Receive stock' : stockAction === 'issue' ? 'Issue medication' : 'Adjust stock'}{selectedDrug ? ` - ${selectedDrug.name}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {stockAction === 'adjust' ? <Field label="Quantity adjustment (+/-)" type="number" value={stockForm.quantityDelta} onChange={(value) => setStockForm({ ...stockForm, quantityDelta: value })} /> : <Field label="Quantity" type="number" value={stockForm.quantity} onChange={(value) => setStockForm({ ...stockForm, quantity: value })} />}
            {stockAction === 'issue' && <>
              <div className="space-y-2"><Label>Patient recipient</Label><Select options={[{ value: '', label: 'Select a patient (or use employee below)' }, ...patients]} value={stockForm.patientId} onChange={(event) => setStockForm({ ...stockForm, patientId: event.target.value, recipientUserId: '' })} /></div>
              <div className="space-y-2"><Label>Employee recipient</Label><Select options={[{ value: '', label: 'Select an employee (or use patient above)' }, ...employees]} value={stockForm.recipientUserId} onChange={(event) => setStockForm({ ...stockForm, recipientUserId: event.target.value, patientId: '' })} /></div>
            </>}
            <div className="grid gap-4 md:grid-cols-2"><Field label="Reason" value={stockForm.reason} onChange={(value) => setStockForm({ ...stockForm, reason: value })} /><Field label="Reference" value={stockForm.reference} onChange={(value) => setStockForm({ ...stockForm, reference: value })} /></div>
            <Field label="Notes" value={stockForm.notes} onChange={(value) => setStockForm({ ...stockForm, notes: value })} />
          </div><div className="flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => void saveStockAction()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save movement</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Package; label: string; value: number; tone?: 'warning' | 'danger' }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-lg p-2 ${tone === 'danger' ? 'bg-destructive/10 text-destructive' : tone === 'warning' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div></CardContent></Card>;
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>;
}
