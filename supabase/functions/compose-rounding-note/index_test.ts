import { handleComposeRoundingNote } from "./index.ts";
const assert = (v: unknown, message = "Assertion failed") => {
  if (!v) throw new Error(message);
};
const request = (body: unknown = { action: "capabilities", patientId: "p1" }) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
Deno.test("composer authenticates and checks patient ownership even for capability reads", async () => {
  const unauthorized = await handleComposeRoundingNote(request(), {
    authenticate: () =>
      Promise.resolve({ error: new Response(null, { status: 401 }) }),
  });
  assert(unauthorized.status === 401);
  const denied = await handleComposeRoundingNote(request(), {
    authenticate: () => Promise.resolve({ userId: "u1" }),
    canAccess: () => Promise.resolve(false),
    rateLimit: () => Promise.resolve({ allowed: true }),
    attempts: () => [],
  });
  assert(denied.status === 403);
});
Deno.test("unconfigured provider disables generation and responses cannot be cached", async () => {
  const response = await handleComposeRoundingNote(request(), {
    authenticate: () => Promise.resolve({ userId: "u1" }),
    canAccess: () => Promise.resolve(true),
    rateLimit: () => Promise.resolve({ allowed: true }),
    attempts: () => [],
  });
  assert(response.status === 200);
  assert((await response.json()).generation === false);
  assert(response.headers.get("Cache-Control") === "no-store");
});
Deno.test("rate limit preserves rejection without sending content to provider", async () => {
  const response = await handleComposeRoundingNote(request(), {
    authenticate: () => Promise.resolve({ userId: "u1" }),
    rateLimit: () =>
      Promise.resolve({
        allowed: false,
        response: new Response(null, { status: 429 }),
      }),
  });
  assert(response.status === 429);
});
Deno.test("unexpected errors return content-free categories", async () => {
  const response = await handleComposeRoundingNote(request(), {
    authenticate: () => Promise.reject(new Error("SECRET clinical source")),
  });
  assert(response.status === 503);
  assert(!(await response.text()).includes("SECRET"));
});
Deno.test("non-object request bodies are rejected before patient access", async () => {
  for (const body of [null, [], "text"]) {
    const response = await handleComposeRoundingNote(request(body), {
      authenticate: () => Promise.resolve({ userId: "u1" }),
      rateLimit: () => Promise.resolve({ allowed: true }),
      canAccess: () => {
        throw new Error("Must not access a patient");
      },
    });
    assert(response.status === 400);
  }
});
