const storage = require('../../utils/storage.js')
const dateUtil = require('../../utils/date.js')
const calendar = require('../../utils/calendar.js')

const RELATIONS = ['不设置', '家人', '亲戚', '朋友', '同事', '同学', '其他']
const BEFORE_LABELS = ['当天提醒', '提前 1 天', '提前 2 天', '提前 3 天', '提前 7 天']
const BEFORE_DAYS = [0, 1, 2, 3, 7]
const COUNT_LABELS = ['1 次', '2 次', '3 次']
const MAX_REMIND = 3
const CURRENT_YEAR = new Date().getFullYear()

function buildMonthRange(type) {
  if (type === 'lunar') {
    return ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
  }
  const r = []
  for (let i = 1; i <= 12; i++) r.push(i + ' 月')
  return r
}

function buildDayRange(type) {
  const r = []
  if (type === 'lunar') {
    for (let i = 1; i <= 30; i++) r.push(dateUtil.LUNAR_DAY_NAMES[i])
  } else {
    for (let i = 1; i <= 31; i++) r.push(i + ' 日')
  }
  return r
}

function buildYearRange() {
  const r = ['不填写']
  for (let y = CURRENT_YEAR; y >= 1900; y--) r.push(y + ' 年')
  return r
}

// 把偏移数组整理成合法的 1~3 个不重复值
function normalizeOffsets(arr) {
  let out = Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'number' }) : []
  const seen = []
  out.forEach(function (x) { if (seen.indexOf(x) === -1) seen.push(x) })
  if (!seen.length) seen.push(0)
  return seen.slice(0, MAX_REMIND)
}

// 调整提醒次数时补齐偏移：优先用还没用过的“提前天数”
function fillOffsets(existing, count) {
  const out = normalizeOffsets(existing).slice(0, count)
  const used = out.slice()
  const candidates = [7, 3, 2, 1, 0]
  while (out.length < count) {
    let pick = 0
    for (let i = 0; i < candidates.length; i++) {
      if (used.indexOf(candidates[i]) === -1) { pick = candidates[i]; break }
    }
    out.push(pick)
    used.push(pick)
  }
  return out
}

function buildOffsetRows(offsets) {
  return offsets.map(function (o, i) {
    const vi = BEFORE_DAYS.indexOf(o)
    return { key: 'slot' + i, label: '第 ' + (i + 1) + ' 次提醒', valueIndex: vi >= 0 ? vi : 0 }
  })
}

function remindSignature(x) {
  const offs = normalizeOffsets(x.remindOffsets).slice().sort(function (a, b) { return a - b })
  return [
    x.calendarType,
    x.month,
    x.day,
    x.isLeapMonth ? 1 : 0,
    x.remindHour,
    x.remindMinute,
    offs.join(','),
    x.remind ? 1 : 0
  ].join('|')
}

