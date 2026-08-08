import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GATEWAY_MODELS, resolveEditorFontSizePx } from '@/constants/config'

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

describe('resolveEditorFontSizePx', () => {
  it('preserves configured sizes on non-WebKit-touch environments', () => {
    assert.equal(resolveEditorFontSizePx(11), 11)
    assert.equal(resolveEditorFontSizePx(18), 18)
  })

  it('floors below 16px when WebKit touch callout is supported', () => {
    const previous = (globalThis as { CSS?: typeof CSS }).CSS
    ;(globalThis as { CSS: { supports: (property: string, value?: string) => boolean } }).CSS = {
      supports: (property: string, value?: string) =>
        property === '-webkit-touch-callout' && value === 'none',
    }
    try {
      assert.equal(resolveEditorFontSizePx(11), 16)
      assert.equal(resolveEditorFontSizePx(20), 20)
    } finally {
      if (previous === undefined) {
        delete (globalThis as { CSS?: typeof CSS }).CSS
      } else {
        ;(globalThis as { CSS: typeof CSS }).CSS = previous
      }
    }
  })
})
