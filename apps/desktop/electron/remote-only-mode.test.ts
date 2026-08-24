import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  assertRemoteOnlyConnectionMode,
  REMOTE_ONLY_LOCAL_RUNTIME_ERROR,
  remoteOnlyBackend,
  remoteOnlyBuild
} from './remote-only-mode'

test('remote-only build flag is explicit and fail-closed', () => {
  assert.equal(remoteOnlyBuild('1'), true)
  assert.equal(remoteOnlyBuild('0'), false)
  assert.equal(remoteOnlyBuild(undefined), false)
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