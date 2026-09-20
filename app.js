const storage = require('./utils/storage.js')

App({
  globalData: {},
  onLaunch() {
    storage.ensureInit()
  }
})
