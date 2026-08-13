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

type ServiceWorkerOptions = {
  cachedResponse?: Response;
  cachedRequestUrl?: string;
  initialCacheNames?: string[];
  networkResponse?: Response;
};

const loadServiceWorker = ({
  cachedResponse,
  cachedRequestUrl,
  initialCacheNames = [],
  networkResponse,
}: ServiceWorkerOptions = {}) => {
  const listeners = new Map<string, ServiceWorkerListener>();
  const deletedCaches: string[] = [];
  const cache = {
    addAll: async () => undefined,
    delete: async () => true,
    keys: async () => [],
    match: async (request: Request) => {
      if (cachedRequestUrl && request.url !== cachedRequestUrl) return undefined;
      return cachedResponse?.clone();
    },
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
    fetch: async () => networkResponse?.clone() ?? new Response("ok"),
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

const getServiceWorkerResponse = async (
  listener: ServiceWorkerListener,
  request: Request,
): Promise<Response> => {
  let responsePromise: Promise<Response> | undefined;
  listener({
    request,
    respondWith: (response) => {
      responsePromise = Promise.resolve(response);
    },
  } as FetchEvent);
  assert.ok(responsePromise, "service worker must handle the request");
  return responsePromise;
};

describe("service worker cache policy", () => {
  it("surfaces production worker updates through the application shell", () => {
    const main = readFileSync("src/main.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");

    assert.match(main, /markServiceWorkerUpdateReady\(\)/);
    assert.doesNotMatch(main, /New content available, refresh to update/);
    assert.match(app, /<ServiceWorkerUpdatePrompt \/>/);
  });

  it("deletes cache generations that may contain sensitive responses", async () => {
    const { deletedCaches, listeners } = loadServiceWorker({
      initialCacheNames: [
        "api-v1.0.3",
        "dynamic-v1.0.3",
        "images-v1.0.3",
        "static-v1.0.3",
        "static-v1.0.4",
      ],
    });
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

  it("uses a fresh cached app shell when an HTML navigation receives HTTP 503", async () => {
    const cachedResponse = new Response("cached app shell", {
      status: 200,
      headers: {
        "content-type": "text/html",
        "sw-cache-time": Date.now().toString(),
      },
    });
    const { listeners } = loadServiceWorker({
      cachedResponse,
      networkResponse: new Response("upstream unavailable", { status: 503 }),
    });
    const listener = listeners.get("fetch");
    assert.ok(listener, "service worker must register a fetch listener");

    const response = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/", {
        headers: { accept: "text/html" },
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "cached app shell");
  });

  it("does not hide an authoritative HTTP 404 behind a cached app shell", async () => {
    const { listeners } = loadServiceWorker({
      cachedResponse: new Response("cached app shell", {
        status: 200,
        headers: { "sw-cache-time": Date.now().toString() },
      }),
      networkResponse: new Response("not found", { status: 404 }),
    });
    const listener = listeners.get("fetch");
    assert.ok(listener, "service worker must register a fetch listener");

    const response = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/missing", {
        headers: { accept: "text/html" },
      }),
    );

    assert.equal(response.status, 404);
    assert.equal(await response.text(), "not found");
  });

  it("uses a cached hashed JavaScript chunk when deployment cleanup returns HTTP 404", async () => {
    const { listeners } = loadServiceWorker({
      cachedRequestUrl: "https://round-robin.test/assets/chunk-OLD.js",
      cachedResponse: new Response("cached chunk", {
        status: 200,
        headers: {
          "content-type": "text/javascript",
          "sw-cache-time": Date.now().toString(),
        },
      }),
      networkResponse: new Response("missing", { status: 404 }),
    });
    const listener = listeners.get("fetch");
    assert.ok(listener, "service worker must register a fetch listener");

    const response = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/assets/chunk-OLD.js"),
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "cached chunk");

    const unrelatedResponse = await getServiceWorkerResponse(
      listener,
      new Request("https://round-robin.test/assets/chunk-NEW.js"),
    );
    assert.equal(unrelatedResponse.status, 404);
    assert.equal(await unrelatedResponse.text(), "missing");
  });
});
