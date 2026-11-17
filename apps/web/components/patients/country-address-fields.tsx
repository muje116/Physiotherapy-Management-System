'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

const LOCATION_API = 'https://api.openadmindata.org/api/v1';
type Option = { value: string; label: string; id?: string; code?: string };
type CountryRecord = { code: string; name_en: string; name_local?: string };
type Division = { id: string; name_en: string; parent_id?: string | null; parent_name_en?: string | null };
type CountryData = {
  meta: { levels: Array<{ key: string; name_en: string }> };
  data: Record<string, Division[]>;
};

let countryListRequest: Promise<CountryRecord[]> | null = null;
const countryDataCache = new Map<string, CountryData>();

async function loadCountryList() {
  if (!countryListRequest) {
    countryListRequest = fetch(`${LOCATION_API}/countries.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Country list is unavailable');
        const result = await response.json();
        return result.countries as CountryRecord[];
      })
      .catch((error) => {
        countryListRequest = null;
        throw error;
      });
  }
  return countryListRequest;
}

async function loadCountryData(code: string) {
  const cached = countryDataCache.get(code);
  if (cached) return cached;
  const response = await fetch(`${LOCATION_API}/countries/${code}.json`);
  if (!response.ok) throw new Error('Administrative divisions are unavailable');
  const data = await response.json() as CountryData;
  countryDataCache.set(code, data);
  return data;
}

function withCurrent(options: Option[], current: string) {
  return current && !options.some((option) => option.value === current)
    ? [{ value: current, label: `${current} (saved value)` }, ...options]
    : options;
}

export function CountryAddressFields({
  country,
  province,
  district,
  onChange,
}: {
  country: string;
  province: string;
  district: string;
  onChange: (field: 'country' | 'province' | 'district', value: string) => void;
}) {
  const [countries, setCountries] = useState<Option[]>([]);
  const [countryDataset, setCountryDataset] = useState<CountryData | null>(null);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [lookupError, setLookupError] = useState(false);

  useEffect(() => {
    let active = true;
    loadCountryList()
      .then((records) => {
        if (!active) return;
        setCountries(records.map((item) => ({ value: item.name_en, label: item.name_en, code: item.code }))
          .sort((left, right) => left.label.localeCompare(right.label)));
      })
      .catch(() => { if (active) setLookupError(true); })
      .finally(() => { if (active) setLoadingCountries(false); });
    return () => { active = false; };
  }, []);

  const selectedCountry = countries.find((item) => item.value === country)
    || countries.find((item) => item.value.toLocaleLowerCase() === country.toLocaleLowerCase());

  useEffect(() => {
    setCountryDataset(null);
    if (!selectedCountry?.code) return;
    let active = true;
    setLoadingProvinces(true);
    loadCountryData(selectedCountry.code)
      .then((data) => { if (active) setCountryDataset(data); })
      .catch(() => { if (active) setLookupError(true); })
      .finally(() => { if (active) setLoadingProvinces(false); });
    return () => { active = false; };
  }, [selectedCountry?.code]);

  const levels = countryDataset?.meta?.levels || [];
  const provinceLevel = levels[0];
  const districtLevel = levels[1];
  const provinceOptions = useMemo(() => {
    const divisions = provinceLevel ? countryDataset?.data?.[provinceLevel.key] || [] : [];
    return divisions.map((division) => ({ value: division.name_en, label: division.name_en, id: division.id }));
  }, [countryDataset, provinceLevel?.key]);

  const districtOptions = useMemo(() => {
    const divisions = districtLevel ? countryDataset?.data?.[districtLevel.key] || [] : [];
    const selectedProvince = provinceOptions.find((item) => item.value === province);
    if (!divisions.length || !selectedProvince) return [];
    const hasParentMetadata = divisions.some((division) => division.parent_id || division.parent_name_en);
    const children = hasParentMetadata
      ? divisions.filter((division) => division.parent_id === selectedProvince.id || division.parent_name_en === province)
      : divisions;
    return children.map((division) => ({ value: division.name_en, label: division.name_en, id: division.id }));
  }, [countryDataset, districtLevel?.key, province, provinceOptions]);

  return (
    <>
      <div className="space-y-2">
        <Label>Country</Label>
        <Select options={withCurrent(countries, country)} placeholder={loadingCountries ? 'Loading countries…' : 'Select country'} value={country} disabled={loadingCountries} onChange={(event) => onChange('country', event.target.value)} />
        {loadingCountries && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading countries</p>}
      </div>
      <div className="space-y-2">
        <Label>{provinceLevel?.name_en || 'Province / region'}</Label>
        <Select options={withCurrent(provinceOptions, province)} placeholder={!country ? 'Select a country first' : loadingProvinces ? 'Loading regions…' : 'Select province or region'} value={province} disabled={!country || loadingProvinces} onChange={(event) => onChange('province', event.target.value)} />
        {loadingProvinces && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading administrative divisions</p>}
      </div>
      <div className="space-y-2">
        <Label>{districtLevel?.name_en || 'District'}</Label>
        <Select options={withCurrent(districtOptions, district)} placeholder={!province ? 'Select a province first' : !districtLevel ? 'No lower-level list for this country' : 'Select district'} value={district} disabled={!province || !districtLevel} onChange={(event) => onChange('district', event.target.value)} />
      </div>
      {lookupError && <p className="col-span-full text-xs text-amber-700">Location data could not be loaded. Saved address values remain available.</p>}
    </>
  );
}
