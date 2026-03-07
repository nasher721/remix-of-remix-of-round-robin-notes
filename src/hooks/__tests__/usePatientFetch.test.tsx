import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePatientFetch } from '../patients/usePatientFetch';
import { createHookWrapper } from '@/test/utils';
import { mockUser, mockPatients } from '@/test/mocks/data';

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  hasSupabaseConfig: true,
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../use-notifications', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('usePatientFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnThis(),
      order: mockOrder,
    });
  });

  it('should fetch patients on mount', async () => {
    mockOrder.mockResolvedValue({
      data: mockPatients.map(p => ({
        id: p.id,
        name: p.name,
        mrn: p.mrn,
        date_of_birth: p.date_of_birth,
        age: p.age,
        gender: p.gender,
        admission_date: p.admission_date,
        room_number: p.room_number,
        status: p.status,
        diagnosis: p.diagnosis,
        systems: p.systems,
        medications: p.medications,
        labs: p.labs,
        vitals: p.vitals,
        allergies: p.allergies,
        code_status: p.code_status,
        weight_kg: p.weight_kg,
        height_cm: p.height_cm,
        created_at: p.created_at,
        updated_at: p.updated_at,
        created_by: p.created_by,
        team_id: p.team_id,
        patient_number: 1,
        rounding_order: 0,
        collapsed: false,
      })),
      error: null,
    });

    const { result } = renderHook(() => usePatientFetch(), {
      wrapper: createHookWrapper().wrapper,
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.patients).toHaveLength(2);
    expect(result.current.patients[0].name).toBe('John Doe');
    expect(mockFrom).toHaveBeenCalledWith('patients');
  });

  it('should handle empty patient list', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => usePatientFetch(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.patients).toEqual([]);
    expect(result.current.patientCounter).toBe(1);
  });

  it('should handle fetch errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOrder.mockResolvedValue({
      data: null,
      error: new Error('Connection failed'),
    });

    const { result } = renderHook(() => usePatientFetch(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.patients).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      'Error fetching patients:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('should cancel stale requests', async () => {
    let resolveFirst: (value: { data: unknown[]; error: null }) => void;
    const firstPromise = new Promise<{ data: unknown[]; error: null }>((resolve) => {
      resolveFirst = resolve;
    });

    mockOrder
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({
        data: [{
          id: 'patient-new',
          name: 'New Patient',
          patient_number: 3,
          rounding_order: 0,
          collapsed: false,
        }],
        error: null,
      });

    const { result, rerender } = renderHook(() => usePatientFetch(), {
      wrapper: createHookWrapper().wrapper,
    });

    // Trigger a refetch before first completes
    result.current.fetchPatients();

    // Now resolve the first request
    resolveFirst!({
      data: [{
        id: 'patient-old',
        name: 'Old Patient',
        patient_number: 1,
        rounding_order: 0,
        collapsed: false,
      }],
      error: null,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have the newer data, not the stale one
    expect(result.current.patients[0]?.name).toBe('New Patient');
  });

  it('should update patient counter correctly', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: '1', patient_number: 5, rounding_order: 0, collapsed: false },
        { id: '2', patient_number: 3, rounding_order: 1, collapsed: false },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePatientFetch(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Counter should be max + 1
    expect(result.current.patientCounter).toBe(6);
  });

  it('should maintain patients ref', async () => {
    mockOrder.mockResolvedValue({
      data: [{
        id: 'patient-1',
        name: 'Test Patient',
        patient_number: 1,
        rounding_order: 0,
        collapsed: false,
      }],
      error: null,
    });

    const { result } = renderHook(() => usePatientFetch(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Ref should always point to current patients
    expect(result.current.patientsRef.current).toEqual(result.current.patients);
  });
});
