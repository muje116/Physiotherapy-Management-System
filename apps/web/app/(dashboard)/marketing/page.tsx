'use client';

import { useEffect, useState } from 'react';
import { Loader2, Megaphone, Pencil, Play, Plus, TrendingUp, Users } from 'lucide-react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface Campaign {
  id: string;
  name: string;
  channel: string[];
  status: string;
  template: string;
  sent: number;
  openRate: string;
  conversion: string;
}

interface ReferralSource {
  name: string;
  value: number;
  percentage: number;
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [referralSources, setReferralSources] = useState<ReferralSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formName, setFormName] = useState('');
  const [formChannels, setFormChannels] = useState('EMAIL');
  const [formTemplate, setFormTemplate] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/marketing/campaigns'),
      api.get('/marketing/sources'),
    ]).then(([campRes, refRes]) => {
      setCampaigns((campRes.data.data || []).map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        channel: Array.isArray(campaign.channel) ? campaign.channel : [campaign.channel],
        status: campaign.status,
        template: campaign.template || '',
        sent: campaign.sentCount || 0,
        openRate: campaign.openRate ? `${campaign.openRate}%` : '-',
        conversion: campaign.bookings ? `${campaign.bookings}` : '-',
      })));
      setReferralSources((refRes.data.data || []).map((source: any) => ({
        name: source.source,
        value: source.count,
        percentage: source.percentage || 0,
      })));
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditingCampaign(null);
    setFormName('');
    setFormChannels('EMAIL');
    setFormTemplate('');
    setFormScheduledAt('');
  };

  const openNewCampaign = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormName(campaign.name);
    setFormChannels(campaign.channel.join(', '));
    setFormTemplate(campaign.template);
    setFormScheduledAt('');
    setDialogOpen(true);
  };

  const saveCampaign = async () => {
    setSaving(true);
    setError(null);

    const channel = formChannels
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    try {
      if (editingCampaign) {
        await api.patch(`/marketing/campaigns/${editingCampaign.id}`, {
          name: formName,
          channel,
          template: formTemplate,
          scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : undefined,
        });
      } else {
        await api.post('/marketing/campaigns', {
          name: formName,
          channel,
          template: formTemplate,
          scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : undefined,
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      await api.post(`/marketing/campaigns/${campaignId}/send`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const activeCount = campaigns.filter((campaign) => campaign.status === 'ACTIVE').length;
  const totalReach = campaigns.reduce((sum, campaign) => sum + campaign.sent, 0);
  const openRateCampaigns = campaigns.filter((campaign) => campaign.openRate !== '-');
  const avgOpenRate = openRateCampaigns.reduce((sum, campaign) => sum + parseFloat(campaign.openRate), 0) / Math.max(openRateCampaigns.length, 1);

  if (loading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-64" /></div>;
  }

  if (error && campaigns.length === 0) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-muted-foreground">Campaigns and patient referrals</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewCampaign}>
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Channels</Label>
                <Input value={formChannels} onChange={(e) => setFormChannels(e.target.value)} placeholder="EMAIL, SMS" />
              </div>
              <div className="space-y-2">
                <Label>Message Template</Label>
                <Textarea value={formTemplate} onChange={(e) => setFormTemplate(e.target.value)} rows={5} />
              </div>
              <div className="space-y-2">
                <Label>Scheduled At</Label>
                <Input type="datetime-local" value={formScheduledAt} onChange={(e) => setFormScheduledAt(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </DialogClose>
                <Button onClick={saveCampaign} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingCampaign ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalReach.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgOpenRate ? `${avgOpenRate.toFixed(1)}%` : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Open Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell><Badge variant="outline">{campaign.channel.join(', ')}</Badge></TableCell>
                    <TableCell><StatusBadge status={campaign.status} /></TableCell>
                    <TableCell>{campaign.sent.toLocaleString()}</TableCell>
                    <TableCell>{campaign.openRate}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditCampaign(campaign)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {campaign.status !== 'ACTIVE' && (
                          <Button variant="ghost" size="sm" onClick={() => sendCampaign(campaign.id)}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No campaigns found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {referralSources.map((source) => (
                <div key={source.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{source.name}</span>
                    <span className="text-muted-foreground">{source.value} patient(s) | {source.percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${source.percentage}%` }} />
                  </div>
                </div>
              ))}
              {referralSources.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No referral sources found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
