'use strict'

const fs = require('fs')
const path = require('path')

// ─── 데이터/설정 폴더 경로 ────────────────────────────────────────────────────
// 개발(Electron dev / standalone node): 프로젝트 루트의 data/, config/
// 프로덕션(패키징): userData/data/, userData/config/
//   지점별 값(shelter_id, 홍보 미디어 캐시 등)이라 재설치·자동 업데이트에도 유지되어야 함.
//   resources/data, resources/config는 빌드마다 덮어써지므로 최초 1회 기본값 복사용으로만 사용.

function getPackagedApp() {
  try {
    const { app } = require('electron')
    if (app && app.isPackaged) return app
  } catch {
    // standalone node process (e.g. node server/bridge.js)
  }
  return null
}

function seedIfMissing(srcDir, destDir) {
  if (fs.existsSync(destDir)) return
  fs.mkdirSync(destDir, { recursive: true })
  if (!fs.existsSync(srcDir)) return
  for (const file of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, file)
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(destDir, file))
  }
}

function getAppDir(name) {
  const app = getPackagedApp()
  if (!app) return path.join(__dirname, '..', name)
  const dir = path.join(app.getPath('userData'), name)
  seedIfMissing(path.join(process.resourcesPath, name), dir)
  return dir
}

const getDataDir = () => getAppDir('data')
const getConfigDir = () => getAppDir('config')

module.exports = { getDataDir, getConfigDir }
