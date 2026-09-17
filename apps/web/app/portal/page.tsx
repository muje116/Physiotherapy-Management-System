'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Receipt, Dumbbell, FileText, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface PortalData {
  patient: { firstName: string; lastName: string };
  upcomingAppointments: { id: string; date: string; time: string; therapist: string; type: string; status: string }[];
  invoices: { id: string; invoiceNumber: string; date: string; amount: string; status: string }[];
  exercisePlans: { id: string; name: string; exercises: number; therapist: string }[];
  soapNotes: { id: string; date: string; therapist: string; summary: string }[];
}

export default function PortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/portal/dashboard');
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load your portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const payInvoice = async (invoiceId: string) => {
    if (!window.confirm('Continue with payment for this invoice?')) return;

    setPayingInvoiceId(invoiceId);
    setError(null);
    try {
      await api.post(`/portal/invoices/${invoiceId}/pay`);
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to process payment');
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const submitFeedback = async () => {
    setFeedbackSending(true);
    setFeedbackSuccess(null);
    setFeedbackError(null);
    try {
      await api.post('/portal/feedback', {
        rating: Number(feedbackRating),
        comment: feedbackComment.trim() || undefined,
      });
      setFeedbackComment('');
      setFeedbackSuccess('Thank you for sharing your feedback.');
    } catch (err: any) {
      setFeedbackError(err.response?.data?.error?.message || err.message || 'Unable to submit feedback');
    } finally {
      setFeedbackSending(false);
    }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-48" /><div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar fallback={`${data.patient.firstName[0]}${data.patient.lastName[0]}`} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {data.patient.firstName}</h1>
          <p className="text-muted-foreground">Here is your health summary</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.upcomingAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{a.date} at {a.time}</p>
                  <p className="text-sm text-muted-foreground">{a.therapist} · {a.type}</p>
                </div>
                <Badge variant={a.status === 'CONFIRMED' ? 'success' : 'info'}>{a.status}</Badge>
              </div>
            ))}
            {data.upcomingAppointments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming appointments</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Invoices</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>{inv.amount}</TableCell>
                    <TableCell><Badge variant={inv.status === 'PAID' ? 'success' : 'warning'}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {inv.status !== 'PAID' && inv.status !== 'MEDICAL_AID_APPROVED' ? (
                        <Button size="sm" onClick={() => void payInvoice(inv.id)} disabled={payingInvoiceId === inv.id}>
                          {payingInvoiceId === inv.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Pay now
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">Paid</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {data.invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No invoices</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Exercise Plans</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.exercisePlans.map((plan) => (
              <div key={plan.id} className="p-3 rounded-lg border">
                <p className="font-medium">{plan.name}</p>
                <p className="text-sm text-muted-foreground">{plan.exercises} exercises · {plan.therapist}</p>
              </div>
            ))}
            {data.exercisePlans.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No exercise plans</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">SOAP Notes</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.soapNotes.map((note) => (
            <div key={note.id} className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{note.date}</span>
                  <span className="text-xs text-muted-foreground">{note.therapist}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{note.summary}</p>
            </div>
          ))}
          {data.soapNotes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No SOAP notes</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share Feedback</CardTitle>
          <p className="text-sm text-muted-foreground">Tell us how your care experience has been.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackSuccess && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{feedbackSuccess}</p>}
          {feedbackError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{feedbackError}</p>}
          <div className="max-w-xs space-y-2">
            <label htmlFor="feedback-rating" className="text-sm font-medium">Rating</label>
            <Select
              id="feedback-rating"
              value={feedbackRating}
              onChange={(event) => setFeedbackRating(event.target.value)}
              options={[
                { value: '5', label: '5 - Excellent' },
                { value: '4', label: '4 - Good' },
                { value: '3', label: '3 - Okay' },
                { value: '2', label: '2 - Needs improvement' },
                { value: '1', label: '1 - Poor' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="feedback-comment" className="text-sm font-medium">Comment (optional)</label>
            <Textarea
              id="feedback-comment"
              value={feedbackComment}
              onChange={(event) => setFeedbackComment(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What could we do better?"
            />
          </div>
          <Button onClick={() => void submitFeedback()} disabled={feedbackSending}>
            {feedbackSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
