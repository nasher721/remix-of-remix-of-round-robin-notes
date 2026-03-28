import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorCapture } from "@/lib/observability/telemetry";
import { installObservabilityDebugApi } from "@/lib/observability/debugApi";
import { initAppSentry } from "@/lib/observability/sentryClient";

// Initialize telemetry early to capture all errors
initGlobalErrorCapture();
initAppSentry();
installObservabilityDebugApi();

// Register service worker outside of React to avoid HMR / Vite dynamic-import issues in dev.
// In development, caching can prevent lazy route chunks from loading reliably.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] New content available, refresh to update');
            }
          });
        }
      });
    })
    .catch((error) => {
      console.error('[App] Service Worker registration failed:', error);
    });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found");
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
