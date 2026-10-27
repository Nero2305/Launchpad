import { describe, expect, it } from 'vitest';
import { csvExport, filterApplications, toInput, type Application } from './model';
const row: Application = {
  id: '1',
  company: 'Orbit, Inc.',
  role: 'Python Intern',
  location: 'Kuala Lumpur',
  stage: 'Applied',
  applied_on: '2026-01-01',
  follow_up: null,
  interview_on: null,
  url: null,
  notes: 'Say "hello"\nNew line',
};
describe('application search', () => {
  it('combines case-insensitive search and stage', () => {
    expect(filterApplications([row], '  PYTHON ', 'Applied')).toHaveLength(1);
    expect(filterApplications([row], 'kuala', 'Saved')).toHaveLength(0);
    expect(filterApplications([row], '', 'All stages')).toHaveLength(1);
  });
  it('does not send server-owned fields to the API', () => {
    expect(toInput({ ...row, created_at: '2026-01-01' })).not.toHaveProperty('id');
    expect(toInput(row)).not.toHaveProperty('created_at');
  });
});
describe('CSV export', () => {
  it('escapes commas, newlines, and double quotes', () => {
    const result = csvExport([row]);
    expect(result).toContain('"Orbit, Inc."');
    expect(result).toContain('"Say ""hello""\nNew line"');
  });
  it.each(['=HYPERLINK("bad")', '+1+1', '@SUM(1)', '-1+1', '  =1+1', '\tformula'])(
    'neutralizes spreadsheet formula prefix %s',
    (notes) => {
      expect(csvExport([{ ...row, notes }])).toContain('"\'' + notes.replaceAll('"', '""'));
    },
  );
  it('exports headers for an empty workspace', () =>
    expect(csvExport([]).split('\r\n')).toHaveLength(1));
});
