import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultMedications, defaultSystems, type Patient } from '@/types/patient';
import { buildCachedPatientRows } from './patientRosterCache';

const patient = (overrides: Partial<Patient> = {}): Patient => ({
  id: 'patient-1',
  patientNumber: 3,
  name: 'Cached Patient',
  mrn: 'MRN-1',
  bed: 'B3',
  clinicalSummary: 'Stable',
  intervalEvents: '',
  imaging: '',
  labs: '',
  systems: { ...defaultSystems },
  medications: { ...defaultMedications },
  fieldTimestamps: {},
  collapsed: false,
  createdAt: '2026-08-13T10:00:00.000Z',
  lastModified: '2026-08-13T10:05:00.000Z',
  revision: 7,
  ...overrides,
});

test('patient roster snapshots preserve the complete UI record and revision', () => {
  const cachedAt = Date.parse('2026-08-13T10:10:00.000Z');
  const [row] = buildCachedPatientRows([patient()], cachedAt);

  assert.equal(row.id, 'patient-1');
  assert.equal(row.cachedAt, cachedAt);
  assert.equal(row.lastModified, Date.parse('2026-08-13T10:05:00.000Z'));
  assert.equal(row.version, 7);
  assert.equal(row.syncStatus, 'synced');
  assert.deepEqual(row.data, patient());
});

test('patient roster snapshots tolerate malformed legacy timestamps', () => {
  const [row] = buildCachedPatientRows([patient({ lastModified: '' })], 1);
  assert.equal(row.lastModified, 0);
});
