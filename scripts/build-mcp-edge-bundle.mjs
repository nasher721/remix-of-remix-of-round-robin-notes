/**
 * Builds JSON payload for Supabase MCP deploy_edge_function from supabase/functions/.
 * Usage: node scripts/build-mcp-edge-bundle.mjs <function-slug>
 * Writes to stdout (redirect to file if needed).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'supabase/functions')
const slug = process.argv[2]
if (!slug) {
  console.error('Usage: node scripts/build-mcp-edge-bundle.mjs <function-slug>')
  process.exit(1)
}

/** healthcheck only needs CORS helpers; keep MCP deploy payload small */
const sharedFiles =
  slug === 'healthcheck'
    ? ['_shared/cors.ts']
    : [
        '_shared/mod.ts',
        '_shared/auth.ts',
        '_shared/cors.ts',
        '_shared/llm-client.ts',
        '_shared/rate-limit.ts',
        '_shared/input-validation.ts',
      ]

const files = []
files.push({
  name: `functions/${slug}/index.ts`,
  content: fs.readFileSync(path.join(root, slug, 'index.ts'), 'utf8'),
})
for (const rel of sharedFiles) {
  files.push({
    name: `functions/${rel}`,
    content: fs.readFileSync(path.join(root, rel), 'utf8'),
  })
}

const payload = {
  project_id: 'zsavxqvnseqxusfwdovu',
  name: slug,
  entrypoint_path: `functions/${slug}/index.ts`,
  verify_jwt: slug !== 'healthcheck',
  files,
}

process.stdout.write(JSON.stringify(payload))
