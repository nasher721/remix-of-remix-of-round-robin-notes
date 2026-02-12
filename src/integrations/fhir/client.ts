import FHIR from 'fhirclient';

export type FHIRClient = ReturnType<typeof FHIR.client>;

export interface FHIRPatientResource {
  id?: string;
  name?: Array<{
    given?: string[];
    family?: string;
    text?: string;
  }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      coding?: Array<{
        code?: string;
      }>;
    };
  }>;
}

export interface FHIRMedicationRequest {
  id?: string;
  medicationCodeableConcept?: {
    text?: string;
    coding?: Array<{
      display?: string;
      code?: string;
    }>;
  };
  dosageInstruction?: Array<{
    text?: string;
    asNeededBoolean?: boolean;
  }>;
  status?: string;
}

export interface FHIRAllergyIntolerance {
  id?: string;
  substance?: {
    text?: string;
    coding?: Array<{
      display?: string;
    }>;
  };
  reaction?: Array<{
    description?: string;
  }>;
  clinicalStatus?: {
    coding?: Array<{
      code?: string;
    }>;
  };
}



export const FHIR_SCOPES = [
  'patient/Patient.read',
  'patient/MedicationRequest.read',
  'patient/AllergyIntolerance.read',
  'launch',
  'openid',
  'fhirUser',
].join(' ');

const FHIR_STATE_KEY = 'fhir_state';

export interface FHIRState {
  isLaunching: boolean;
  clientId?: string;
  iss?: string;
}

export function saveFHIRState(state: FHIRState): void {
  sessionStorage.setItem(FHIR_STATE_KEY, JSON.stringify(state));
}

export function loadFHIRState(): FHIRState | null {
  const stored = sessionStorage.getItem(FHIR_STATE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export function clearFHIRState(): void {
  sessionStorage.removeItem(FHIR_STATE_KEY);
}

export async function launchSMART(config?: {
  clientId?: string;
  iss?: string;
  redirectUri?: string;
}): Promise<void> {
  const redirectUri = config?.redirectUri || `${window.location.origin}/fhir/callback`;
  
  saveFHIRState({ isLaunching: true, clientId: config?.clientId, iss: config?.iss });

  await FHIR.oauth2.authorize({
    clientId: config?.clientId || import.meta.env.VITE_FHIR_CLIENT_ID || '',
    scope: FHIR_SCOPES,
    redirectUri,
    iss: config?.iss,
  });
}

export async function handleCallback(): Promise<FHIRClient> {
  const client = await FHIR.oauth2.ready();
  clearFHIRState();
  return client;
}

export async function fetchPatientDemographics(client: FHIRClient): Promise<FHIRPatientResource> {
  const patient = await client.patient.read() as FHIRPatientResource;
  return patient;
}

export async function fetchMedications(client: FHIRClient): Promise<FHIRMedicationRequest[]> {
  const patientId = client.patient.id;
  if (!patientId) return [];
  
  const response = await client.request(`/MedicationRequest?patient=${patientId}&status=active`);
  
  if (response.entry && Array.isArray(response.entry)) {
    return response.entry.map((e: { resource: FHIRMedicationRequest }) => e.resource);
  }
  
  return [];
}

export async function fetchAllergies(client: FHIRClient): Promise<FHIRAllergyIntolerance[]> {
  const patientId = client.patient.id;
  if (!patientId) return [];
  
  const response = await client.request(`/AllergyIntolerance?patient=${patientId}&clinical-status=active`);
  
  if (response.entry && Array.isArray(response.entry)) {
    return response.entry.map((e: { resource: FHIRAllergyIntolerance }) => e.resource);
  }
  
  return [];
}

export function getFHIRContext(): { client: FHIRClient | null; isLaunching: boolean } {
  const state = loadFHIRState();
  return {
    client: null,
    isLaunching: state?.isLaunching ?? false,
  };
}

export function getPatientId(client: FHIRClient): string | undefined {
  return client.patient.id;
}

export function getServerUrl(client: FHIRClient): string {
  return client.state.serverUrl;
}

export async function fetchPatientData(client: FHIRClient): Promise<{
  patient: FHIRPatientResource;
  medications: FHIRMedicationRequest[];
  allergies: FHIRAllergyIntolerance[];
}> {
  const [patient, medications, allergies] = await Promise.all([
    fetchPatientDemographics(client),
    fetchMedications(client),
    fetchAllergies(client),
  ]);
  
  return { patient, medications, allergies };
}
