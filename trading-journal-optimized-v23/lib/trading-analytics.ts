export type Trade = {
  id: string
  date: string
  result: 'win' | 'loss'
  amount: number
  risk?: number
  rr?: number
  heldTooLong: boolean
  ownTrade: boolean
  normalStopLoss?: boolean
  createdAt: string
}

export function getStats(trades: Trade[]) {
  const wins = trades.filter((t) => t.result === 'win')
  const losses = trades.filter((t) => t.result === 'loss')
  const activeDays = new Set(trades.map((t) => t.date)).size
  const totalProfit = wins.reduce((sum, t) => sum + t.amount, 0)
  const totalLoss = losses.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const avgWin = wins.length ? totalProfit / wins.length : 0
  const avgLoss = losses.length ? totalLoss / losses.length : 0
  const expectancy = trades.length ? (wins.length / trades.length) * avgWin - (losses.length / trades.length) * avgLoss : 0
  // 盈亏比按实际平均盈利 ÷ 平均亏损计算，避免只统计盈利单里手工填写的 RR 导致六芒星失真。
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0
  return {
    balance: totalProfit - totalLoss,
    totalProfit, totalLoss, wins: wins.length, losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgRR, avgTrades: activeDays ? trades.length / activeDays : 0,
    expectancy, avgWin, avgLoss,
    expectancyR: avgLoss > 0 ? expectancy / avgLoss : (expectancy > 0 ? 1 : 0),
    heldRate: trades.length ? trades.filter((t) => t.heldTooLong).length / trades.length : 0,
    ownRate: trades.length ? trades.filter((t) => t.ownTrade).length / trades.length : 0,
    normalStopRate: losses.length ? losses.filter((t) => t.normalStopLoss).length / losses.length : 0,
  }
}

export function getQuality(trades: Trade[]) {
  const s = getStats(trades)
  if (trades.length < 3) return { scores: [0, 0, 0, 0, 0, 0], strongest: '—', weakest: '—', issue: '样本不足', advice: '继续记录交易后再进行判断。' }
  // 交易频率不是越少越高分，也不是简单地“每多一笔就扣固定分”。
  // 以平均每日交易次数为主，并对单日明显过度交易做额外惩罚：
  // 1–3 笔：优秀；4–6 笔：正常偏优秀；7–10 笔：可接受；
  // 11–15 笔：明显扣分；16–20 笔：严重扣分；21+ 笔：接近最低分。
  const dailyCounts = Array.from(new Map(
    trades.map((t) => [t.date, 0])
  ).keys()).map((date) => trades.filter((t) => t.date === date).length)
  const baseFrequency =
    s.avgTrades <= 3 ? 100 :
    s.avgTrades <= 6 ? 95 :
    s.avgTrades <= 10 ? 90 - (s.avgTrades - 6) * 2.5 :
    s.avgTrades <= 15 ? 80 - (s.avgTrades - 10) * 4 :
    s.avgTrades <= 20 ? 60 - (s.avgTrades - 15) * 6 :
    Math.max(0, 30 - (s.avgTrades - 20) * 3)
  const overTradingPenalty = dailyCounts.reduce((penalty, count) => {
    if (count > 20) return penalty + 10
    if (count > 15) return penalty + 5
    return penalty
  }, 0)
  const frequency = Math.max(0, Math.min(100, baseFrequency - Math.min(30, overTradingPenalty)))
  // 盈亏比六芒星：按约定的 RR 标准做分段线性插值，避免 1:1.89 被旧公式直接打成 94 分。
  // 1:5=100；1:4=95；1:3.5=93；1:3=90；1:2.5=85；1:2=80；
  // 1:1.5=70；1:1.25=60；1:1=45；1:0.8=30；1:0.6=15；1:0.5=0。
  const rrAnchors = [[0.5,0],[0.6,15],[0.8,30],[1,45],[1.25,60],[1.5,70],[2,80],[2.5,85],[3,90],[3.5,93],[4,95],[5,100]] as const
  const rrScore = s.avgRR <= rrAnchors[0][0] ? rrAnchors[0][1] : s.avgRR >= rrAnchors[rrAnchors.length-1][0] ? rrAnchors[rrAnchors.length-1][1] : (()=>{
    for(let i=1;i<rrAnchors.length;i++){
      const [x1,y1]=rrAnchors[i-1], [x2,y2]=rrAnchors[i]
      if(s.avgRR<=x2) return y1+(s.avgRR-x1)*(y2-y1)/(x2-x1)
    }
    return 0
  })()
  const scores = [Math.round((1 - s.heldRate) * 100), Math.round(s.winRate), Math.round(rrScore), Math.round(frequency), Math.round((1 - s.heldRate) * 100), Math.round(s.ownRate * 100)]
  const labels = ['交易纪律', '胜率', '盈亏比', '交易频率', '扛单控制', '自主交易']
  const weakestIndex = scores.indexOf(Math.min(...scores))
  const strongestIndex = scores.indexOf(Math.max(...scores))
  return { scores, strongest: labels[strongestIndex], weakest: labels[weakestIndex], issue: labels[weakestIndex] + (weakestIndex === 3 ? '偏高' : '需要改善'), advice: weakestIndex === 3 ? '减少低质量交易，等待符合自己交易模型的机会。' : weakestIndex === 4 ? '严格执行预设止损，避免让小亏损扩大。' : '保持记录，继续观察这个维度的变化。' }
}

export function formatMoney(value: number) { return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}` }
export function dateKey(date = new Date()) { return date.toISOString().slice(0, 10) }

export function equityPoints(trades: Trade[], startingCapital = 0) {
  let total = startingCapital
  const points = [{ date: '起始', value: startingCapital, timestamp: new Date(0).getTime() }]
  return points.concat([...trades].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()).map((trade) => {
    total += trade.amount
    return { date: trade.date.slice(5), value: total, timestamp: new Date(trade.createdAt || trade.date).getTime() }
  }))
}


export type EquityRange = 'year' | 'month' | 'week' | 'day'

/** Smooth the equity curve for longer ranges by using period-end equity values.
 * Day: individual trades; Week/Month: daily closes; Year: monthly closes.
 */
export function smoothedEquityPoints(trades: Trade[], startingCapital = 0, range: EquityRange = 'month') {
  const sorted = [...trades].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime())
  if (range === 'day') return equityPoints(sorted, startingCapital)
  const keyFor = (trade: Trade) => {
    const d = new Date(trade.createdAt || `${trade.date}T00:00:00`)
    if (range === 'year') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  let total = startingCapital
  const grouped = new Map<string, { value: number; timestamp: number }>()
  for (const trade of sorted) {
    total += trade.amount
    const ts = new Date(trade.createdAt || `${trade.date}T00:00:00`).getTime()
    grouped.set(keyFor(trade), { value: total, timestamp: ts })
  }
  return [{ date: '起始', value: startingCapital, timestamp: new Date(0).getTime() }, ...Array.from(grouped.entries()).map(([key, item]) => ({ date: key, value: item.value, timestamp: item.timestamp }))]
}

export function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  // Calendar order: Saturday → Monday → Friday → Sunday, keeping the trading weekdays in the middle.
  const offset = first === 6 ? 0 : first === 0 ? 6 : first
  return [...Array(offset)].map(() => null).concat([...Array(count)].map((_, i) => i + 1))
}
