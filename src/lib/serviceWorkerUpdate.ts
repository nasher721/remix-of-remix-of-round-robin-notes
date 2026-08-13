export const SERVICE_WORKER_UPDATE_EVENT = "rolling-rounds:service-worker-update";

let updateReady = false;

export function isServiceWorkerUpdateReady(): boolean {
  return updateReady;
}

export function markServiceWorkerUpdateReady(): void {
  updateReady = true;
  window.dispatchEvent(new Event(SERVICE_WORKER_UPDATE_EVENT));
}

export function clearServiceWorkerUpdateReady(): void {
  updateReady = false;
}
