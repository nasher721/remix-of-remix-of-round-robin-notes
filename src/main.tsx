import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker outside of React to avoid HMR issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[App] Service Worker registered:', registration.scope);
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
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
  });

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
