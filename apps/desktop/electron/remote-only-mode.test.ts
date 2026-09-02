import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

import {
  assertRemoteOnlyConnectionMode,
  REMOTE_ONLY_LOCAL_RUNTIME_ERROR,
  remoteOnlyBackend,
  remoteOnlyBuild,
  remoteOnlyUpdateStatus
} from './remote-only-mode'

const APP_PATH = 'C:\\Program Files\\Hermes Remote Desktop\\resources\\app.asar'
const BRANCH = 'feat/windows-remote-desktop'
const SHA = 'ef967c758ce759cadddfa52ca24d314ac3126dd4'
const FETCHED_AT = 1234
const EXPECTED_PUBLISH_POLICY_COUNT = 1
const UPDATE_MESSAGE = 'Install a newer Hermes Remote Desktop package from GitHub Actions to update this client.'

function publishPolicyCount(value: string): number {
  return value.match(/--publish/g)?.length ?? 0
}

test('remote-only build flag is explicit and fail-closed', () => {
  assert.equal(remoteOnlyBuild('1'), true)
  assert.equal(remoteOnlyBuild('0'), false)
  assert.equal(remoteOnlyBuild(undefined), false)
})

test('remote-only distribution applies the no-publish policy exactly once', () => {
  const desktopPackage = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ) as { scripts: Record<string, string> }
  const builderWrapper = readFileSync(
    new URL('../scripts/run-electron-builder.mjs', import.meta.url),
    'utf8'
  )
  const remoteDistribution = desktopPackage.scripts['dist:win:remote']

  assert.equal(
    publishPolicyCount(`${builderWrapper}\n${remoteDistribution}`),
    EXPECTED_PUBLISH_POLICY_COUNT
  )
})

test('remote-only backend cannot name a local command', () => {
  const backend = remoteOnlyBackend(['serve'])

  assert.equal(backend.kind, 'remote-only')
  assert.equal(backend.command, null)
  assert.equal(backend.bootstrap, false)
  assert.deepEqual(backend.args, ['serve'])
})

test('remote-only connection mode rejects local but permits remote transports', () => {
  assert.throws(() => assertRemoteOnlyConnectionMode('local'), new RegExp(REMOTE_ONLY_LOCAL_RUNTIME_ERROR))
  assert.doesNotThrow(() => assertRemoteOnlyConnectionMode('remote'))
  assert.doesNotThrow(() => assertRemoteOnlyConnectionMode('cloud'))
  assert.doesNotThrow(() => assertRemoteOnlyConnectionMode('ssh'))
})

test('remote-only update status never inspects or updates a local Hermes checkout', () => {
  assert.deepEqual(
    remoteOnlyUpdateStatus({ appPath: APP_PATH, branch: BRANCH, currentSha: SHA, fetchedAt: FETCHED_AT }),
    {
      supported: false,
      reason: 'remote-only-package',
      message: UPDATE_MESSAGE,
      branch: BRANCH,
      behind: 0,
      updateAvailable: false,
      currentSha: SHA,
      currentBranch: BRANCH,
      targetSha: SHA,
      commits: [],
      dirty: false,
      hermesRoot: APP_PATH,
      fetchedAt: FETCHED_AT
    }
  )
})