const storage = require('../../utils/storage.js')
const dateUtil = require('../../utils/date.js')
const festivals = require('../../utils/festivals.js')
const calendar = require('../../utils/calendar.js')

Page({
  data: {
    tab: 'birthday',
    todayStr: '',
    lunarToday: '',
    birthdays: [],
    pending: [],
    festivals: [],
    weekend: [],
    syncing: false
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  },

  refresh() {
    const from = dateUtil.today()
    const list = storage.getList()
    const decorated = list.map(function (b) { return dateUtil.decorate(b, from) })
    decorated.forEach(function (b) {
      b.needSync = calendar.needsSync(b, from)
    })
    decorated.sort(function (a, b) { return a.days - b.days })

    const pending = decorated.filter(function (b) { return b.needSync })

    this.setData({
      todayStr: dateUtil.toDateStr(from),
      lunarToday: dateUtil.lunarLabelFromDate(from),
      birthdays: decorated,
      pending: pending,
      festivals: festivals.getFestivals(from),
      weekend: festivals.getWeekend(from)
    })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/edit/edit' })
  },

  onEdit(e) {
    wx.navigateTo({ url: '/pages/edit/edit?id=' + e.currentTarget.dataset.id })
  },

  onSyncAll() {
    const pending = this.data.pending
    if (!pending.length || this.data.syncing) return
    const self = this
    wx.showModal({
      title: '添加到系统日历',
      content: '将为 ' + pending.length + ' 个生日写入系统日历提醒，过程中可能弹出授权提示。',
      confirmText: '添加',
      success(res) {
        if (res.confirm) self.runSync(pending)
      }
    })
  },

  onSyncOne(e) {
    if (this.data.syncing) return
    const id = e.currentTarget.dataset.id
    const one = this.data.pending.filter(function (x) { return x.id === id })
    if (one.length) this.runSync(one)
  },

  runSync(list) {
    const self = this
    this.setData({ syncing: true })
    wx.showLoading({ title: '添加中...', mask: true })

    let done = 0
    let failed = 0
    let lastErr = ''

    function step(i) {
      if (i >= list.length) {
        wx.hideLoading()
        self.setData({ syncing: false })
        self.refresh()
        if (failed) {
          wx.showModal({
            title: '部分添加失败',
            content: lastErr || '请确认已允许小程序使用日历权限后重试。',
            showCancel: false
          })
        } else {
          wx.showToast({ title: '已添加 ' + done + ' 个', icon: 'success' })
        }
        return
      }
      calendar.syncBirthday(list[i]).then(function () {
        done++
        step(i + 1)
      }).catch(function (err) {
        failed++
        lastErr = (err && err.errMsg) || ''
        step(i + 1)
      })
    }

    step(0)
  }
})
