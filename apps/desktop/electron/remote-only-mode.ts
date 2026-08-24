export const REMOTE_ONLY_LOCAL_RUNTIME_ERROR =
  'This Hermes Remote Desktop build connects to an existing gateway and cannot start or install a local runtime.'

export function remoteOnlyBuild(value: unknown = process.env.HERMES_DESKTOP_REMOTE_ONLY): boolean {
  return value === '1'
}

export function remoteOnlyBackend<Args>(args: Args) {
  return {
    kind: 'remote-only' as const,
    label: 'Hermes Remote Desktop requires an existing gateway',
    command: null,
    args,
    bootstrap: false,
    env: {},
    shell: false,
    platform: process.platform
  }
}

export function assertRemoteOnlyConnectionMode(mode: unknown): void {
  if (mode === 'local') {
    throw new Error(REMOTE_ONLY_LOCAL_RUNTIME_ERROR)
  }
}

interface RemoteOnlyUpdateStatusOptions {
  appPath: string
  branch?: null | string
  currentSha?: null | string
  fetchedAt?: number
}

export function remoteOnlyUpdateStatus({
  appPath,
  branch = null,
  currentSha = null,
  fetchedAt = Date.now()
}: RemoteOnlyUpdateStatusOptions) {
  return {
    supported: false,
    reason: 'remote-only-package',
    message: 'Install a newer Hermes Remote Desktop package from GitHub Actions to update this client.',
    branch,
    behind: 0,
    updateAvailable: false,
    currentSha,
    currentBranch: branch,
    targetSha: currentSha,
    commits: [],
    dirty: false,
    hermesRoot: appPath,
    fetchedAt
  }
}