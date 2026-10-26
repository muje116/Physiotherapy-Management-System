'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export interface PatientFormPatient {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: unknown;
  medicalAidName?: string | null;
  medicalAidNo?: string | null;
  referralSource?: string | null;
  referralDoctorName?: string | null;
  occupation?: string | null;
  employer?: string | null;
  clinic?: string | null;
  paymentMethod?: string | null;
  paymentResponsibilityAcknowledged?: boolean | null;
  paymentResponsibilitySignedAt?: string | Date | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  howHeardAboutClinic?: string | null;
  allergies?: string[] | null;
  chronicConditions?: string[] | null;
  currentMedications?: string[] | null;
  bloodType?: string | null;
  preferredLanguage?: string | null;
  clinicalPrecautions?: string | null;
}

interface PatientFormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  medicalAidName: string;
  medicalAidNo: string;
  paymentMethod: string;
  paymentResponsibilityAcknowledged: boolean;
  occupation: string;
  employer: string;
  clinic: string;
  referralSource: string;
  referralDoctorName: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  howHeardAboutClinic: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  bloodType: string;
  preferredLanguage: string;
  clinicalPrecautions: string;
}

const emptyForm: PatientFormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  medicalAidName: '',
  medicalAidNo: '',
  paymentMethod: '',
  paymentResponsibilityAcknowledged: false,
  occupation: '',
  employer: '',
  clinic: '',
  referralSource: '',
  referralDoctorName: '',
  nextOfKinName: '',
  nextOfKinPhone: '',
  howHeardAboutClinic: '',
  allergies: '',
  chronicConditions: '',
  currentMedications: '',
  bloodType: '',
  preferredLanguage: '',
  clinicalPrecautions: '',
};

function dateInputValue(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
}

function addressFields(address: unknown) {
  if (typeof address === 'string') return { street: address, city: '', state: '', postalCode: '', country: '' };
  if (!address || typeof address !== 'object') return { street: '', city: '', state: '', postalCode: '', country: '' };

  const value = address as Record<string, unknown>;
  return {
    street: typeof value.street === 'string' ? value.street : '',
    city: typeof value.city === 'string' ? value.city : '',
    state: typeof value.state === 'string' ? value.state : '',
    postalCode: typeof value.postalCode === 'string' ? value.postalCode : '',
    country: typeof value.country === 'string' ? value.country : '',
  };
}

function formFromPatient(patient?: PatientFormPatient | null): PatientFormState {
  if (!patient) return { ...emptyForm };
  return {
    ...emptyForm,
    firstName: patient.firstName || '',
    lastName: patient.lastName || '',
    dateOfBirth: dateInputValue(patient.dateOfBirth),
    gender: patient.gender || '',
    phone: patient.phone || '',
    email: patient.email || '',
    ...addressFields(patient.address),
    medicalAidName: patient.medicalAidName || '',
    medicalAidNo: patient.medicalAidNo || '',
    paymentMethod: patient.paymentMethod || '',
    paymentResponsibilityAcknowledged: Boolean(patient.paymentResponsibilityAcknowledged),
    occupation: patient.occupation || '',
    employer: patient.employer || '',
    clinic: patient.clinic || '',
    referralSource: patient.referralSource || '',
    referralDoctorName: patient.referralDoctorName || '',
    nextOfKinName: patient.nextOfKinName || '',
    nextOfKinPhone: patient.nextOfKinPhone || '',
    howHeardAboutClinic: patient.howHeardAboutClinic || '',
    allergies: listToText(patient.allergies),
    chronicConditions: listToText(patient.chronicConditions),
    currentMedications: listToText(patient.currentMedications),
    bloodType: patient.bloodType || '',
    preferredLanguage: patient.preferredLanguage || '',
    clinicalPrecautions: patient.clinicalPrecautions || '',
  };
}

function listToText(value?: string[] | null) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function textToList(value: string) {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
}

