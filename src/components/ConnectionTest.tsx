import { useState } from 'react';
import { Button } from '@/components/ui/button';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function ConnectionTest() {
  const [result, setResult] = useState<string>('');
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    setResult('Testing...');

    try {
      // Test 1: Basic fetch to a public endpoint
      console.log('[Test] Testing connection to:', `${SUPABASE_URL}/rest/v1/`);
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setResult(`✅ Connection successful! Status: ${response.status}`);
      } else {
        setResult(`⚠️ Response received but not OK. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('[Test] Connection error:', error);
      setResult(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Additional diagnostic
      try {
        const googleTest = await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' });
        setResult(prev => prev + '\n✅ General internet works (Google reachable)');
      } catch {
        setResult(prev => prev + '\n❌ General internet also failing');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 p-4 border rounded-lg bg-muted/50">
      <h3 className="font-medium mb-2">Connection Diagnostics</h3>
      <p className="text-sm text-muted-foreground mb-2">
        URL: {SUPABASE_URL || 'NOT SET'}
      </p>
      <Button onClick={testConnection} disabled={testing} size="sm">
        {testing ? 'Testing...' : 'Test Connection'}
      </Button>
      {result && (
        <pre className="mt-2 text-sm whitespace-pre-wrap bg-background p-2 rounded">
          {result}
        </pre>
      )}
    </div>
  );
}
