const dateUtil = require('./date.js')

// 公历固定节日
const SOLAR_FESTIVALS = [
  { name: '元旦', month: 1, day: 1 },
  { name: '情人节', month: 2, day: 14 },
  { name: '妇女节', month: 3, day: 8 },
  { name: '植树节', month: 3, day: 12 },
  { name: '愚人节', month: 4, day: 1 },
  { name: '劳动节', month: 5, day: 1 },
  { name: '青年节', month: 5, day: 4 },
  { name: '儿童节', month: 6, day: 1 },
  { name: '建党节', month: 7, day: 1 },
  { name: '建军节', month: 8, day: 1 },
  { name: '教师节', month: 9, day: 10 },
  { name: '国庆节', month: 10, day: 1 },
  { name: '平安夜', month: 12, day: 24 },
  { name: '圣诞节', month: 12, day: 25 }
]

// 农历传统节日（除夕按腊月三十处理，小月自动落到廿九）
const LUNAR_FESTIVALS = [
  { name: '春节', month: 1, day: 1 },
  { name: '元宵节', month: 1, day: 15 },
  { name: '龙抬头', month: 2, day: 2 },
  { name: '端午节', month: 5, day: 5 },
  { name: '七夕', month: 7, day: 7 },
  { name: '中元节', month: 7, day: 15 },
  { name: '中秋节', month: 8, day: 15 },
  { name: '重阳节', month: 9, day: 9 },
  { name: '腊八节', month: 12, day: 8 },
  { name: '小年', month: 12, day: 23 },
  { name: '除夕', month: 12, day: 30 }
]

// 按“某月第几个星期几”计算的节日，weekday: 0=周日
const WEEKDAY_FESTIVALS = [
  { name: '母亲节', month: 5, weekday: 0, nth: 2 },
  { name: '父亲节', month: 6, weekday: 0, nth: 3 },
  { name: '感恩节', month: 11, weekday: 4, nth: 4 }
]

function nthWeekdayOfMonth(y, month, weekday, nth) {
  const first = dateUtil.makeDate(y, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return dateUtil.makeDate(y, month, 1 + offset + (nth - 1) * 7)
}

function nextWeekdayFestival(f, from) {
  let d = nthWeekdayOfMonth(from.getFullYear(), f.month, f.weekday, f.nth)
  if (dateUtil.dayDiff(from, d) < 0) {
    d = nthWeekdayOfMonth(from.getFullYear() + 1, f.month, f.weekday, f.nth)
  }
  return d
}

function getFestivals(from) {
  const f = from || dateUtil.today()
  const out = []

  SOLAR_FESTIVALS.forEach(function (x) {
    const d = dateUtil.nextSolarOccurrence(x.month, x.day, f)
    out.push({
      key: 's' + x.month + '-' + x.day,
      name: x.name,
      dateStr: dateUtil.toDateStr(d),
      days: dateUtil.dayDiff(f, d),
      type: 'solar'
    })
  })

  LUNAR_FESTIVALS.forEach(function (x) {
    const d = dateUtil.nextLunarOccurrence(x.month, x.day, false, f)
    out.push({
      key: 'l' + x.month + '-' + x.day,
      name: x.name,
      dateStr: dateUtil.toDateStr(d),
      days: dateUtil.dayDiff(f, d),
      type: 'lunar'
    })
  })

  WEEKDAY_FESTIVALS.forEach(function (x) {
    const d = nextWeekdayFestival(x, f)
    out.push({
      key: 'w' + x.name,
      name: x.name,
      dateStr: dateUtil.toDateStr(d),
      days: dateUtil.dayDiff(f, d),
      type: 'solar'
    })
  })

  out.sort(function (a, b) { return a.days - b.days })
  return out
}

function getWeekend(from) {
  const f = from || dateUtil.today()
  const dow = f.getDay()
  const satOffset = (6 - dow + 7) % 7
  const sunOffset = (0 - dow + 7) % 7
  const list = [
    { name: '周六', days: satOffset, dateStr: dateUtil.toDateStr(dateUtil.addDays(f, satOffset)) },
    { name: '周日', days: sunOffset, dateStr: dateUtil.toDateStr(dateUtil.addDays(f, sunOffset)) }
  ]
  list.forEach(function (x) { x.label = dateUtil.countdownLabel(x.days) })
  list.sort(function (a, b) { return a.days - b.days })
  return list
}

module.exports = {
  getFestivals: getFestivals,
  getWeekend: getWeekend
}