function errorMessage(error: any) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unable to save patient';
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: PatientFormPatient | null;
  onSaved?: (patient: any) => void;
}) {
  const [form, setForm] = useState<PatientFormState>(() => formFromPatient(patient));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(patient?.id);

  useEffect(() => {
    if (open) {
      setForm(formFromPatient(patient));
      setError(null);
    }
  }, [open, patient]);

  const updateField = (field: keyof PatientFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const savePatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      setError('First name, last name, and date of birth are required.');
      return;
    }

    setSaving(true);
    const address = {
      street: form.street || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      postalCode: form.postalCode || undefined,
      country: form.country || undefined,
    };
    const optional = (value: string) => (isEditing ? value : value || undefined);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dateOfBirth: new Date(form.dateOfBirth + 'T00:00:00').toISOString(),
      gender: form.gender || undefined,
      phone: optional(form.phone),
      email: optional(form.email),
      address,
      medicalAidName: optional(form.medicalAidName),
      medicalAidNo: optional(form.medicalAidNo),
      paymentMethod: optional(form.paymentMethod),
      paymentResponsibilityAcknowledged: form.paymentResponsibilityAcknowledged,
      occupation: optional(form.occupation),
      employer: optional(form.employer),
      clinic: optional(form.clinic),
      referralSource: optional(form.referralSource),
      referralDoctorName: optional(form.referralDoctorName),
      nextOfKinName: optional(form.nextOfKinName),
      nextOfKinPhone: optional(form.nextOfKinPhone),
      howHeardAboutClinic: optional(form.howHeardAboutClinic),
      allergies: textToList(form.allergies),
      chronicConditions: textToList(form.chronicConditions),
      currentMedications: textToList(form.currentMedications),
      bloodType: optional(form.bloodType),
      preferredLanguage: optional(form.preferredLanguage),
      clinicalPrecautions: optional(form.clinicalPrecautions),
    };

    try {
      const response = isEditing
        ? await api.patch('/patients/' + patient?.id, payload)
        : await api.post('/patients', payload);
      onSaved?.(response.data.data);
      onOpenChange(false);
    } catch (requestError: any) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Patient' : 'Add Patient'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-6" onSubmit={savePatient}>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Personal information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name" required value={form.firstName} onChange={(value) => updateField('firstName', value)} />
              <Field label="Last name" required value={form.lastName} onChange={(value) => updateField('lastName', value)} />
              <Field label="Date of birth" required type="date" value={form.dateOfBirth} onChange={(value) => updateField('dateOfBirth', value)} />
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  options={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                  value={form.gender}
                  onChange={(event) => updateField('gender', event.target.value)}
                  placeholder="Select gender"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Contact and physical address</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Phone" type="tel" value={form.phone} onChange={(value) => updateField('phone', value)} />
              <Field label="Email" type="email" value={form.email} onChange={(value) => updateField('email', value)} />
            </div>
            <Field label="Physical address" value={form.street} onChange={(value) => updateField('street', value)} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="City" value={form.city} onChange={(value) => updateField('city', value)} />
              <Field label="State / province" value={form.state} onChange={(value) => updateField('state', value)} />
              <Field label="Postal code" value={form.postalCode} onChange={(value) => updateField('postalCode', value)} />
              <Field label="Country" value={form.country} onChange={(value) => updateField('country', value)} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Work and clinic details</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Occupation" value={form.occupation} onChange={(value) => updateField('occupation', value)} />
              <Field label="Employer" value={form.employer} onChange={(value) => updateField('employer', value)} />
              <Field label="Clinic" value={form.clinic} onChange={(value) => updateField('clinic', value)} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Payment and insurance</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select
                  options={[
                    { value: 'CASH', label: 'Cash' },
                    { value: 'INSURANCE', label: 'Insurance' },
                  ]}
                  value={form.paymentMethod}
                  onChange={(event) => updateField('paymentMethod', event.target.value)}
                  placeholder="Select payment method"
                />
              </div>
              <Field label="Insurance / medical aid" value={form.medicalAidName} onChange={(value) => updateField('medicalAidName', value)} />
              <Field label="Member number" value={form.medicalAidNo} onChange={(value) => updateField('medicalAidNo', value)} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={form.paymentResponsibilityAcknowledged}
                onChange={(event) => setForm((current) => ({ ...current, paymentResponsibilityAcknowledged: event.target.checked }))}
              />
              <span>I accept responsibility for payment of physiotherapy treatment charges at this practice.</span>
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Referral and next of kin</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Referring doctor" value={form.referralDoctorName} onChange={(value) => updateField('referralDoctorName', value)} />
              <Field label="Referral source" value={form.referralSource} onChange={(value) => updateField('referralSource', value)} />
              <Field label="Next of kin" value={form.nextOfKinName} onChange={(value) => updateField('nextOfKinName', value)} />
              <Field label="Next of kin phone" type="tel" value={form.nextOfKinPhone} onChange={(value) => updateField('nextOfKinPhone', value)} />
            </div>
            <Field label="How did you hear about the clinic?" value={form.howHeardAboutClinic} onChange={(value) => updateField('howHeardAboutClinic', value)} />
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Clinical safety profile</h3>
              <p className="text-xs text-muted-foreground">Enter one item per line. This information is shown before clinical treatment.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ListField label="Allergies" value={form.allergies} onChange={(value) => updateField('allergies', value)} placeholder="e.g. Penicillin" />
              <ListField label="Chronic conditions" value={form.chronicConditions} onChange={(value) => updateField('chronicConditions', value)} placeholder="e.g. Hypertension" />
              <ListField label="Current medications" value={form.currentMedications} onChange={(value) => updateField('currentMedications', value)} placeholder="e.g. Ibuprofen 400 mg" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Blood type" value={form.bloodType} onChange={(value) => updateField('bloodType', value)} />
                <Field label="Preferred language" value={form.preferredLanguage} onChange={(value) => updateField('preferredLanguage', value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Clinical precautions / alerts</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.clinicalPrecautions}
                onChange={(event) => updateField('clinicalPrecautions', event.target.value)}
                placeholder="Falls risk, contraindications, communication needs, or other alerts"
              />
            </div>
          </section>

          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save changes' : 'Create patient'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ListField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
