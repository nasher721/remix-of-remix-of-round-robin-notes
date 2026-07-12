import assert from 'node:assert/strict';
import test from 'node:test';

import { LLMRouter } from './LLMRouter';
import type { LLMProvider, LLMProviderName, LLMRequest, LLMResponse } from './types';

class StubProvider implements LLMProvider {
  readonly requests: LLMRequest[] = [];

  constructor(
    readonly name: LLMProviderName,
    private readonly content: string,
    private readonly succeeds = true,
  ) {}

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<string[]> {
    return ['test-model'];
  }

  async sendMessage(request: LLMRequest): Promise<LLMResponse> {
    this.requests.push(request);
    return {
      success: this.succeeds,
      content: this.succeeds ? this.content : '',
      provider: this.name,
      model: request.model,
      error: this.succeeds ? undefined : `${this.name} unavailable`,
    };
  }

  async stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse> {
    onToken(this.content);
    return this.sendMessage(request);
  }

  estimateTokens(input: string): number {
    return input.length;
  }
}

function createRouter(content: string): LLMRouter {
  const router = new LLMRouter({
    defaultProvider: 'openai',
    defaultModel: 'test-model',
    fallbackProvider: 'openai',
    fallbackModel: 'test-model',
    rules: [{
      task: 'general',
      preferredProvider: 'openai',
      preferredModel: 'test-model',
      fallbacks: [],
    }],
    maxRetries: 0,
    retryDelayMs: 0,
    timeoutMs: 100,
  });
  router.registerProvider(new StubProvider('openai', content));
  return router;
}

const BASE_REQUEST: LLMRequest = {
  model: 'test-model',
  systemPrompt: 'Preserve the supplied clinical facts.',
  userPrompt: 'Summarize the patient.',
  patientContext: { temperatureStatus: 'afebrile' },
};

test('router fails closed when clinical output contradicts patient context', async () => {
  const response = await createRouter('The patient is febrile.').request(BASE_REQUEST);

  assert.equal(response.success, false);
  assert.equal(response.content, '');
  assert.match(response.error ?? '', /clinical safety verification failed/i);
});

test('router returns clinical output that passes safety verification', async () => {
  const response = await createRouter('The patient remains afebrile.').request(BASE_REQUEST);

  assert.equal(response.success, true);
  assert.equal(response.content, 'The patient remains afebrile.');
});

test('router only permits unsafe output when safety is explicitly skipped', async () => {
  const response = await createRouter('The patient is febrile.').request(
    BASE_REQUEST,
    { skipSafety: true },
  );

  assert.equal(response.success, true);
});

test('router rejects output that fails feature validation instead of returning it as repaired', async () => {
  const response = await createRouter('Too short.').request(
    { ...BASE_REQUEST, patientContext: undefined },
    { feature: 'clinical_summary' },
  );

  assert.equal(response.success, false);
  assert.equal(response.content, '');
  assert.match(response.error ?? '', /validation failed/i);
});

test('an explicit provider fails closed without contacting another vendor', async () => {
  const router = new LLMRouter({
    defaultProvider: 'anthropic',
    defaultModel: 'claude-test',
    fallbackProvider: 'anthropic',
    fallbackModel: 'claude-test',
    rules: [{
      task: 'general',
      preferredProvider: 'anthropic',
      preferredModel: 'claude-test',
      fallbacks: [{ provider: 'openai', model: 'gpt-test' }],
    }],
    maxRetries: 0,
    retryDelayMs: 0,
    timeoutMs: 100,
  }, false);
  const selected = new StubProvider('openai', '', false);
  const otherVendor = new StubProvider('anthropic', 'must not be returned');
  router.registerProvider(selected);
  router.registerProvider(otherVendor);

  const response = await router.request(
    { ...BASE_REQUEST, patientContext: undefined, model: 'gpt-test' },
    { provider: 'openai', model: 'gpt-test', skipSafety: true },
  );

  assert.equal(response.success, false);
  assert.equal(response.provider, 'openai');
  assert.equal(selected.requests.length, 1);
  assert.equal(otherVendor.requests.length, 0);
});

