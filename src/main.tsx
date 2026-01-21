import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// IMPORTANT: Unregister all service workers to prevent network interception issues
// Service workers can interfere with Supabase requests in the preview environment
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('[App] Service Worker unregistered successfully');
        }
      });
    }
  }).catch((error) => {
    console.error('[App] Error unregistering service workers:', error);
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
