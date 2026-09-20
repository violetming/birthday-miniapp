const KEY = 'birthdays_v1'

function getList() {
  try {
    const list = wx.getStorageSync(KEY)
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function saveList(list) {
  try {
    wx.setStorageSync(KEY, list)
  } catch (e) {
    // 忽略存储异常
  }
}

function genId() {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function getById(id) {
  const list = getList()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i]
  }
  return null
}

function upsert(item) {
  const list = getList()
  let idx = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === item.id) { idx = i; break }
  }
  if (idx >= 0) {
    list[idx] = Object.assign({}, list[idx], item)
  } else {
    if (!item.id) item.id = genId()
    list.push(item)
  }
  saveList(list)
  return item
}

function patch(id, fields) {
  const list = getList()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i] = Object.assign({}, list[i], fields)
      saveList(list)
      return list[i]
    }
  }
  return null
}

function remove(id) {
  saveList(getList().filter(function (x) { return x.id !== id }))
}

function ensureInit() {
  try {
    const v = wx.getStorageSync(KEY)
    if (!Array.isArray(v)) saveList([])
  } catch (e) {
    // 忽略
  }
}

module.exports = {
  getList: getList,
  saveList: saveList,
  getById: getById,
  upsert: upsert,
  patch: patch,
  remove: remove,
  genId: genId,
  ensureInit: ensureInit
}
