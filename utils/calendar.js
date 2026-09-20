const dateUtil = require('./date.js')
const storage = require('./storage.js')

// 取出生日的提醒偏移（提前天数）列表，由远到近排序；兼容旧的 remindDaysBefore
function offsetsOf(b) {
  let arr = b.remindOffsets
  if (!Array.isArray(arr) || !arr.length) {
    arr = [typeof b.remindDaysBefore === 'number' ? b.remindDaysBefore : 0]
  }
  return arr.slice().sort(function (a, c) { return c - a })
}

function offsetText(off) {
  return off > 0 ? '提前' + off + '天' : '当天'
}

function eventTitle(b, off) {
  const name = (b.name || '').trim() || '生日'
  const suffix = off > 0 ? '（提前' + off + '天）' : ''
  return name + '的生日' + suffix
}

function eventDescription(b, occ) {
  const lines = []
  lines.push(b.calendarType === 'lunar'
    ? ('农历生日：' + dateUtil.lunarDateLabel(b.month, b.day, b.isLeapMonth))
    : ('公历生日：' + dateUtil.solarDateLabel(b.month, b.day)))
  lines.push('生日当天：' + dateUtil.toDateStr(occ))
  const offs = offsetsOf(b)
  lines.push('提醒设置：' + offs.map(offsetText).join('、') + '，共 ' + offs.length + ' 次')
  if (b.calendarType === 'lunar' || (b.month === 2 && b.day === 29)) {
    lines.push('提醒：本次生日过后，请打开「记得生日」小程序补充明年的提醒。')
  }
  if (b.note) {
    lines.push('备注：' + b.note)
  }
  return lines.join('\n')
}

function buildEvent(b, occ, off) {
  const daysBefore = off || 0
  const h = typeof b.remindHour === 'number' ? b.remindHour : 9
  const mi = typeof b.remindMinute === 'number' ? b.remindMinute : 0
  const base = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate(), h, mi, 0, 0)
  const start = new Date(base.getTime() - daysBefore * dateUtil.MS_PER_DAY)
  const end = new Date(start.getTime() + 3600000)
  return {
    title: eventTitle(b, daysBefore),
    startTime: Math.floor(start.getTime() / 1000),
    endTime: Math.floor(end.getTime() / 1000),
    allDay: false,
    alarm: true,
    alarmOffset: 0,
    description: eventDescription(b, occ)
  }
}

function addRepeatEvent(b, occ, off) {
  return new Promise(function (resolve, reject) {
    if (typeof wx.addPhoneRepeatCalendar === 'function') {
      wx.addPhoneRepeatCalendar(Object.assign({}, buildEvent(b, occ, off), {
        repeatInterval: 'year',
        success: resolve,
        fail: reject
      }))
    } else {
      // 低版本基础库没有重复接口，退化为单次
      wx.addPhoneCalendar(Object.assign({}, buildEvent(b, occ, off), {
        success: resolve,
        fail: reject
      }))
    }
  })
}

function addSingleEvent(b, occ, off) {
  return new Promise(function (resolve, reject) {
    wx.addPhoneCalendar(Object.assign({}, buildEvent(b, occ, off), {
      success: resolve,
      fail: reject
    }))
  })
}

// 本次要写入系统日历的目标日期
// - 首次添加：取今天及之后最近的一次生日
// - 已经排到未来：沿用那条
// - 已排的已过期/就是今天：取今天之后的第一次（即明年）
function targetDate(b, from) {
  const f = from || dateUtil.today()
  const sd = b.scheduledDate ? dateUtil.parseDateStr(b.scheduledDate) : null
  if (sd && dateUtil.dayDiff(f, sd) > 0) return sd
  if (sd) return dateUtil.occurrenceAfter(b, f)
  return dateUtil.nextOccurrence(b, f)
}

// 该生日是否还需要写入/补充系统日历
function needsSync(b, from) {
  if (!b.remind) return false
  const f = from || dateUtil.today()
  if (dateUtil.canUseYearRepeat(b)) {
    return !b.scheduledRepeat
  }
  const sd = b.scheduledDate ? dateUtil.parseDateStr(b.scheduledDate) : null
  if (!sd) return true
  return dateUtil.dayDiff(f, sd) <= 0
}

// 按提醒次数写入多条系统日历事件，并记录已写入的信息
function syncBirthday(b, from) {
  const f = from || dateUtil.today()
  const repeat = dateUtil.canUseYearRepeat(b)
  const occ = repeat ? dateUtil.nextOccurrence(b, f) : targetDate(b, f)
  const occStr = dateUtil.toDateStr(occ)
  const offs = offsetsOf(b)

  let chain = Promise.resolve()
  offs.forEach(function (off) {
    chain = chain.then(function () {
      return repeat ? addRepeatEvent(b, occ, off) : addSingleEvent(b, occ, off)
    })
  })

  return chain.then(function () {
    storage.patch(b.id, { scheduledRepeat: repeat, scheduledDate: occStr })
    return occStr
  })
}

module.exports = {
  needsSync: needsSync,
  syncBirthday: syncBirthday,
  buildEvent: buildEvent,
  offsetsOf: offsetsOf,
  targetDate: targetDate
}
