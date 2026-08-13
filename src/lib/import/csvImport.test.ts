import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapValidRowsToPatients,
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
