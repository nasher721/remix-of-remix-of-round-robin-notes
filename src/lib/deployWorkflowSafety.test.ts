import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

describe('Supabase deployment workflow', () => {
  it('deploys only a successful CI-verified main commit and rechecks destructive inputs', async () => {
    const workflow = await readFile('.github/workflows/deploy-supabase.yml', 'utf8')

    assert.match(workflow, /workflow_run:/)
    assert.match(workflow, /workflows:\s*\n\s*- CI/)
    assert.match(workflow, /branches:\s*\n\s*- main/)
    assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/)
    assert.match(workflow, /github\.event\.workflow_run\.event == 'push'/)
    assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/)
    assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/)
    assert.match(workflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
    assert.doesNotMatch(workflow, /on:\s*\n\s*push:/)
    assert.match(workflow, /group: deploy-supabase-production/)
    assert.doesNotMatch(workflow, /group:.*head_sha/)

    const liveMainCheck = workflow.indexOf('git ls-remote')
    const checkout = workflow.indexOf('uses: actions/checkout@')
    assert.ok(liveMainCheck >= 0 && checkout > liveMainCheck)

    const liveMainChecks = Array.from(workflow.matchAll(/git ls-remote/g), (match) => match.index)
    const firstMutation = workflow.indexOf('Enforce restricted auth enrollment')
    assert.ok(liveMainChecks.length >= 2)
    assert.ok(liveMainChecks.at(-1)! < firstMutation)

    const validation = workflow.indexOf('npm run edge:verify')
    const migrationPush = workflow.indexOf('supabase db push')
    assert.ok(validation >= 0 && migrationPush > validation)
    assert.match(workflow, /npm run verify:migrations/)
    assert.match(workflow, /npm run edge:check-jwt-config/)
  })

  it('pins every third-party workflow action and grants read-only repository access', async () => {
    const workflowNames = (await readdir('.github/workflows'))
      .filter((name) => /\.ya?ml$/.test(name))
    const workflows = await Promise.all(workflowNames.map(async (name) => ({
      name,
      content: await readFile(`.github/workflows/${name}`, 'utf8'),
    })))
    const actionUses = workflows.flatMap(({ name, content }) =>
      Array.from(content.matchAll(/uses:\s*([^\s#]+)/g), (match) => ({ name, action: match[1] })),
    )

    assert.ok(actionUses.length > 0)
    for (const { name, action } of actionUses) {
      assert.match(action, /^[^@]+@[0-9a-f]{40}$/, `${name} must pin ${action}`)
    }
    for (const { name, content } of workflows) {
      assert.match(content, /permissions:\s*\n\s*contents: read/, `${name} must use read-only contents permission`)
    }
  })
})
