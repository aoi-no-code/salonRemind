// JSTユーティリティ関数

export function toJst(date: Date): Date {
  const jstOffset = 9 * 60 // JSTはUTC+9
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
  return new Date(utc + (jstOffset * 60000))
}

export function formatJst(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const jstDate = toJst(d)
  
  const year = jstDate.getFullYear()
  const month = String(jstDate.getMonth() + 1).padStart(2, '0')
  const day = String(jstDate.getDate()).padStart(2, '0')
  const hours = String(jstDate.getHours()).padStart(2, '0')
  const minutes = String(jstDate.getMinutes()).padStart(2, '0')
  
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdays[jstDate.getDay()]
  
  return `${year}/${month}/${day}(${weekday}) ${hours}:${minutes}`
}

export function getJstDate(targetDate: Date, daysOffset: number): Date {
  const jstDate = toJst(targetDate)
  const result = new Date(jstDate)
  result.setDate(result.getDate() + daysOffset)
  return result
}

export function formatJstDate(date: Date): string {
  const jstDate = toJst(date)
  const year = jstDate.getFullYear()
  const month = String(jstDate.getMonth() + 1).padStart(2, '0')
  const day = String(jstDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 指定日のJSTにおける1日の開始/終了に対応するUTC境界を返す
// start/end はUTCのDate、startIso/endIsoはISO文字列（PostgRESTフィルタ用）
export function getUtcBoundsForJstDate(date: Date): {
  start: Date
  end: Date
  startIso: string
  endIso: string
} {
  const jstDate = toJst(date)
  const year = jstDate.getFullYear()
  const monthZeroBased = jstDate.getMonth()
  const day = jstDate.getDate()

  // 00:00 JST は UTC では前日の 15:00（-9h）
  const startUtc = new Date(Date.UTC(year, monthZeroBased, day, -9, 0, 0))
  const endUtc = new Date(Date.UTC(year, monthZeroBased, day + 1, -9, 0, 0))

  return {
    start: startUtc,
    end: endUtc,
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString()
  }
}