Page({
  data: {
    id: '',
    isEdit: false,
    monthRange: [],
    dayRange: [],
    yearRange: [],
    relationRange: RELATIONS,
    beforeRange: BEFORE_LABELS,
    countRange: COUNT_LABELS,
    countIndex: 0,
    monthIndex: 0,
    dayIndex: 0,
    yearIndex: 0,
    relationIndex: 0,
    offsetRows: [],
    form: {
      name: '',
      calendarType: 'solar',
      month: 1,
      day: 1,
      isLeapMonth: false,
      year: null,
      relation: '',
      note: '',
      remind: true,
      remindTime: '09:00',
      remindOffsets: [0]
    },
    preview: { dateStr: '', label: '', ageText: '' }
  },

  onLoad(options) {
    let form = this.data.form
    let id = ''
    let isEdit = false

    if (options && options.id) {
      const item = storage.getById(options.id)
      if (item) {
        id = item.id
        isEdit = true
        form = {
          name: item.name || '',
          calendarType: item.calendarType || 'solar',
          month: item.month || 1,
          day: item.day || 1,
          isLeapMonth: !!item.isLeapMonth,
          year: item.year || null,
          relation: item.relation || '',
          note: item.note || '',
          remind: item.remind !== false,
          remindTime: dateUtil.pad2(typeof item.remindHour === 'number' ? item.remindHour : 9) + ':' +
            dateUtil.pad2(typeof item.remindMinute === 'number' ? item.remindMinute : 0),
          remindOffsets: normalizeOffsets(
            Array.isArray(item.remindOffsets) && item.remindOffsets.length
              ? item.remindOffsets
              : [typeof item.remindDaysBefore === 'number' ? item.remindDaysBefore : 0]
          )
        }
      }
    }

    this.setData({
      id: id,
      isEdit: isEdit,
      form: form,
      yearRange: buildYearRange(),
      monthRange: buildMonthRange(form.calendarType),
      dayRange: buildDayRange(form.calendarType)
    })

    this.syncIndices()
  },

  syncIndices() {
    const f = this.data.form
    const monthIndex = Math.max(0, Math.min(this.data.monthRange.length - 1, f.month - 1))
    const dayIndex = Math.max(0, Math.min(this.data.dayRange.length - 1, f.day - 1))
    let yearIndex = 0
    if (f.year) {
      const i = this.data.yearRange.indexOf(f.year + ' 年')
      yearIndex = i >= 0 ? i : 0
    }
    const relationIndex = Math.max(0, RELATIONS.indexOf(f.relation))
    const offsets = normalizeOffsets(f.remindOffsets)
    this.setData({
      monthIndex: monthIndex,
      dayIndex: dayIndex,
      yearIndex: yearIndex,
      relationIndex: relationIndex,
      countIndex: Math.max(0, offsets.length - 1),
      offsetRows: buildOffsetRows(offsets)
    })
    this.updatePreview()
  },

  updatePreview() {
    const f = this.data.form
    const b = {
      calendarType: f.calendarType,
      month: f.month,
      day: f.day,
      isLeapMonth: f.isLeapMonth,
      year: f.year
    }
    const from = dateUtil.today()
    const occ = dateUtil.nextOccurrence(b, from)
    const days = dateUtil.dayDiff(from, occ)
    const age = dateUtil.ageAt(b, occ)
    this.setData({
      preview: {
        dateStr: dateUtil.toDateStr(occ),
        label: dateUtil.countdownLabel(days),
        ageText: age === null ? '' : age + ' 岁'
      }
    })
  },

  onName(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onCalendarType(e) {
    const v = e.currentTarget.dataset.v
    if (v === this.data.form.calendarType) return
    const form = Object.assign({}, this.data.form, { calendarType: v })
    if (v === 'lunar' && form.day > 30) form.day = 30
    this.setData({
      form: form,
      monthRange: buildMonthRange(v),
      dayRange: buildDayRange(v)
    })
    this.syncIndices()
  },

  onMonth(e) {
    const idx = Number(e.detail.value)
    this.setData({ monthIndex: idx, 'form.month': idx + 1 })
    this.updatePreview()
  },

  onDay(e) {
    const idx = Number(e.detail.value)
    this.setData({ dayIndex: idx, 'form.day': idx + 1 })
    this.updatePreview()
  },

  onLeap(e) {
    this.setData({ 'form.isLeapMonth': e.detail.value })
    this.updatePreview()
  },

  onYear(e) {
    const idx = Number(e.detail.value)
    const y = idx === 0 ? null : Number(this.data.yearRange[idx].replace(' 年', ''))
    this.setData({ yearIndex: idx, 'form.year': y })
    this.updatePreview()
  },

  onRelation(e) {
    const idx = Number(e.detail.value)
    this.setData({ relationIndex: idx, 'form.relation': idx === 0 ? '' : RELATIONS[idx] })
  },

  onRemind(e) {
    this.setData({ 'form.remind': e.detail.value })
  },

  onTime(e) {
    this.setData({ 'form.remindTime': e.detail.value })
  },

  onRemindCount(e) {
    const idx = Number(e.detail.value)
    const offsets = fillOffsets(this.data.form.remindOffsets, idx + 1)
    this.setData({ 'form.remindOffsets': offsets })
    this.syncIndices()
  },

  onOffset(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const val = Number(e.detail.value)
    const offsets = normalizeOffsets(this.data.form.remindOffsets).slice()
    offsets[idx] = BEFORE_DAYS[val]
    this.setData({ 'form.remindOffsets': offsets })
    this.syncIndices()
  },

  onNote(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onSave() {
    const f = this.data.form
    const name = (f.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }

    const parts = (f.remindTime || '09:00').split(':')
    const offsets = normalizeOffsets(f.remindOffsets)
    const item = {
      id: this.data.id || undefined,
      name: name,
      calendarType: f.calendarType,
      month: f.month,
      day: f.day,
      isLeapMonth: f.calendarType === 'lunar' ? !!f.isLeapMonth : false,
      year: f.year,
      relation: f.relation,
      note: f.note,
      remind: !!f.remind,
      remindHour: Number(parts[0]),
      remindMinute: Number(parts[1]),
      remindOffsets: offsets,
      remindDaysBefore: Math.max.apply(null, offsets)
    }

    let reset = false
    if (this.data.isEdit) {
      const old = storage.getById(this.data.id)
      if (old && remindSignature(old) !== remindSignature(item)) reset = true
    }
    if (reset) {
      item.scheduledRepeat = false
      item.scheduledDate = ''
    }

    const saved = storage.upsert(item)

    if (saved.remind && calendar.needsSync(saved)) {
      wx.showModal({
        title: '已保存',
        content: '是否现在把这个生日添加到系统日历？（共 ' + offsets.length + ' 次提醒）',
        confirmText: '添加',
        cancelText: '稍后',
        success(res) {
          if (res.confirm) {
            wx.showLoading({ title: '添加中...', mask: true })
            calendar.syncBirthday(saved).then(function () {
              wx.hideLoading()
              wx.showToast({ title: '已加入日历', icon: 'success' })
              setTimeout(function () { wx.navigateBack() }, 800)
            }).catch(function (err) {
              wx.hideLoading()
              wx.showModal({
                title: '添加失败',
                content: (err && err.errMsg) || '请允许日历权限后重试',
                showCancel: false
              })
            })
          } else {
            wx.navigateBack()
          }
        }
      })
    } else {
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(function () { wx.navigateBack() }, 600)
    }
  },

  onDelete() {
    const self = this
    wx.showModal({
      title: '删除记录',
      content: '确定删除吗？已写入手机系统日历的提醒需要你自己在日历里删除。',
      confirmColor: '#ff5d73',
      success(res) {
        if (res.confirm) {
          storage.remove(self.data.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 500)
        }
      }
    })
  }
})
