import test from "node:test";
import assert from "node:assert/strict";
import {
  activateWaitingServiceWorker,
  clearServiceWorkerUpdateReady,
  markServiceWorkerUpdateReady,
} from "./serviceWorkerUpdate";

test("explicit activation waits for controller handoff before succeeding", async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  const controllerChangeListeners = new Set<() => void>();
  const messages: unknown[] = [];
  const waitingWorker = {
    postMessage: (message: unknown) => {
      messages.push(message);
      queueMicrotask(() => {
        for (const listener of controllerChangeListeners) listener();
      });
    },
  } as unknown as ServiceWorker;
  const serviceWorkerContainer = {
    addEventListener: (_type: string, listener: () => void) => {
      controllerChangeListeners.add(listener);
    },
    getRegistration: async () => ({ waiting: waitingWorker }),
    removeEventListener: (_type: string, listener: () => void) => {
      controllerChangeListeners.delete(listener);
    },
  } as unknown as ServiceWorkerContainer;

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorkerContainer,
  });

  try {
    markServiceWorkerUpdateReady(waitingWorker);
    assert.equal(await activateWaitingServiceWorker(100), true);
    assert.deepEqual(messages, [{ type: "SKIP_WAITING" }]);
  } finally {
    clearServiceWorkerUpdateReady();
    if (originalDescriptor) {
      Object.defineProperty(navigator, "serviceWorker", originalDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  }
});

test("activation failure stays false when no waiting worker exists", async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      getRegistration: async () => undefined,
      removeEventListener: () => undefined,
    },
  });

  try {
    assert.equal(await activateWaitingServiceWorker(1), false);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(navigator, "serviceWorker", originalDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  }
});

test("a worker activated by a sibling tab is immediately reload-ready", async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  let postMessageCalls = 0;
  const activatedWorker = {
    postMessage: () => { postMessageCalls += 1; },
    state: "activated",
  } as unknown as ServiceWorker;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      controller: activatedWorker,
      getRegistration: async () => ({ active: activatedWorker, waiting: null }),
      removeEventListener: () => undefined,
    },
  });

  try {
    markServiceWorkerUpdateReady(activatedWorker);
    assert.equal(await activateWaitingServiceWorker(1), true);
    assert.equal(postMessageCalls, 0);
  } finally {
    clearServiceWorkerUpdateReady();
    if (originalDescriptor) {
      Object.defineProperty(navigator, "serviceWorker", originalDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  }
});