test('a provider-specific request model fails closed without contacting another vendor', async () => {
  const router = new LLMRouter({
    defaultProvider: 'anthropic',
    defaultModel: 'claude-test',
    fallbackProvider: 'anthropic',
    fallbackModel: 'claude-test',
    rules: [{
      task: 'general',
      preferredProvider: 'anthropic',
      preferredModel: 'claude-test',
      fallbacks: [{ provider: 'openai', model: 'gpt-test' }],
    }],
    maxRetries: 0,
    retryDelayMs: 0,
    timeoutMs: 100,
  }, false);
  const modelVendor = new StubProvider('openai', '', false);
  const otherVendor = new StubProvider('anthropic', 'must not be returned');
  router.registerProvider(modelVendor);
  router.registerProvider(otherVendor);

  const response = await router.request(
    { ...BASE_REQUEST, patientContext: undefined, model: 'gpt-test' },
    { skipSafety: true },
  );

  assert.equal(response.success, false);
  assert.equal(response.provider, 'openai');
  assert.equal(modelVendor.requests.length, 1);
  assert.equal(otherVendor.requests.length, 0);
});

test('router removes direct identifiers before provider dispatch and preserves clinical facts', async () => {
  const router = new LLMRouter({
    defaultProvider: 'openai',
    defaultModel: 'test-model',
    fallbackProvider: 'openai',
    fallbackModel: 'test-model',
    rules: [{
      task: 'general',
      preferredProvider: 'openai',
      preferredModel: 'test-model',
      fallbacks: [],
    }],
    maxRetries: 0,
    retryDelayMs: 0,
    timeoutMs: 100,
  }, false);
  const provider = new StubProvider('openai', 'done');
  router.registerProvider(provider);

  const response = await router.request({
    model: 'test-model',
    systemPrompt: 'Summarize Jane Doe without losing clinical detail.',
    userPrompt: 'Jane Doe has MRN: 123456 and email jane@example.com.',
    patientContext: {
      patientName: 'Jane Doe',
      mrn: '123456',
      diagnosis: 'subarachnoid hemorrhage',
      clinicalSummary: 'Jane Doe remains neurologically intact.',
    },
  }, { provider: 'openai', model: 'test-model', skipSafety: true });

  assert.equal(response.success, true);
  assert.equal(provider.requests.length, 1);
  const outbound = provider.requests[0];
  const serialized = JSON.stringify(outbound);
  assert.doesNotMatch(serialized, /Jane Doe|123456|jane@example\.com/i);
  assert.match(serialized, /subarachnoid hemorrhage/i);
  assert.match(serialized, /neurologically intact/i);
  assert.match(serialized, /\[Patient\]/);
});

test('de-identification does not erase clinical words that match name parts', async () => {
  const router = new LLMRouter({
    defaultProvider: 'openai',
    defaultModel: 'test-model',
    fallbackProvider: 'openai',
    fallbackModel: 'test-model',
    rules: [{
      task: 'general',
      preferredProvider: 'openai',
      preferredModel: 'test-model',
      fallbacks: [],
    }],
    maxRetries: 0,
    retryDelayMs: 0,
    timeoutMs: 100,
  }, false);
  const provider = new StubProvider('openai', 'done');
  router.registerProvider(provider);

  await router.request({
    model: 'test-model',
    systemPrompt: 'Preserve the clinical plan.',
    userPrompt: 'May Will may improve and we will monitor closely.',
    patientContext: {
      patientName: 'May Will',
      clinicalSummary: 'The patient may improve and we will monitor closely.',
    },
  }, { provider: 'openai', model: 'test-model', skipSafety: true });

  const serialized = JSON.stringify(provider.requests[0]);
  assert.doesNotMatch(serialized, /May Will/);
  assert.match(serialized, /may improve and we will monitor closely/i);
});
