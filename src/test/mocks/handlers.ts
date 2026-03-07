import { http, HttpResponse } from 'msw';
import { mockPatients, mockClinicalPhrases, mockUser } from './data';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';

export const handlers = [
  // Auth handlers
  http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: mockUser,
    });
  }),

  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json(mockUser);
  }),

  // Patients handlers
  http.get(`${SUPABASE_URL}/rest/v1/patients`, () => {
    return HttpResponse.json(mockPatients);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/patients*`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const patient = mockPatients.find(p => p.id === id);
    return patient 
      ? HttpResponse.json([patient]) 
      : HttpResponse.json([]);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/patients`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, id: 'new-patient-id' }, { status: 201 });
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/patients*`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, updated_at: new Date().toISOString() });
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/patients*`, () => {
    return HttpResponse.json(null, { status: 204 });
  }),

  // Clinical phrases handlers
  http.get(`${SUPABASE_URL}/rest/v1/clinical_phrases`, () => {
    return HttpResponse.json(mockClinicalPhrases);
  }),

  // Edge Functions handlers
  http.post(`${SUPABASE_URL}/functions/v1/ai-clinical-assistant`, async () => {
    return HttpResponse.json({
      success: true,
      result: 'AI-generated clinical summary',
      model: 'gpt-4o',
      feature: 'clinical_summary',
    });
  }),

  http.post(`${SUPABASE_URL}/functions/v1/transcribe-audio`, async () => {
    return HttpResponse.json({
      success: true,
      text: 'Transcribed clinical note text',
    });
  }),

  // Storage handlers
  http.get(`${SUPABASE_URL}/storage/v1/object/*`, () => {
    return HttpResponse.json({});
  }),
];
