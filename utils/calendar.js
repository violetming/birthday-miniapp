const dateUtil = require('./date.js')
const storage = require('./storage.js')

function eventTitle(b) {
  const name = (b.name || '').trim() || '生日'
  return name + '的生日'
}

function eventDescription(b, occ) {
  const lines = []
  lines.push(b.calendarType === 'lunar'
    ? ('农历生日：' + dateUtil.lunarDateLabel(b.month, b.day, b.isLeapMonth))
    : ('公历生日：' + dateUtil.solarDateLabel(b.month, b.day)))
  lines.push('生日当天：' + dateUtil.toDateStr(occ))
  if (b.remindDaysBefore > 0) {
    lines.push('已设置提前 ' + b.remindDaysBefore + ' 天提醒')
  }
  if (b.calendarType === 'lunar' || (b.month === 2 && b.day === 29)) {
    lines.push('提醒：本次提醒过后，请打开「生日提醒」小程序补充明年的提醒。')
  }
  if (b.note) {
    lines.push('备注：' + b.note)
  }
  return lines.join('\n')
}

function buildEvent(b, occ) {
  const h = typeof b.remindHour === 'number' ? b.remindHour : 9
  const mi = typeof b.remindMinute === 'number' ? b.remindMinute : 0
  const base = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate(), h, mi, 0, 0)
  const shift = (b.remindDaysBefore || 0) * dateUtil.MS_PER_DAY
  const start = new Date(base.getTime() - shift)
  const end = new Date(start.getTime() + 3600000)
  return {
    title: eventTitle(b),
    startTime: Math.floor(start.getTime() / 1000),
    endTime: Math.floor(end.getTime() / 1000),
    allDay: false,
    alarm: true,
    alarmOffset: 0,
    description: eventDescription(b, occ)
  }
}

function addRepeatEvent(b, occ) {
  return new Promise(function (resolve, reject) {
    if (typeof wx.addPhoneRepeatCalendar === 'function') {
      wx.addPhoneRepeatCalendar(Object.assign({}, buildEvent(b, occ), {
        repeatInterval: 'year',
        success: resolve,
        fail: reject
      }))
    } else {
      // 低版本基础库没有重复接口，退化为单次
      wx.addPhoneCalendar(Object.assign({}, buildEvent(b, occ), {
        success: resolve,
        fail: reject
      }))
    }
  })
}

function addSingleEvent(b, occ) {
  return new Promise(function (resolve, reject) {
    wx.addPhoneCalendar(Object.assign({}, buildEvent(b, occ), {
      success: resolve,
      fail: reject
    }))
  })
}

// 该生日是否还需要写入/补充系统日历
function needsSync(b, from) {
  if (!b.remind) return false
  const f = from || dateUtil.today()
  const occStr = dateUtil.toDateStr(dateUtil.nextOccurrence(b, f))
  if (dateUtil.canUseYearRepeat(b)) {
    return !b.scheduledRepeat
  }
  return b.scheduledDate !== occStr
}

// 写入系统日历，并记录已写入的信息
function syncBirthday(b, from) {
  const f = from || dateUtil.today()
  const occ = dateUtil.nextOccurrence(b, f)
  const occStr = dateUtil.toDateStr(occ)
  if (dateUtil.canUseYearRepeat(b)) {
    return addRepeatEvent(b, occ).then(function () {
      storage.patch(b.id, { scheduledRepeat: true, scheduledDate: occStr })
      return occStr
    })
  }
  return addSingleEvent(b, occ).then(function () {
    storage.patch(b.id, { scheduledRepeat: false, scheduledDate: occStr })
    return occStr
  })
}

module.exports = {
  needsSync: needsSync,
  syncBirthday: syncBirthday,
  buildEvent: buildEvent
}
