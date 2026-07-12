import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GATEWAY_MODELS } from '@/constants/config'

describe('GATEWAY_MODELS', () => {
  it('offers only completion models accepted by the Edge allowlist', () => {
    assert.deepEqual(
      GATEWAY_MODELS.map(({ value }) => value),
      [
        '__default__',
        'gpt-4o',
        'gpt-4o-mini',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'grok-2',
        'grok-2-mini',
      ],
    )
  })
})
