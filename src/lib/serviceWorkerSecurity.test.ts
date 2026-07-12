import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type FetchEvent = {
  request: Request;
  respondWith: (response: Promise<Response> | Response) => void;
};

type ActivationEvent = {
  waitUntil: (completion: Promise<unknown>) => void;
};

type ServiceWorkerListener = (event: FetchEvent | ActivationEvent) => void;

const loadServiceWorker = (initialCacheNames: string[] = []) => {
  const listeners = new Map<string, ServiceWorkerListener>();
  const deletedCaches: string[] = [];
  const cache = {
    addAll: async () => undefined,
    delete: async () => true,
    keys: async () => [],
    match: async () => undefined,
    put: async () => undefined,
  };
  const caches = {
    delete: async (name: string) => {
      deletedCaches.push(name);
      return true;
    },
    keys: async () => initialCacheNames,
    open: async () => cache,
  };
  const self = {
    addEventListener: (type: string, listener: ServiceWorkerListener) => listeners.set(type, listener),
    clients: { claim: async () => undefined },
    location: { origin: "https://round-robin.test" },
    skipWaiting: async () => undefined,
  };

  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    Headers,
    Response,
    caches,
    console: { log: () => undefined, error: () => undefined },
    fetch: async () => new Response("ok"),
    performance,
    self,
  });

  return { deletedCaches, listeners };
};

const loadFetchListener = () => {
  const { listeners } = loadServiceWorker();
  const listener = listeners.get("fetch");
  assert.ok(listener, "service worker must register a fetch listener");
  return listener;
};

const isHandledByServiceWorker = (listener: ServiceWorkerListener, request: Request) => {
  let handled = false;
  listener({
    request,
    respondWith: (response) => {
      handled = true;
      void Promise.resolve(response).catch(() => undefined);
    },
  } as FetchEvent);
  return handled;
};

describe("service worker cache policy", () => {
  it("deletes cache generations that may contain sensitive responses", async () => {
    const { deletedCaches, listeners } = loadServiceWorker([
      "api-v1.0.3",
      "dynamic-v1.0.3",
      "images-v1.0.3",
      "static-v1.0.3",
      "static-v1.0.4",
    ]);
    const listener = listeners.get("activate");
    assert.ok(listener, "service worker must register an activate listener");

    let completion = Promise.resolve<unknown>(undefined);
    listener({
      waitUntil: (promise) => {
        completion = promise;
      },
    } as ActivationEvent);
    await completion;

    assert.deepEqual(
      deletedCaches.sort(),
      ["api-v1.0.3", "dynamic-v1.0.3", "images-v1.0.3", "static-v1.0.3", "static-v1.0.4"],
    );
  });

  it("leaves Supabase data requests on the network", () => {
    const listener = loadFetchListener();

    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://project.supabase.co/rest/v1/patients?select=*"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://project.supabase.co/functions/v1/parse-single-patient"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://project.supabase.co/storage/v1/object/sign/patient-images/a.png"),
    ), false);
  });

  it("leaves requests carrying credentials on the network", () => {
    const listener = loadFetchListener();

    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/private.json", {
        headers: { Authorization: "Bearer secret" },
      }),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/private.json", {
        headers: { apikey: "secret" },
      }),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/private.json?key=secret"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/fhir/callback?code=one-time-code&state=opaque-state"),
    ), false);
    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://generativelanguage.googleapis.com/v1beta/models"),
    ), false);
  });

  it("continues to handle public static assets for offline use", () => {
    const listener = loadFetchListener();

    assert.equal(isHandledByServiceWorker(
      listener,
      new Request("https://round-robin.test/assets/app.js"),
    ), true);
  });
});
