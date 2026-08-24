import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default {
  ...pkg.build,
  appId: 'dev.dalzio.hermes-remote-desktop',
  productName: 'Hermes Remote Desktop',
  executableName: 'Hermes Remote Desktop',
  artifactName: 'Hermes-Remote-Desktop-${version}-${arch}.${ext}',
  extraResources: pkg.build.extraResources.filter(resource => resource.to !== 'install-stamp.json'),
  win: {
    ...pkg.build.win,
    target: ['nsis']
  },
  nsis: {
    ...pkg.build.nsis,
    shortcutName: 'Hermes Remote Desktop',
    uninstallDisplayName: 'Hermes Remote Desktop'
  }
}