const { Solar, Lunar, LunarYear, LunarMonth } = require('./lunar.js')

const MS_PER_DAY = 86400000

// 2月29日出生的人在非闰年的处理方式：'feb28' 用 2月28日，'mar1' 用 3月1日
const LEAP_DAY_MODE = 'feb28'

const LUNAR_MONTH_NAMES = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']

const LUNAR_DAY_NAMES = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function makeDate(y, m, d) {
  return new Date(y, m - 1, d)
}

function today() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function toDateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + n)
  return r
}

function dayDiff(a, b) {
  const au = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bu = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((bu - au) / MS_PER_DAY)
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function clampSolarDay(y, m, d) {
  if (m === 2 && d === 29 && !isLeapYear(y)) {
    return LEAP_DAY_MODE === 'mar1' ? makeDate(y, 3, 1) : makeDate(y, 2, 28)
  }
  return makeDate(y, m, d)
}

// 下一个公历生日（含今天）
function nextSolarOccurrence(m, d, from) {
  const y = from.getFullYear()
  for (let i = 0; i < 3; i++) {
    const cand = clampSolarDay(y + i, m, d)
    if (dayDiff(from, cand) >= 0) return cand
  }
  return clampSolarDay(y + 3, m, d)
}

// 农历某月的信息：是否为闰月、当月天数
function lunarMonthInfo(ly, month, isLeap) {
  let m = month
  let useLeap = false
  if (isLeap) {
    const leapMonth = LunarYear.fromYear(ly).getLeapMonth()
    if (leapMonth === month) {
      m = -month
      useLeap = true
    }
  }
  let days = 30
  try {
    days = LunarMonth.fromYm(ly, m).getDayCount()
  } catch (e) {
    days = 30
  }
  return { m: m, useLeap: useLeap, days: days }
}

// 下一个农历生日（含今天）；农历三十遇到小月自动按廿九
function nextLunarOccurrence(month, day, isLeap, from) {
  const fromLunarYear = Lunar.fromDate(from).getYear()
  for (let i = 0; i < 3; i++) {
    const ly = fromLunarYear + i
    const info = lunarMonthInfo(ly, month, isLeap)
    const dd = Math.min(day, info.days)
    const s = Lunar.fromYmd(ly, info.m, dd).getSolar()
    const cand = makeDate(s.getYear(), s.getMonth(), s.getDay())
    if (dayDiff(from, cand) >= 0) return cand
  }
  const ly = fromLunarYear + 3
  const info = lunarMonthInfo(ly, month, isLeap)
  const dd = Math.min(day, info.days)
  const s = Lunar.fromYmd(ly, info.m, dd).getSolar()
  return makeDate(s.getYear(), s.getMonth(), s.getDay())
}

function nextOccurrence(b, from) {
  const f = from || today()
  if (b.calendarType === 'lunar') {
    return nextLunarOccurrence(b.month, b.day, !!b.isLeapMonth, f)
  }
  return nextSolarOccurrence(b.month, b.day, f)
}

function ageAt(b, occDate) {
  if (!b.year) return null
  if (b.calendarType === 'lunar') {
    const ly = Lunar.fromDate(occDate).getYear()
    return ly - b.year
  }
  return occDate.getFullYear() - b.year
}

function countdownLabel(days) {
  if (days === 0) return '今天'
  if (days === 1) return '明天'
  if (days === 2) return '后天'
  return '还有 ' + days + ' 天'
}

function lunarDateLabel(month, day, isLeap) {
  return '农历 ' + (isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[month] + '月' + LUNAR_DAY_NAMES[day]
}

function solarDateLabel(month, day) {
  return '公历 ' + month + '月' + day + '日'
}

function birthdayDateLabel(b) {
  return b.calendarType === 'lunar'
    ? lunarDateLabel(b.month, b.day, b.isLeapMonth)
    : solarDateLabel(b.month, b.day)
}

// 把一条生日记录加工成可直接渲染的数据
function decorate(b, from) {
  const f = from || today()
  const occ = nextOccurrence(b, f)
  const days = dayDiff(f, occ)
  const age = ageAt(b, occ)
  return Object.assign({}, b, {
    occDateStr: toDateStr(occ),
    days: days,
    age: age,
    ageText: age === null ? '' : age + ' 岁',
    label: countdownLabel(days),
    dateLabel: birthdayDateLabel(b)
  })
}

// 今天对应的农历文字，如“农历八月十一”
function lunarLabelFromDate(d) {
  const l = Lunar.fromDate(d || today())
  let m = l.getMonth()
  let leap = false
  if (m < 0) {
    m = -m
    leap = true
  }
  return '农历' + (leap ? '闰' : '') + LUNAR_MONTH_NAMES[m] + '月' + LUNAR_DAY_NAMES[l.getDay()]
}

// 公历生日且非2/29 → 可以用系统日历“每年重复”
function canUseYearRepeat(b) {
  return b.calendarType !== 'lunar' && !(b.month === 2 && b.day === 29)
}

module.exports = {
  MS_PER_DAY: MS_PER_DAY,
  LUNAR_MONTH_NAMES: LUNAR_MONTH_NAMES,
  LUNAR_DAY_NAMES: LUNAR_DAY_NAMES,
  pad2: pad2,
  makeDate: makeDate,
  today: today,
  toDateStr: toDateStr,
  addDays: addDays,
  dayDiff: dayDiff,
  isLeapYear: isLeapYear,
  nextSolarOccurrence: nextSolarOccurrence,
  nextLunarOccurrence: nextLunarOccurrence,
  nextOccurrence: nextOccurrence,
  ageAt: ageAt,
  countdownLabel: countdownLabel,
  lunarDateLabel: lunarDateLabel,
  solarDateLabel: solarDateLabel,
  birthdayDateLabel: birthdayDateLabel,
  decorate: decorate,
  lunarLabelFromDate: lunarLabelFromDate,
  canUseYearRepeat: canUseYearRepeat
}
