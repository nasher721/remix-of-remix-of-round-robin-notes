/**
 * Fails CI if any [functions.*] block sets verify_jwt = true.
 * Gateway JWT verification rejects ES256 user access tokens in this setup; auth is in-handler.
 */
import fs from 'node:fs'
import path from 'node:path'

const configPath = path.join(process.cwd(), 'supabase/config.toml')
const cfg = fs.readFileSync(configPath, 'utf8')
const sections = cfg.split(/\n(?=\[)/)

for (const sec of sections) {
  const t = sec.trimStart()
  if (!t.startsWith('[functions.')) continue
  const nameMatch = t.match(/^\[functions\.([^\]]+)\]/)
  const fnName = nameMatch?.[1]
  const jwtMatch = t.match(/verify_jwt\s*=\s*(true|false)/)
  if (jwtMatch && jwtMatch[1] === 'true') {
    console.error(
      `assert-edge-verify-jwt-config: [functions.${fnName}] has verify_jwt = true.`,
    )
    console.error(
      'This breaks signed-in calls when access tokens are ES256: the Edge gateway validates with legacy HS256.',
    )
    console.error(
      'Set verify_jwt = false and rely on authenticateRequest() (see supabase/config.toml header comment).',
    )
    process.exit(1)
  }
}

console.log(
  'Edge config OK: no [functions.*] uses verify_jwt = true (gateway JWT stays off for ES256 compatibility).',
)
