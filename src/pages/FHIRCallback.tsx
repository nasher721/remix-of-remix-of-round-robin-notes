import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback, fetchPatientData } from '@/integrations/fhir';
import { usePatients } from '@/hooks/usePatients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

type ImportStatus = 'loading' | 'fetching' | 'importing' | 'success' | 'error';

export default function FHIRCallback() {
  const navigate = useNavigate();
  const { addPatientWithData } = usePatients();
  const [status, setStatus] = useState<ImportStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        setStatus('loading');
        
        const client = await handleCallback();
        
        if (!client) {
          throw new Error('Failed to initialize FHIR client');
        }

        setStatus('fetching');
        
        const fhirData = await fetchPatientData(client);
        
        if (!fhirData.patient) {
          throw new Error('No patient data received from EHR');
        }

        const name = fhirData.patient.name?.[0];
        const fullName = name 
          ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
          : 'Unknown Patient';
        
        setPatientName(fullName);
        setStatus('importing');

        const patientData = {
          name: fullName,
          bed: '',
          clinicalSummary: `Imported from EHR on ${new Date().toLocaleDateString()}`,
          intervalEvents: '',
          imaging: '',
          labs: '',
          systems: {
            neuro: '',
            cv: '',
            resp: '',
            renalGU: '',
            gi: '',
            endo: '',
            heme: '',
            infectious: '',
            skinLines: '',
            dispo: '',
          },
          medications: {
            infusions: [],
            scheduled: fhirData.medications.map(m => 
              m.medicationCodeableConcept?.text || 
              m.medicationCodeableConcept?.coding?.[0]?.display || 
              'Unknown medication'
            ),
            prn: [],
            rawText: '',
          },
        };

        await addPatientWithData(patientData);
        
        sessionStorage.removeItem('fhir_launch_state');
        
        setStatus('success');
        
        setTimeout(() => {
          navigate('/');
        }, 2000);
        
      } catch (err) {
        console.error('FHIR callback error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setStatus('error');
      }
    }

    processCallback();
  }, [addPatientWithData, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting to EHR...
              </>
            )}
            {status === 'fetching' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Fetching Patient Data...
              </>
            )}
            {status === 'importing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Importing {patientName}...
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Import Successful!
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                Import Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <p className="text-sm text-muted-foreground">
              Please wait while we connect to your EHR system...
            </p>
          )}
          {status === 'fetching' && (
            <p className="text-sm text-muted-foreground">
              Retrieving patient demographics, medications, and allergies...
            </p>
          )}
          {status === 'importing' && (
            <p className="text-sm text-muted-foreground">
              Creating patient record for <strong>{patientName}</strong>...
            </p>
          )}
          {status === 'success' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Successfully imported <strong>{patientName}</strong> from your EHR.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-destructive">
                {error || 'An error occurred while importing patient data.'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="text-sm text-primary hover:underline"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
