import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoMapColumns,
  mapValidRowsToPatients,
  parseCSV,
  validateRow,
  type CSVParseResult,
  type FieldMapping,
} from './csvImport';

const mapping: FieldMapping[] = [
  { csvColumn: 'Name', targetField: 'name' },
  { csvColumn: 'DOB', targetField: 'dob', transform: 'date' },
  { csvColumn: 'Gender', targetField: 'gender' },
  { csvColumn: 'Room', targetField: 'room' },
];

test('CSV validation permits blank optional fields and common gender labels', () => {
  assert.deepEqual(
    validateRow(['Jane Doe', '1980-01-02', 'Female', ''], ['Name', 'DOB', 'Gender', 'Room'], mapping),
    [],
  );
});

test('CSV import maps only valid rows', () => {
  const csvData: CSVParseResult = {
    headers: ['Name', 'DOB', 'Gender', 'Room'],
    rows: [
      ['Jane Doe', '1980-01-02', 'F', '12'],
      ['', '1990-02-03', 'M', '13'],
      ['Future Patient', '2999-01-01', 'Other', '14'],
    ],
    rowCount: 3,
  };

  const result = mapValidRowsToPatients(csvData, mapping);

  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Jane Doe');
  assert.match(result[0].dob, /^1980-01-02T/);
});

test('CSV parsing preserves quoted multiline clinical fields as one patient row', () => {
  const parsed = parseCSV([
    'Name,Diagnosis,Room',
    '"Doe, Jane","Sepsis',
    'on norepinephrine",12A',
    '"Smith, John","ARDS, improving",12B',
  ].join('\r\n'));

  assert.deepEqual(parsed.headers, ['Name', 'Diagnosis', 'Room']);
  assert.deepEqual(parsed.rows, [
    ['Doe, Jane', 'Sepsis\non norepinephrine', '12A'],
    ['Smith, John', 'ARDS, improving', '12B'],
  ]);
  assert.equal(parsed.rowCount, 2);

  const patients = mapValidRowsToPatients(parsed, autoMapColumns(parsed.headers));
  assert.equal(patients.length, 2);
  assert.equal(patients[0].name, 'Doe, Jane');
  assert.equal(patients[0].diagnosis, 'Sepsis\non norepinephrine');
});

test('CSV parsing preserves escaped quotes and ignores physically blank records', () => {
  const parsed = parseCSV('Name,Diagnosis\n\nJane Doe,"Said ""better"" today"\n');

  assert.deepEqual(parsed.rows, [['Jane Doe', 'Said "better" today']]);
  assert.equal(parsed.rowCount, 1);
});
