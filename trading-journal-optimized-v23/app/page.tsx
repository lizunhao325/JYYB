'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, CalendarDays, ChevronDown, Droplets, LineChart, LockKeyhole, Palette, Plus, Quote, Settings2, Sparkles, Sun, X, ArrowUpRight, TriangleAlert, ArrowDownRight, Trash2, Pencil } from 'lucide-react'
import { Trade, dateKey, smoothedEquityPoints, formatMoney, getQuality, getStats, monthDays } from '@/lib/trading-analytics'

const starterQuotes = ['交易，留下证据。','先保护本金，再等待机会。','纪律不是限制，是让优势重复出现。']
const labels = ['交易纪律','胜率','盈亏比','交易频率','扛单控制','自主交易']
type Range = 'year' | 'month' | 'week' | 'day'
type UndoSnapshot = {
  trades: Trade[]
  fuseUntil: number
  extraTradeUsed: boolean
  cycleStartedAt: number
  limitNoticeSeen: boolean
  limitNotice: boolean
  finalTradeAvailable: boolean
  fuseUnlockUsed: boolean
}

function Curve({ points, large = false, range = 'month' }: { points: {date:string,value:number,timestamp?:number}[]; large?: boolean; range?: Range }) {
  const labelsByRange: Record<Range,string[]> = {
    year: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    month: Array.from({length:31},(_,i)=>`${i+1}日`),
    week: ['周一','周二','周三','周四','周五','周六','周日'],
    day: ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','24:00'],
  }
  if (!points.length) return <div className="empty">完成几笔交易后，资金变化会在这里形成曲线。</div>
  const values = points.map(p => p.value)
  const baseline = values[0] ?? 0
  const dataMin = Math.min(...values), dataMax = Math.max(...values)
  const dataSpread = Math.max(1, dataMax - dataMin)
  const padding = Math.max(1, dataSpread * 0.15, Math.abs(baseline) * 0.03)
  const rawMin = dataMin - padding, rawMax = dataMax + padding
  const tickPercent = range === 'day' ? 0.10 : range === 'week' ? 0.20 : range === 'month' ? 0.30 : 0.40
  const tickValue = Math.max(1, Math.abs(baseline) * tickPercent)
  const min = baseline + Math.floor((rawMin - baseline) / tickValue) * tickValue
  const max = baseline + Math.ceil((rawMax - baseline) / tickValue) * tickValue
  const spread = Math.max(tickValue, max - min)
  const nowDate = new Date()
  const startOfWeek = new Date(nowDate)
  const day = startOfWeek.getDay() || 7
  startOfWeek.setDate(startOfWeek.getDate() - day + 1); startOfWeek.setHours(0,0,0,0)
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime()
  const monthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth()+1, 0, 23,59,59,999).getTime()
  const weekStart = startOfWeek.getTime(), weekEnd = weekStart + 5*86400000 - 1
  const dayStart = new Date(nowDate.getFullYear(),nowDate.getMonth(),nowDate.getDate()).getTime(), dayEnd = dayStart + 86400000 - 1
  const yearStart = new Date(nowDate.getFullYear(),0,1).getTime(), yearEnd = new Date(nowDate.getFullYear(),11,31,23,59,59,999).getTime()
  const xFor = (p:{date:string,timestamp?:number}, i:number) => {
    const ts = p.timestamp ?? new Date(`${nowDate.getFullYear()}-${p.date}`).getTime()
    let ratio = points.length === 1 ? .5 : i / (points.length - 1)
    if (range === 'year') ratio = Math.max(0,Math.min(1,(ts-yearStart)/(yearEnd-yearStart)))
    else if (range === 'month') ratio = Math.max(0,Math.min(1,(ts-monthStart)/(monthEnd-monthStart)))
    else if (range === 'week') ratio = Math.max(0,Math.min(1,(ts-weekStart)/(weekEnd-weekStart)))
    else ratio = Math.max(0,Math.min(1,(ts-dayStart)/(dayEnd-dayStart)))
    return 3 + ratio * 94
  }
  const scaled = points.map((p,i) => ({x:xFor(p,i),y:94-((p.value-min)/spread)*78}))
  let path = `M ${scaled[0].x} ${scaled[0].y}`
  for(let i=1;i<scaled.length;i++){ const prev=scaled[i-1],cur=scaled[i],mid=(prev.x+cur.x)/2; path += ` C ${mid} ${prev.y}, ${mid} ${cur.y}, ${cur.x} ${cur.y}` }
  const baselineY=94-((baseline-min)/spread)*78
  const tickCount = range === 'year' ? 12 : range === 'month' ? 31 : range === 'week' ? 7 : 13
  const xTicks = labelsByRange[range].map((label,i)=>({label,x:3+(i/Math.max(1,tickCount-1))*94}))
  const tickStart = Math.floor((min - baseline) / tickValue)
  const tickEnd = Math.ceil((max - baseline) / tickValue)
  const yTicks = Array.from({length:Math.max(1,tickEnd-tickStart+1)},(_,i)=>{const value=baseline+(tickEnd-i)*tickValue;const pct=((value-baseline)/Math.max(Math.abs(baseline),1))*100;return {value,pct,y:16+((max-value)/(max-min))*78}})
  return <div className={large ? 'curve-chart-shell large-curve-shell' : 'curve-chart-shell'}>
    <svg className={large ? 'curve large-curve' : 'curve'} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="资金曲线">
      <defs><linearGradient id="curveGradient" x1="0" x2="1"><stop stopColor="var(--theme)"/><stop offset="1" stopColor="#7cf4df"/></linearGradient></defs>
      <path d={path} fill="none" stroke="url(#curveGradient)" strokeWidth={large ? 1.35 : 1.05} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>
    {large && <div className="curve-y-axis">{yTicks.map((t,i)=>{const hidePositive20=t.pct===20;return <span key={i} className={hidePositive20?'curve-tick-hidden':''} style={{top:`${t.y}%`}}>{formatMoney(t.value).replace('+','')} · {t.pct>0?'+':''}{t.pct.toFixed(0)}%</span>})}</div>}
    {large && <div className={`curve-x-axis curve-x-${range}`}>{xTicks.map((t,i)=><span key={i} style={{left:`${t.x}%`}}>{t.label}</span>)}</div>}
  </div>
}
function WaterMeter({ title, value, max, color, icon: Icon }: { title:string; value:number; max:number; color:string; icon:typeof Droplets }) {
  const percent = Math.min(100, value / Math.max(max,1) * 100)
  return <div className="meter-card"><div className="meter-head"><span className="meter-title"><Icon size={15}/> {title}</span><strong className="meter-value">{value}<small>/{max}</small></strong></div><div className="meter"><i style={{width:`${Math.max(value?7:0,percent)}%`,background:color}}/></div></div>
}
function Choice({ label, value, onChange }:{label:string;value:boolean;onChange:(v:boolean)=>void}) { return <div className="choice"><span>{label}</span><div><button className={value?'selected':''} onClick={()=>onChange(true)}>是</button><button className={!value?'selected no':''} onClick={()=>onChange(false)}>否</button></div></div> }
function RadarChart({ scores, labels }: { scores:number[]; labels:string[] }) {
  const cx=120,cy=120,radius=88
  const gridPoints=(scale:number)=>Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3;const r=radius*scale;return `${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`}).join(' ')
  const dataPoints=scores.map((score,i)=>{const a=-Math.PI/2+i*Math.PI/3;const r=radius*Math.max(0,Math.min(100,score||0))/100;return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r}})
  return <div className="radar-wrap"><svg className="radar-chart" viewBox="0 0 240 240" role="img" aria-label="交易质量六维雷达图">
    {[1,.75,.5,.25].map((scale,i)=><polygon key={i} className="radar-grid" points={gridPoints(scale)}/>)}
    {scores.map((_,i)=>{const a=-Math.PI/2+i*Math.PI/3;return <line key={i} className="radar-axis" x1={cx} y1={cy} x2={cx+Math.cos(a)*radius} y2={cy+Math.sin(a)*radius}/>})}
    <polygon className="radar-area" points={dataPoints.map(p=>`${p.x},${p.y}`).join(' ')}/>
    {dataPoints.map((p,i)=><circle key={i} className="radar-point" cx={p.x} cy={p.y} r="3"/>)}
  </svg><div className="radar-labels">{labels.map((label,i)=><span key={label} className={`radar-label radar-label-${i}`}>{label}<b>{Math.round(Math.max(0,Math.min(100,scores[i]||0)))}</b></span>)}</div></div>
}
function TradeModal({onClose,onSave,date}: {onClose:()=>void;onSave:(t:Trade)=>void;date?:string}) {
  const [result,setResult]=useState<'win'|'loss'|null>(null),[amount,setAmount]=useState(''),[risk,setRisk]=useState(''),[held,setHeld]=useState(false),[own,setOwn]=useState(true),[normal,setNormal]=useState(true)
  const rr=Number(risk)>0?Number(amount)/Number(risk):0
  const save=()=>{if(!result||!Number(amount))return;const roundedAmount=Math.round(Number(amount)*100)/100;const roundedRisk=result==='win'&&Number(risk)>0?Math.round(Number(risk)*100)/100:undefined;const roundedRR=roundedRisk?Math.round((roundedAmount/roundedRisk)*100)/100:undefined;onSave({id:crypto.randomUUID(),date:date||dateKey(),result,amount:result==='win'?roundedAmount:-Math.abs(roundedAmount),risk:roundedRisk,rr:roundedRR,heldTooLong:held,ownTrade:own,normalStopLoss:result==='loss'?normal:undefined,createdAt:new Date().toISOString()});onClose()}
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose} aria-label="关闭"><X/></button>{!result?<><p className="eyebrow">QUICK LOG</p><h2>这笔交易的结果？</h2><div className="result-grid"><button className="result win" onClick={()=>setResult('win')}><ArrowUpRight/>盈利</button><button className="result loss" onClick={()=>setResult('loss')}><ArrowDownRight/>亏损</button></div></>:<><p className="eyebrow">记录{result==='win'?'盈利':'亏损'}交易</p><h2>{result==='win'?'把结果记下来':'止损也是系统的一部分'}</h2><div className="form"><label>{result==='win'?'盈利金额':'亏损金额'}<input autoFocus type="number" min="0" step="0.1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></label>{result==='win'&&<><label>止损风险<input type="number" min="0" step="0.1" value={risk} onChange={e=>setRisk(e.target.value)} placeholder="0"/></label><div className="rr-preview">盈亏比 <b>1 : {rr.toFixed(2)}</b></div></>}{result==='loss'&&<Choice label="是否正常止损？" value={normal} onChange={setNormal}/>}<Choice label="是否扛单？" value={held} onChange={setHeld}/><Choice label="是自己的交易？" value={own} onChange={setOwn}/><button className="save" onClick={save}>保存交易</button></div></>}</div></div>
}

function TradeEditModal({trade,onChange,onClose,onRequestSave,onRequestDelete}:{trade:Trade;onChange:(t:Trade)=>void;onClose:()=>void;onRequestSave:()=>void;onRequestDelete:()=>void}) {
  const update=(patch:Partial<Trade>)=>onChange({...trade,...patch})
  const risk=trade.risk??0
  const rr=risk>0?Math.abs(trade.amount)/risk:0
  return <div className="modal-backdrop"><div className="modal trade-edit-modal"><button className="close" onClick={onClose} aria-label="关闭"><X/></button><p className="eyebrow">EDIT TRADE</p><h2>修改交易记录</h2><div className="form">
    <label>交易日期<input type="date" value={trade.date} onChange={e=>update({date:e.target.value})}/></label>
    <label>交易结果<select value={trade.result} onChange={e=>{const result=e.target.value as 'win'|'loss';update({result,amount:result==='win'?Math.abs(trade.amount):-Math.abs(trade.amount),normalStopLoss:result==='loss'?trade.normalStopLoss??true:undefined})}}><option value="win">盈利</option><option value="loss">亏损</option></select></label>
    <label>{trade.result==='win'?'盈利金额':'亏损金额'}<input type="number" min="0" step="0.1" value={Math.abs(trade.amount)} onChange={e=>{const n=Math.round((Number(e.target.value)||0)*100)/100;update({amount:trade.result==='win'?n:-n})}}/></label>
    <label>止损风险<input type="number" min="0" step="0.1" value={risk||''} onChange={e=>{const n=e.target.value===''?undefined:Math.round((Number(e.target.value)||0)*100)/100;update({risk:n,rr:n&&n>0?Math.round((Math.abs(trade.amount)/n)*100)/100:undefined})}} placeholder="0.0"/></label>
    <div className="rr-preview"><span>盈亏比</span><b>1 : {rr.toFixed(2)}</b></div>
    <Choice label="是否正常止损？" value={trade.normalStopLoss??true} onChange={v=>update({normalStopLoss:trade.result==='loss'?v:undefined})}/>
    <Choice label="是否扛单？" value={trade.heldTooLong} onChange={v=>update({heldTooLong:v})}/>
    <Choice label="是自己的交易？" value={trade.ownTrade} onChange={v=>update({ownTrade:v})}/>
    <div className="edit-actions"><button className="danger-button" onClick={onRequestDelete}>删除交易</button><button className="confirm-button" onClick={onRequestSave}>保存修改</button></div>
  </div></div></div>
}

const getTradingDayStart=(value:Date)=>{
  const d=new Date(value)
  if(d.getHours()<5)d.setDate(d.getDate()-1)
  d.setHours(5,0,0,0)
  return d
}

export default function Page() {
  const [trades,setTrades]=useState<Trade[]>([]),[cycleStartedAt,setCycleStartedAt]=useState(0),[modal,setModal]=useState(false),[dayEditorOpen,setDayEditorOpen]=useState(false),[dayAddModalOpen,setDayAddModalOpen]=useState(false),[calendarEditEnabled,setCalendarEditEnabled]=useState(false),[calendarPasswordOpen,setCalendarPasswordOpen]=useState(false),[calendarPassword,setCalendarPassword]=useState(''),[calendarPasswordError,setCalendarPasswordError]=useState(''),[capital,setCapital]=useState(0),[capitalInput,setCapitalInput]=useState(''),[capitalLockedUntil,setCapitalLockedUntil]=useState(0),[capitalConfirm,setCapitalConfirm]=useState(false),[rConfirm,setRConfirm]=useState(false),[rLimit,setRLimit]=useState(4),[rLimitDraft,setRLimitDraft]=useState(4),[rLockedUntil,setRLockedUntil]=useState(0),[limits,setLimits]=useState({losses:3,trades:6}),[tradeLimitDraft,setTradeLimitDraft]=useState(6),[selectedDay,setSelectedDay]=useState<string|null>(null),[editingTrade,setEditingTrade]=useState<Trade|null>(null),[tradeActionConfirm,setTradeActionConfirm]=useState<'save'|'delete'|null>(null),[calendarPickerOpen,setCalendarPickerOpen]=useState(false),[calendarYear,setCalendarYear]=useState(new Date().getFullYear()),[calendarMonth,setCalendarMonth]=useState(new Date().getMonth()),[quotes,setQuotes]=useState(starterQuotes),[pinned,setPinned]=useState<number|null>(null),[quoteInput,setQuoteInput]=useState(''),[quoteOpen,setQuoteOpen]=useState(false),[theme,setTheme]=useState('#68e0c0'),[themeOpen,setThemeOpen]=useState(false),[curveOpen,setCurveOpen]=useState(false),[range,setRange]=useState<Range>('month'),[settingsOpen,setSettingsOpen]=useState(false),[monthlyReviewOpen,setMonthlyReviewOpen]=useState(false),[reviewYear,setReviewYear]=useState(new Date().getFullYear()),[reviewMonth,setReviewMonth]=useState(new Date().getMonth()),[clearRange,setClearRange]=useState<'week'|'month'|'year'|'all'|null>(null),[resetPasswordOpen,setResetPasswordOpen]=useState(false),[resetPassword,setResetPassword]=useState(''),[resetError,setResetError]=useState(''),[resetLastAt,setResetLastAt]=useState(0),[fuseUntil,setFuseUntil]=useState(0),[fusePasswordOpen,setFusePasswordOpen]=useState(false),[fusePassword,setFusePassword]=useState(''),[fuseUnlockUsed,setFuseUnlockUsed]=useState(false),[limitNotice,setLimitNotice]=useState(false),[limitNoticeSeen,setLimitNoticeSeen]=useState(false),[finalTradeAvailable,setFinalTradeAvailable]=useState(false),[extraTradeUsed,setExtraTradeUsed]=useState(false),[now,setNow]=useState(Date.now()),[hydrated,setHydrated]=useState(false),[dailyBase,setDailyBase]=useState(0),[dailyBaseKey,setDailyBaseKey]=useState(''),[undoSnapshot,setUndoSnapshot]=useState<UndoSnapshot|null>(null)
  useEffect(()=>{const get=(k:string)=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};const t=get('trading-journal-trades'),l=get('trading-journal-limits'),q=get('trading-journal-quotes'),p=get('trading-journal-pinned'),c=localStorage.getItem('trading-journal-theme'),initialCapital=get('trading-journal-capital'),capitalLock=Number(localStorage.getItem('trading-journal-capital-lock')||0),savedR=get('trading-journal-r-limit'),rLock=Number(localStorage.getItem('trading-journal-r-lock')||0),savedFuse=Number(localStorage.getItem('trading-journal-fuse-until')||0),savedExtra=localStorage.getItem('trading-journal-extra-used')==='1',savedCycle=Number(localStorage.getItem('trading-journal-cycle-start')||0),savedFuseUnlockUsed=localStorage.getItem('trading-journal-fuse-unlock-used')==='1',savedNoticeSeen=localStorage.getItem('trading-journal-limit-notice-seen')==='1',savedResetAt=Number(localStorage.getItem('trading-journal-admin-reset-at')||0),savedDailyBase=JSON.parse(localStorage.getItem('trading-journal-daily-base')||'null'),savedUndo=get('trading-journal-undo');if(Array.isArray(t)){const migrated=t.map((trade:any)=>({...trade,amount:Math.round(Number(trade.amount||0)*100)/100,risk:typeof trade.risk==='number'?Math.round(trade.risk*100)/100:trade.risk,rr:typeof trade.rr==='number'?Math.round(trade.rr*100)/100:trade.rr}));const sep23Losses=migrated.filter((trade:any)=>trade.date==='2026-09-23'&&trade.result==='loss').sort((a:any,b:any)=>new Date(a.createdAt||a.date).getTime()-new Date(b.createdAt||b.date).getTime());if(sep23Losses.length>=6){const ids=new Set(sep23Losses.slice(0,6).map((trade:any)=>trade.id));migrated.forEach((trade:any)=>{if(ids.has(trade.id))trade.date='2026-09-22'})}const fifteenth=migrated.filter((trade:any)=>trade.date===`${new Date().getFullYear()}-09-15`&&trade.result==='loss').sort((a:any,b:any)=>new Date(a.createdAt||a.date).getTime()-new Date(b.createdAt||b.date).getTime());if(fifteenth.length>=4){const ids=new Set(fifteenth.slice(0,4).map((trade:any)=>trade.id));migrated.forEach((trade:any)=>{if(ids.has(trade.id))trade.date=`${new Date().getFullYear()}-09-14`})}const beforeOct6=migrated.length;const withoutOct6=migrated.filter((trade:any)=>trade.date!=='2026-10-06');const changed=JSON.stringify(withoutOct6)!==JSON.stringify(t);setTrades(withoutOct6);if(changed)localStorage.setItem('trading-journal-trades',JSON.stringify(withoutOct6));if(beforeOct6!==withoutOct6.length)localStorage.removeItem('trading-journal-undo');else if(savedUndo)setUndoSnapshot(savedUndo)}else if(savedUndo)setUndoSnapshot(savedUndo);if(typeof initialCapital==='number')setCapital(initialCapital);if(capitalLock)setCapitalLockedUntil(capitalLock);if(typeof savedR==='number'){setRLimit(savedR);setRLimitDraft(savedR)}if(rLock)setRLockedUntil(rLock);if(savedFuse>Date.now())setFuseUntil(savedFuse);if(savedFuseUnlockUsed)setFuseUnlockUsed(true);if(savedExtra)setExtraTradeUsed(true);if(savedCycle)setCycleStartedAt(savedCycle);if(savedNoticeSeen)setLimitNoticeSeen(true);if(savedResetAt)setResetLastAt(savedResetAt);if(l){setLimits(l);setTradeLimitDraft(typeof l.trades==='number'?l.trades:6)}if(q?.length)setQuotes(q);if(typeof p==='number')setPinned(p);if(c)setTheme(c);if(savedDailyBase&&typeof savedDailyBase.value==='number'&&typeof savedDailyBase.key==='string'){setDailyBase(savedDailyBase.value);setDailyBaseKey(savedDailyBase.key)}setHydrated(true)},[])
  useEffect(()=>{if(!hydrated)return;localStorage.setItem('trading-journal-trades',JSON.stringify(trades));localStorage.setItem('trading-journal-limits',JSON.stringify(limits));localStorage.setItem('trading-journal-quotes',JSON.stringify(quotes));localStorage.setItem('trading-journal-pinned',JSON.stringify(pinned));localStorage.setItem('trading-journal-theme',theme);localStorage.setItem('trading-journal-capital',JSON.stringify(capital));localStorage.setItem('trading-journal-capital-lock',String(capitalLockedUntil));localStorage.setItem('trading-journal-r-limit',JSON.stringify(rLimit));localStorage.setItem('trading-journal-r-lock',String(rLockedUntil));localStorage.setItem('trading-journal-fuse-until',String(fuseUntil));localStorage.setItem('trading-journal-extra-used',extraTradeUsed?'1':'0');localStorage.setItem('trading-journal-cycle-start',String(cycleStartedAt));localStorage.setItem('trading-journal-limit-notice-seen',limitNoticeSeen?'1':'0');localStorage.setItem('trading-journal-fuse-unlock-used',fuseUnlockUsed?'1':'0');if(resetLastAt)localStorage.setItem('trading-journal-admin-reset-at',String(resetLastAt));localStorage.setItem('trading-journal-daily-base',JSON.stringify({key:dailyBaseKey,value:dailyBase}));if(undoSnapshot)localStorage.setItem('trading-journal-undo',JSON.stringify(undoSnapshot));else localStorage.removeItem('trading-journal-undo')},[trades,limits,quotes,pinned,theme,capital,capitalLockedUntil,rLimit,rLockedUntil,fuseUntil,extraTradeUsed,cycleStartedAt,fuseUnlockUsed,resetLastAt,dailyBase,dailyBaseKey,undoSnapshot,hydrated])
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{if(!hydrated)return;if(!cycleStartedAt)setCycleStartedAt(Date.now())},[hydrated,cycleStartedAt])
  useEffect(()=>{if(fuseUntil&&now>=fuseUntil){setFuseUntil(0);setExtraTradeUsed(false);setFinalTradeAvailable(false);setLimitNotice(false);setLimitNoticeSeen(false);setFuseUnlockUsed(false);setFusePasswordOpen(false);setFusePassword('');setCycleStartedAt(now)}},[now,fuseUntil])
  const prevAnyLimitReached=useRef(false),limitTransitionReady=useRef(false)
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;if(capitalConfirm)setCapitalConfirm(false);else if(rConfirm)setRConfirm(false);else if(clearRange)setClearRange(null);else if(calendarPickerOpen)setCalendarPickerOpen(false);else if(curveOpen)setCurveOpen(false);else if(monthlyReviewOpen)setMonthlyReviewOpen(false);else if(settingsOpen)setSettingsOpen(false);else if(themeOpen)setThemeOpen(false);else if(quoteOpen)setQuoteOpen(false);else if(calendarPasswordOpen)setCalendarPasswordOpen(false);else if(dayAddModalOpen)setDayAddModalOpen(false);else if(dayEditorOpen)setDayEditorOpen(false);else if(selectedDay)setSelectedDay(null);else if(modal)setModal(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[capitalConfirm,rConfirm,curveOpen,monthlyReviewOpen,settingsOpen,themeOpen,quoteOpen,selectedDay,modal,clearRange,calendarPickerOpen,calendarPasswordOpen,dayAddModalOpen,dayEditorOpen])
  const stats=useMemo(()=>getStats(trades),[trades]),quality=useMemo(()=>getQuality(trades),[trades]),today=dateKey(),tradingDayStart=getTradingDayStart(new Date(now)),tradingDayKey=tradingDayStart.toISOString().slice(0,10),todayTrades=trades.filter(t=>new Date(t.createdAt||`${t.date}T00:00:00`).getTime()>=tradingDayStart.getTime()),days=monthDays(calendarYear,calendarMonth)
  useEffect(()=>{
    if(!hydrated||!capital)return
    if(dailyBaseKey===tradingDayKey&&dailyBase>0)return
    const boundary=tradingDayStart.getTime()
    const realizedBeforeBoundary=trades.reduce((sum,t)=>{const ts=new Date(t.createdAt||`${t.date}T00:00:00`).getTime();return ts<boundary?sum+t.amount:sum},0)
    setDailyBase(Math.max(0,capital+realizedBeforeBoundary))
    setDailyBaseKey(tradingDayKey)
  },[hydrated,capital,trades,now,tradingDayKey,dailyBaseKey,dailyBase,tradingDayStart.getTime()])
  const currentCapital=capital+stats.balance,oneR=Math.max(0,(dailyBase||currentCapital)*0.01),rUnlocked=true
  const todayNet=todayTrades.reduce((sum,t)=>sum+t.amount,0)
  // 今日额度消耗按当天累计亏损金额计算，盈利不会抵消已经消耗的额度。
  const todayLoss=todayTrades.filter(t=>t.result==='loss').reduce((sum,t)=>sum+Math.abs(t.amount),0)
  const fuseActive=fuseUntil>now
  const tradeLimitReached=todayTrades.length>=limits.trades
  const rLimitReached=todayLoss>=oneR*rLimit
  const anyLimitReached=tradeLimitReached||rLimitReached
  const requestRConfirm=()=>{if(rLimit>0)setRConfirm(true)}
  const confirmR=()=>{setRLimit(Math.max(0.1,Math.min(20,Math.round(rLimitDraft*10)/10)));setRLockedUntil(0);setRConfirm(false)}
  const allPoints=useMemo(()=>smoothedEquityPoints(trades,capital,range),[trades,capital,range])
  const recent24=todayNet
  const capitalUnlocked=!capitalLockedUntil||Date.now()>=capitalLockedUntil
  const requestCapitalSave=()=>{if(Number(capitalInput)>0&&capitalUnlocked)setCapitalConfirm(true)}
  const saveCapital=()=>{const value=Number(capitalInput);if(value>0&&capitalUnlocked){setCapital(value);setCapitalLockedUntil(Date.now()+86400000);setCapitalInput('');setCapitalConfirm(false)}}
  const filteredPoints=useMemo(()=>{
    const nowDate=new Date(), first=allPoints[0]
    const startOfWeek=new Date(nowDate), weekday=startOfWeek.getDay()||7
    startOfWeek.setDate(startOfWeek.getDate()-weekday+1); startOfWeek.setHours(0,0,0,0)
    const monthStart=new Date(nowDate.getFullYear(),nowDate.getMonth(),1).getTime(), monthEnd=new Date(nowDate.getFullYear(),nowDate.getMonth()+1,0,23,59,59,999).getTime()
    const weekStart=startOfWeek.getTime(), weekEnd=weekStart+7*86400000-1
    const dayStart=new Date(nowDate.getFullYear(),nowDate.getMonth(),nowDate.getDate()).getTime(), dayEnd=dayStart+86400000-1
    const yearStart=new Date(nowDate.getFullYear(),0,1).getTime(), yearEnd=new Date(nowDate.getFullYear(),11,31,23,59,59,999).getTime()
    const inRange=(p:any)=>{const ts=p.timestamp||0; if(!ts)return false; if(range==='year')return ts>=yearStart&&ts<=yearEnd; if(range==='month')return ts>=monthStart&&ts<=monthEnd; if(range==='week')return ts>=weekStart&&ts<=weekEnd; return ts>=dayStart&&ts<=dayEnd}
    const selected=allPoints.filter((p:any)=>inRange(p));
    return first ? [first,...selected.filter((p:any)=>p!==first)] : selected
  },[allPoints,range])
  const period=(n:number)=>trades.filter(t=>Date.now()-new Date(t.createdAt||`${t.date}T00:00:00`).getTime()<n*86400000).reduce((s,t)=>s+t.amount,0)
  const currentQuote=quotes[pinned??(new Date().getDate()%Math.max(quotes.length,1))]||starterQuotes[0]
  const addQuote=()=>{if(quoteInput.trim()){setQuotes([...quotes,quoteInput.trim()]);setQuoteInput('')}}
  const removeQuote=(index:number)=>{setQuotes(q=>q.filter((_,i)=>i!==index));setPinned(p=>p===null?null:p===index?null:p>index?p-1:p)}
  const clearLabel=clearRange==='week'?'最近一周':clearRange==='month'?'最近一月':clearRange==='year'?'最近一年':'全部数据'
  const clearCount=clearRange==='all'?trades.length:trades.filter(t=>clearRange&&Date.now()-new Date(t.createdAt||t.date).getTime()<=({week:7,month:30,year:365}[clearRange]||0)*86400000).length
  const confirmClear=()=>{if(!clearRange)return;if(clearRange==='all')setTrades([]);else{const days={week:7,month:30,year:365}[clearRange];setTrades(ts=>ts.filter(t=>Date.now()-new Date(t.createdAt||t.date).getTime()>days*86400000))}setUndoSnapshot(null);setClearRange(null)}
  const undoLastInput=()=>{
    if(!undoSnapshot)return
    setTrades(undoSnapshot.trades)
    setFuseUntil(undoSnapshot.fuseUntil)
    setExtraTradeUsed(undoSnapshot.extraTradeUsed)
    setCycleStartedAt(undoSnapshot.cycleStartedAt)
    setLimitNoticeSeen(undoSnapshot.limitNoticeSeen)
    setLimitNotice(undoSnapshot.limitNotice)
    setFinalTradeAvailable(undoSnapshot.finalTradeAvailable)
    setFuseUnlockUsed(undoSnapshot.fuseUnlockUsed)
    setUndoSnapshot(null)
  }
  const resetAvailable=!resetLastAt||Date.now()-resetLastAt>=7*86400000
  const resetRemaining=Math.max(0,7*86400000-(Date.now()-resetLastAt))
  const resetRemainingDays=Math.ceil(resetRemaining/86400000)
  const requestAdminReset=()=>{if(resetAvailable){setResetPassword('');setResetError('');setResetPasswordOpen(true)}}
  const confirmAdminReset=()=>{if(resetPassword!=='moon8800269'){setResetError('管理员密码错误');return}const resetAt=Date.now();['trading-journal-trades','trading-journal-limits','trading-journal-quotes','trading-journal-pinned','trading-journal-theme','trading-journal-capital','trading-journal-capital-lock','trading-journal-r-limit','trading-journal-r-lock','trading-journal-fuse-until','trading-journal-extra-used','trading-journal-cycle-start','trading-journal-limit-notice-seen','trading-journal-fuse-unlock-used','trading-journal-daily-base','trading-journal-undo'].forEach(k=>localStorage.removeItem(k));setTrades([]);setLimits({losses:3,trades:6});setTradeLimitDraft(6);setQuotes(starterQuotes);setPinned(null);setTheme('#68e0c0');setCapital(0);setCapitalInput('');setCapitalLockedUntil(0);setRLimit(4);setRLimitDraft(4);setRLockedUntil(0);setDailyBase(0);setDailyBaseKey('');setFuseUntil(0);setExtraTradeUsed(false);setCycleStartedAt(0);setLimitNoticeSeen(false);setLimitNotice(false);setFinalTradeAvailable(false);setFuseUnlockUsed(false);setFusePassword('');setFusePasswordOpen(false);setSelectedDay(null);setModal(false);setCurveOpen(false);setMonthlyReviewOpen(false);setSettingsOpen(false);setQuoteOpen(false);setThemeOpen(false);setClearRange(null);setResetLastAt(resetAt);setUndoSnapshot(null);setCalendarEditEnabled(false);setDayEditorOpen(false);setDayAddModalOpen(false);setResetPasswordOpen(false);setResetPassword('');setResetError('')}
  useEffect(()=>{if(!hydrated)return;if(!limitTransitionReady.current){prevAnyLimitReached.current=anyLimitReached;limitTransitionReady.current=true;return}const justReached=anyLimitReached&&!prevAnyLimitReached.current;prevAnyLimitReached.current=anyLimitReached;if(fuseActive||!justReached||extraTradeUsed)return;setLimitNotice(true);setLimitNoticeSeen(true)},[hydrated,anyLimitReached,extraTradeUsed,fuseActive])
  useEffect(()=>{if(!anyLimitReached&&!extraTradeUsed){setLimitNoticeSeen(false);setFinalTradeAvailable(false)}},[anyLimitReached,extraTradeUsed])
  useEffect(()=>{if(cycleStartedAt&&now-cycleStartedAt>=86400000&&!fuseActive){setCycleStartedAt(now);setExtraTradeUsed(false);setFinalTradeAvailable(false);setLimitNotice(false);setLimitNoticeSeen(false)}},[now,cycleStartedAt,fuseActive])
  const openTrade=()=>{if(fuseActive)return;if(anyLimitReached&&!extraTradeUsed&&!finalTradeAvailable)return;setModal(true)}
  const unlockFuseWithPassword=()=>{if(!fuseActive||fuseUnlockUsed)return;if(fusePassword==='moon8800269'){setFuseUntil(0);setFuseUnlockUsed(true);setFusePassword('');setFusePasswordOpen(false);setExtraTradeUsed(false);setFinalTradeAvailable(false);setLimitNotice(false);setLimitNoticeSeen(false);localStorage.setItem('trading-journal-fuse-unlock-used','1')}else{setFusePassword('')}}
  const saveTrade=(trade:Trade)=>{
    setUndoSnapshot({trades:[...trades],fuseUntil,extraTradeUsed,cycleStartedAt,limitNoticeSeen,limitNotice,finalTradeAvailable,fuseUnlockUsed})
    const isExtra=anyLimitReached&&!extraTradeUsed&&finalTradeAvailable&&!fuseActive
    setTrades(previous=>{
      const next=[...previous,trade]
      const activeSince=cycleStartedAt||Date.now()-86400000
      const activeTrades=next.filter(t=>new Date(t.createdAt||`${t.date}T00:00:00`).getTime()>=activeSince)
      const loss=activeTrades.filter(t=>t.result==='loss').reduce((sum,t)=>sum+Math.abs(t.amount),0)
      const count=activeTrades.length
      if(isExtra){
        setFinalTradeAvailable(false)
        if(trade.result==='loss'){
          setExtraTradeUsed(true)
          setLimitNotice(false)
          setFuseUntil(Date.now()+12*60*60*1000)
        }else{
          const rStillOver=loss>=oneR*rLimit
          const countStillOver=count>limits.trades
          if(rStillOver||countStillOver){
            setExtraTradeUsed(true)
            setLimitNotice(false)
          }else{
            setExtraTradeUsed(false)
            setLimitNoticeSeen(false)
            setLimitNotice(false)
          }
        }
      }
      return next
    })
    setModal(false)
  }
  const snapshotForUndo=()=>setUndoSnapshot({trades:[...trades],fuseUntil,extraTradeUsed,cycleStartedAt,limitNoticeSeen,limitNotice,finalTradeAvailable,fuseUnlockUsed})
  const requestEditTrade=(trade:Trade)=>{setSelectedDay(null);setDayEditorOpen(false);setDayAddModalOpen(false);setEditingTrade(trade);setTradeActionConfirm(null)}
  const confirmTradeEdit=()=>{
    if(!editingTrade)return
    snapshotForUndo()
    setTrades(previous=>previous.map(t=>t.id===editingTrade.id?editingTrade:t))
    setSelectedDay(editingTrade.date)
    setEditingTrade(null)
    setTradeActionConfirm(null)
  }
  const confirmTradeDelete=()=>{
    if(!editingTrade)return
    snapshotForUndo()
    setTrades(previous=>previous.filter(t=>t.id!==editingTrade.id))
    const remaining=trades.filter(t=>t.id!==editingTrade.id&&t.date===selectedDay)
    if(remaining.length===0)setSelectedDay(null)
    setEditingTrade(null)
    setTradeActionConfirm(null)
  }
  const calendarPrefix=`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`
  const calendarDateKey=(day:number)=>`${calendarPrefix}-${String(day).padStart(2,'0')}`
  const byDay=(day:number)=>trades.filter(t=>t.date===calendarDateKey(day))
  // 日历历史日期必须使用该交易日 05:00 锁定时的资金基数，而不是拿“今天”的 1R 去套整个历史月份。
  // 这样 9 月的额度会随着当时资金变化计算，例如当时 1R≈$12，则 4R≈$48。
  const dailyBaseForDate=(date:string)=>{
    if(!capital)return 0
    const boundary=new Date(`${date}T05:00:00`).getTime()
    const realizedBefore=trades.reduce((sum,t)=>{
      const tradeBoundary=new Date(`${t.date}T05:00:00`).getTime()
      return tradeBoundary<boundary?sum+t.amount:sum
    },0)
    return Math.max(0,capital+realizedBefore)
  }
  const dayViolationState=(day:number)=>{
    const list=byDay(day)
    const key=calendarDateKey(day)
    const dayLoss=list.filter(t=>t.result==='loss').reduce((sum,t)=>sum+Math.abs(t.amount),0)
    const historicalOneR=Math.max(0,dailyBaseForDate(key)*0.01)
    const dailyLimit=historicalOneR*rLimit
    return {overAmount:dailyLimit>0&&dayLoss>dailyLimit,overTrades:list.length>limits.trades}
  }
  const isOverLimitDay=(day:number)=>{const v=dayViolationState(day);return v.overAmount||v.overTrades}
  const openCalendarEditor=()=>{if(!selectedDay||!calendarEditEnabled)return;setDayEditorOpen(true)}
  const addTradeToSelectedDay=(trade:Trade)=>{if(!selectedDay)return;snapshotForUndo();setTrades(previous=>[...previous,{...trade,date:selectedDay}]);setDayAddModalOpen(false)}
  const requestCalendarEditEnable=()=>{if(calendarEditEnabled){setCalendarEditEnabled(false);return}setCalendarPassword('');setCalendarPasswordError('');setCalendarPasswordOpen(true)}
  const confirmCalendarEditEnable=()=>{if(calendarPassword!=='moon8800269'){setCalendarPasswordError('管理员密码错误');return}setCalendarEditEnabled(true);setCalendarPasswordOpen(false);setCalendarPassword('');setCalendarPasswordError('')}
  const reviewYears=Array.from({length:50},(_,i)=>2026+i)
  const reviewMonthNames=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
  const monthTrades=(year:number,month:number)=>trades.filter(t=>t.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))
  const monthSummary=(year:number,month:number)=>{const list=monthTrades(year,month);const wins=list.filter(t=>t.result==='win');const losses=list.filter(t=>t.result==='loss');const profit=wins.reduce((sum,t)=>sum+t.amount,0);const loss=losses.reduce((sum,t)=>sum+Math.abs(t.amount),0);return {count:list.length,winRate:list.length?wins.length/list.length*100:0,rr:wins.length&&losses.length?(profit/wins.length)/(loss/losses.length):null,amount:list.reduce((sum,t)=>sum+t.amount,0)}}
  const selectedMonthSummary=useMemo(()=>monthSummary(reviewYear,reviewMonth),[trades,reviewYear,reviewMonth])
  const calendarMonthTrades=trades.filter(t=>t.date.startsWith(calendarPrefix))
  const calendarMonthLabel=new Date(calendarYear,calendarMonth,1).toLocaleDateString('zh-CN',{year:'numeric',month:'long'})
  const calendarYears=Array.from({length:50},(_,i)=>2026+i)
  return <main className={`dashboard ${fuseActive?'is-fused':''}`} style={{'--theme':theme} as React.CSSProperties}><header><div><p className="eyebrow"><Activity size={14}/> PRIVATE TRADING JOURNAL</p><h1>交易，留下证据。</h1><p className="sub">把情绪变成数据，把数据变成判断。</p></div><div className="head-actions"><button className="theme-button" onClick={()=>setThemeOpen(!themeOpen)} aria-label="主题颜色设置"><Palette size={18}/></button><button className="record" onClick={openTrade} disabled={fuseActive}><Plus size={18}/>记录交易</button></div>{themeOpen&&<div className="theme-layer" onClick={()=>setThemeOpen(false)}><div className="theme-popover" role="dialog" aria-modal="true" aria-label="主题颜色设置" onClick={e=>e.stopPropagation()}><div className="theme-popover-head"><span>主题颜色</span><button className="popover-close" onClick={()=>setThemeOpen(false)} aria-label="关闭主题颜色设置"><X size={15}/></button></div><div className="theme-controls"><input type="color" value={theme} onChange={e=>setTheme(e.target.value)} aria-label="选择主题颜色"/><code>{theme}</code><button onClick={()=>setTheme('#68e0c0')}>恢复默认</button></div></div></div>}</header>
    <section className="hero-grid"><div className="balance"><div><span className="eyebrow">总资金</span><strong>{formatMoney(capital+stats.balance).replace('+','')}</strong><span className={recent24>=0?'positive':'negative'}>最近24小时：{formatMoney(recent24)}</span>{capital>0&&!capitalUnlocked&&<small className="capital-lock">初始资金已锁定，设置中可查看</small>}</div><div className="periods">{[['day',1],['week',7],['month',30],['year',365]].map(([name,n])=><span key={name as string}>{name}<b className={period(Number(n))>=0?'positive':'negative'}>{formatMoney(period(Number(n)))}</b></span>)}</div><div className="equity-preview"><div className="section-title"><div><p className="eyebrow"><LineChart size={13}/> EQUITY CURVE</p><h2>资金曲线 <span className="equity-range-label">{range.toUpperCase()}</span><span className={`equity-total-change ${stats.balance>=0?'positive':'negative'}`}>总资金：{stats.balance>=0?'+':''}{((capital>0?stats.balance/Math.abs(capital):0)*100).toFixed(0)}%</span></h2></div></div><div className="preview-chart curve-clickable" onClick={()=>setCurveOpen(true)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setCurveOpen(true)}}><Curve points={allPoints} range={range}/></div></div></div><div className="metrics"><div className="metric-box"><span>胜率</span><b>{stats.winRate.toFixed(1)}<small>%</small></b><i style={{width:`${stats.winRate}%`}}/></div><div className="metric-box"><span>平均盈亏比</span><b>1 : {stats.avgRR.toFixed(2)}</b><em>{stats.expectancy>=0?'正期望':'需要复盘'}</em></div><div className="metric-box expectancy-box"><span>正期望值指数</span><b className={stats.expectancy>=0?'positive':'negative'}>{stats.expectancy>=0?'+':''}{(stats.expectancy/Math.max(oneR,1)).toFixed(2)}<small>R/笔</small></b><em>{stats.expectancy>=0?'正期望':'负期望'} · {stats.expectancy>=0?`+$${stats.expectancy.toFixed(2)}/笔`:`-$${Math.abs(stats.expectancy).toFixed(2)}/笔`}</em></div><div className="metric-box"><span>纪律止损</span><b>{(stats.normalStopRate*100).toFixed(0)}<small>%</small></b><em>{stats.losses} 次止损</em></div></div><div className="meters"><div className="meter-card r-meter"><div className="meter-head"><span className="meter-title"><Droplets size={15}/> 今日额度</span><strong className="meter-value">{todayLoss.toFixed(2)}<small>/{(oneR*rLimit).toFixed(2)}$</small></strong></div><div className="meter"><i style={{width:`${Math.min(100,todayLoss/Math.max(oneR*rLimit,1)*100)}%`,background:'var(--red)'}}/></div><div className="r-meta r-meta-large"><span>1R = ${oneR.toFixed(2)}</span><span>上限：{rLimit.toFixed(1)}R</span></div><div className="r-remaining">剩余：<b>${Math.max(0,oneR*rLimit-todayLoss).toFixed(2)}</b><small>基数：${dailyBase.toFixed(2)}</small></div><div className="r-grades"><span><em>B级 · 0.5R</em><b>${(oneR*0.5).toFixed(2)}</b></span><span><em>A级 · 1R</em><b>${oneR.toFixed(2)}</b></span><span><em>A+级 · 1.5R</em><b>${(oneR*1.5).toFixed(2)}</b></span><span><em>S级 · 2R</em><b>${(oneR*2).toFixed(2)}</b></span></div></div><WaterMeter title="今日交易" value={todayTrades.length} max={limits.trades} color="var(--theme)" icon={BarChart3}/></div></section><section className="quote-strip"><Quote size={18}/><div><span className="eyebrow">DAILY NOTE</span><p>“{currentQuote}”</p></div><button className="quote-toggle" onClick={()=>setQuoteOpen(!quoteOpen)}>{quoteOpen?'收起':'管理名言'}<ChevronDown size={15}/></button></section>{quoteOpen&&<section className="quote-manager"><div className="quote-add"><input value={quoteInput} onChange={e=>setQuoteInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)addQuote()}} placeholder="添加一句新的交易名言"/><button onClick={addQuote}><Plus size={15}/>添加</button></div>{quotes.map((q,i)=><div key={`${q}-${i}`} className={`quote-item ${pinned===i?'pinned':''}`}><button onClick={()=>setPinned(pinned===i?null:i)}><span>{q}</span><span>{pinned===i?'已置顶':'点击置顶'}</span></button><button className="quote-delete" onClick={()=>removeQuote(i)} aria-label={`删除语录：${q}`}><Trash2 size={14}/></button></div>)}</section>}
    <section className="panel calendar"><div className="section-title"><div><button className="monthly-review-trigger" onClick={()=>setMonthlyReviewOpen(true)} aria-label="打开月度回顾"><p className="eyebrow"><CalendarDays size={13}/> MONTHLY REVIEW</p></button><button className="calendar-date-trigger" onClick={()=>setCalendarPickerOpen(true)} aria-label="选择日历年月"><h2>{calendarMonthLabel}</h2></button></div><span>{calendarMonthTrades.length} 笔记录</span></div><div className="week">{['六','一','二','三','四','五','日'].map(x=><span key={x}>{x}</span>)}</div><div className="days">{days.map((day,i)=>{const list=day?byDay(day):[],pnl=list.reduce((s,t)=>s+t.amount,0),key=day?calendarDateKey(day):'';return <button key={`${day}-${i}`} className={`day ${pnl>3?'day-win':pnl<-3?'day-loss':''} ${selectedDay===key?'active':''}`} disabled={!day} onClick={()=>day&&setSelectedDay(key)}>{day&&<><div className="day-top"><b>{day}</b>{isOverLimitDay(day)&&<span className="over-limit-icon" title="当天存在超额违规或超额交易" aria-label="当天违规"><TriangleAlert size={13}/></span>}</div>{list.length>0&&<><small className="day-count">{list.length} 笔</small><em className="day-amount">{formatMoney(pnl)}</em><span className="day-winrate">胜率 {((list.filter(t=>t.result==='win').length/list.length)*100).toFixed(0)}%</span></>}</>}</button>})}</div></section>
    <section className="analysis panel"><div className="section-title"><div><p className="eyebrow"><Sparkles size={13}/> BEHAVIORAL REVIEW</p><h2>交易质量分析</h2></div></div><div className="analysis-grid"><div className="issue"><span>当前最主要问题</span><strong>{quality.issue}</strong><p>{quality.advice}</p><div className="highlights"><span>最强项 <b>{quality.strongest || '—'}</b></span><span>{'\u6700\u5f31\u9879'} <b>{quality.weakest || '—'}</b></span></div></div><RadarChart scores={quality.scores} labels={labels}/></div></section>
    {selectedDay&&<div className="day-detail"><button className="close" onClick={()=>setSelectedDay(null)}><X size={16}/></button><div className="day-detail-head"><div><p className="eyebrow">{selectedDay.replaceAll('-',' / ')}</p><h3>{trades.filter(t=>t.date===selectedDay).length} 笔交易</h3></div>{(()=>{const v=dayViolationState(Number(selectedDay.slice(-2)));return v.overAmount||v.overTrades?<div className="day-violation-tags">{v.overAmount&&<span>超额违规</span>}{v.overTrades&&<span>超额交易</span>}</div>:null})()}</div>{trades.filter(t=>t.date===selectedDay).map((t,i)=><div className="trade-row" key={t.id}><button className="trade-index" onClick={()=>calendarEditEnabled&&requestEditTrade(t)} disabled={!calendarEditEnabled} aria-label={`修改第${i+1}笔交易`}>{String(i+1).padStart(2,'0')}</button><span className={t.result==='win'?'positive':'negative'}>{t.result==='win'?'盈利':'亏损'} {formatMoney(t.amount)}</span><small>正常止损：{t.normalStopLoss===undefined?'—':t.normalStopLoss?'是':'否'}</small></div>)}{calendarEditEnabled&&<button className="day-edit-launcher" onClick={openCalendarEditor} aria-label="编辑当天交易" title="编辑当天交易"><Pencil size={15}/></button>}</div>}
    {calendarPickerOpen&&<div className="modal-backdrop" onClick={()=>setCalendarPickerOpen(false)}><div className="confirm-modal calendar-picker-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-picker-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCalendarPickerOpen(false)} aria-label="关闭日期选择"><X/></button><p className="eyebrow"><CalendarDays size={14}/> CALENDAR ARCHIVE</p><h2 id="calendar-picker-title">选择年月</h2><p className="confirm-copy">可查看 2026—2075 年任意月份的完整交易记录。</p><div className="calendar-picker-fields"><label>年份<select value={calendarYear} onChange={e=>setCalendarYear(Number(e.target.value))}>{calendarYears.map(y=><option key={y} value={y}>{y}</option>)}</select></label><label>月份<select value={calendarMonth} onChange={e=>setCalendarMonth(Number(e.target.value))}>{reviewMonthNames.map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label></div><div className="confirm-actions"><button onClick={()=>setCalendarPickerOpen(false)}>取消</button><button className="confirm-button" onClick={()=>{setSelectedDay(null);setCalendarPickerOpen(false)}}>查看这个月</button></div></div></div>}{monthlyReviewOpen&&<div className="curve-overlay monthly-review-overlay" onClick={()=>setMonthlyReviewOpen(false)}><div className="curve-modal monthly-review-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setMonthlyReviewOpen(false)} aria-label="关闭月度回顾"><X/></button><p className="eyebrow"><CalendarDays size={14}/> MONTHLY REVIEW · ARCHIVE</p><div className="monthly-review-heading"><div><h2>月度回顾 <span>· {reviewYear}</span></h2><p>查看 2026—2075 年任意月份的交易成绩与月度总览。</p></div><select value={reviewYear} onChange={e=>{setReviewYear(Number(e.target.value));setReviewMonth(0)}} aria-label="选择回顾年份">{reviewYears.map(y=><option key={y} value={y}>{y} 年</option>)}</select></div><div className="monthly-grid">{reviewMonthNames.map((name,i)=>{const summary=monthSummary(reviewYear,i);return <button key={name} className={`monthly-card ${reviewMonth===i?'active':''} ${summary.amount>0?'month-positive':summary.amount<0?'month-negative':''}`} onClick={()=>setReviewMonth(i)}><span>{name}</span><b>{summary.count} 笔</b><em>{summary.count?`胜率 ${summary.winRate.toFixed(0)}%`:'暂无交易'}</em><strong>{summary.count?formatMoney(summary.amount):'—'}</strong></button>})}</div><div className="monthly-detail"><div className="monthly-detail-head"><div><p className="eyebrow">SELECTED MONTH</p><h3>{reviewYear}年{reviewMonth+1}月</h3></div><span className={selectedMonthSummary.amount>=0?'positive':'negative'}>{formatMoney(selectedMonthSummary.amount)}</span></div><div className="monthly-stats"><div><span>一个月交易总次数</span><b>{selectedMonthSummary.count}</b><small>笔</small></div><div><span>胜率</span><b>{selectedMonthSummary.count?selectedMonthSummary.winRate.toFixed(1):'0.0'}</b><small>%</small></div><div><span>盈亏比</span><b>{selectedMonthSummary.rr===null?'—':`1 : ${selectedMonthSummary.rr.toFixed(2)}`}</b></div><div><span>金额</span><b className={selectedMonthSummary.amount>=0?'positive':'negative'}>{formatMoney(selectedMonthSummary.amount)}</b></div></div></div></div></div>}{curveOpen&&<div className="curve-overlay" onClick={()=>setCurveOpen(false)}><div className="curve-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCurveOpen(false)} aria-label="关闭曲线"><X/></button><p className="eyebrow"><LineChart size={14}/> EQUITY CURVE · INTERACTIVE</p><h2>资金曲线 <span>· {range}</span></h2><div className="range-tabs">{(['year','month','week','day'] as Range[]).map(r=><button className={range===r?'active':''} key={r} onClick={()=>setRange(r)}>{r==='year'?'年':r==='month'?'月':r==='week'?'周':'一日'}</button>)}</div><div className="large-chart"><Curve points={filteredPoints} large range={range}/></div><div className="chart-summary"><span>当前净值 <b>{formatMoney(stats.balance)}</b></span><span>记录点 <b>{filteredPoints.length}</b></span></div></div></div>}
    {editingTrade&&<TradeEditModal trade={editingTrade} onChange={setEditingTrade} onClose={()=>{setEditingTrade(null);setTradeActionConfirm(null)}} onRequestSave={()=>setTradeActionConfirm('save')} onRequestDelete={()=>setTradeActionConfirm('delete')}/>} {tradeActionConfirm&&editingTrade&&<div className="modal-backdrop" onClick={()=>setTradeActionConfirm(null)}><div className="confirm-modal trade-action-confirm" role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setTradeActionConfirm(null)} aria-label="关闭确认"><X/></button><p className="eyebrow">确认操作</p><h2>{tradeActionConfirm==='delete'?'确认删除这笔交易？':'确认修改这笔交易？'}</h2><p className="confirm-copy">{tradeActionConfirm==='delete'?'删除后这笔交易将从日历、统计、资金曲线和月度数据中移除。':'确认后将立即更新这笔交易的全部记录信息。'}</p><div className="confirm-actions"><button onClick={()=>setTradeActionConfirm(null)}>否</button><button className={tradeActionConfirm==='delete'?'danger-button':'confirm-button'} onClick={tradeActionConfirm==='delete'?confirmTradeDelete:confirmTradeEdit}>{tradeActionConfirm==='delete'?'确认删除':'确认修改'}</button></div></div></div>}
    {fuseActive&&<><div className="fuse-backdrop" aria-hidden="true"/><div className="fuse-lock" role="alertdialog" aria-live="polite"><div className="lock-icon"><LockKeyhole size={72}/></div><p className="eyebrow">TRADING CIRCUIT BREAKER</p><h2>你已触发熔断</h2><p>交易解锁倒计时</p><strong>{String(Math.floor(Math.max(0,fuseUntil-now)/3600000)).padStart(2,'0')}:{String(Math.floor(Math.max(0,fuseUntil-now)%3600000/60000)).padStart(2,'0')}:{String(Math.floor(Math.max(0,fuseUntil-now)%60000/1000)).padStart(2,'0')}</strong><small>倒计时结束后自动解锁</small>{!fuseUnlockUsed&&<>{!fusePasswordOpen?<button className="fuse-unlock-link" onClick={()=>setFusePasswordOpen(true)}>管理员解锁</button>:<div className="fuse-password"><input autoFocus type="password" value={fusePassword} onChange={e=>setFusePassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')unlockFuseWithPassword()}} placeholder="输入解锁密码"/><button onClick={unlockFuseWithPassword}>解除熔断</button></div>}</>}</div></>}<div className="bottom-settings"><button className="settings-launcher" onClick={()=>setSettingsOpen(!settingsOpen)} aria-label="打开资金与数据设置"><Settings2 size={16}/><span>设置</span></button>{settingsOpen&&<div className="bottom-settings-panel" role="dialog" aria-label="资金与数据设置"><div className="settings-panel-head"><div><p className="eyebrow"><Settings2 size={13}/> JOURNAL SETTINGS</p><h3>资金与数据</h3></div><button className="popover-close" onClick={()=>setSettingsOpen(false)} aria-label="关闭设置"><X size={15}/></button></div><div className="capital-setting"><label>初始总资金<input inputMode="decimal" type="number" min="0" value={capitalInput} onChange={e=>setCapitalInput(e.target.value)} placeholder={capital>0?String(capital):'输入初始总资金'}/></label><button onClick={requestCapitalSave} disabled={!Number(capitalInput)||!capitalUnlocked}>{capital>0&&!capitalUnlocked?'24小时内已锁定':'确认并锁定24小时'}</button></div><div className="r-setting"><label>每日额度上限（R）<input type="number" min="0.1" max="20" step="0.1" value={rLimitDraft} onChange={e=>setRLimitDraft(Math.max(0.1,Math.min(20,Math.round((Number(e.target.value)||0.1)*10)/10)))}/></label><p>1R = 每日资金基数的 1%。额度可随时调整，支持 0.1R 精度；当前上限 {rLimit.toFixed(1)}R = {(oneR*rLimit).toFixed(2)}</p><button onClick={requestRConfirm}>确认今日额度</button></div><div className="trade-limit-setting"><label>今日交易满格阈值<input type="number" min="1" max="100" value={tradeLimitDraft} onChange={e=>setTradeLimitDraft(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label><p>达到此笔数后，今日交易水位条显示满格。</p><button className="trade-limit-confirm" onClick={()=>setLimits({...limits,trades:tradeLimitDraft})}>确认阈值</button></div><div className="undo-setting"><b>撤销上一次输入</b><span>{undoSnapshot?'恢复到最近一次记录交易之前的状态':'当前没有可撤销的交易输入'}</span><button onClick={undoLastInput} disabled={!undoSnapshot}>撤销上一次输入</button></div><div className="data-management"><b>清空交易记录</b><span>清空后不可恢复，请谨慎操作</span><div className="clear-options"><button onClick={()=>setClearRange('week')}>最近一周</button><button onClick={()=>setClearRange('month')}>最近一月</button><button onClick={()=>setClearRange('year')}>最近一年</button><button className="danger-text" onClick={()=>setClearRange('all')}>全部重置</button></div></div><div className="calendar-edit-setting"><b>编辑日历</b><span>开启后可在日期详情中添加、修改、删除当天全部交易；每次开启都需要管理员密码。</span><button className={calendarEditEnabled?'calendar-edit-toggle active':'calendar-edit-toggle'} onClick={requestCalendarEditEnable}>{calendarEditEnabled?'已开启':'开启编辑'}</button></div><div className="admin-reset"><b>管理员重置</b><span>{resetAvailable?'输入管理员密码，可将主页恢复为初始状态（每7天一次）':`本周已使用，${resetRemainingDays}天后可再次重置`}</span><button className="danger-text" onClick={requestAdminReset} disabled={!resetAvailable}>管理员密码重置</button></div></div>}</div>{limitNotice&&<div className="modal-backdrop" onClick={()=>setLimitNotice(false)}><div className="limit-notice" role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setLimitNotice(false)} aria-label="关闭提醒"><X/></button><p className="eyebrow"><Droplets size={14}/> 今日额度提醒</p><h2>你已用完今天的额度</h2><p>你今天的额度已经用完，现在请立即关闭交易去休息，活动一下身体，明天再来！</p><button className="confirm-button" onClick={()=>{setLimitNotice(false);setFinalTradeAvailable(true)}}>确定，返回主页</button></div></div>}{modal&&!fuseActive&&<TradeModal onClose={()=>setModal(false)} onSave={saveTrade}/>} {capitalConfirm&&<div className="modal-backdrop" onClick={()=>setCapitalConfirm(false)}><div className="confirm-modal capital-confirm" role="alertdialog" aria-modal="true" aria-labelledby="capital-confirm-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCapitalConfirm(false)} aria-label="关闭金额确认"><X/></button><p className="eyebrow">确认初始总资金</p><h2 id="capital-confirm-title">确认输入 ¥{Number(capitalInput).toLocaleString('zh-CN')}？</h2><p className="confirm-copy">确认后将作为资金曲线起点，并锁定 24 小时不可修改。</p><div className="confirm-actions"><button onClick={()=>setCapitalConfirm(false)}>否，重新输入</button><button className="confirm-button" onClick={saveCapital}>是，确认并锁定</button></div></div></div>} {rConfirm&&<div className="modal-backdrop" onClick={()=>setRConfirm(false)}><div className="confirm-modal capital-confirm" role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setRConfirm(false)} aria-label="关闭额度确认"><X/></button><p className="eyebrow">确认今日额度</p><h2>确认 {rLimitDraft.toFixed(1)}R / {(oneR*rLimitDraft).toFixed(1)}？</h2><p className="confirm-copy">1R = 每日资金基数的 1%。额度不会锁定，你之后可以随时重新调整。</p><div className="confirm-actions"><button onClick={()=>setRConfirm(false)}>否，返回修改</button><button className="confirm-button" onClick={confirmR}>确认额度</button></div></div></div>} {resetPasswordOpen&&<div className="modal-backdrop" onClick={()=>setResetPasswordOpen(false)}><div className="confirm-modal admin-reset-modal" role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setResetPasswordOpen(false)} aria-label="关闭重置确认"><X/></button><p className="eyebrow">ADMIN RESET</p><h2>恢复主页初始状态？</h2><p className="confirm-copy">将清除交易记录、初始资金、今日额度、熔断状态、额度锁定、语录与个性化设置。每7天只能使用一次。</p><label className="reset-password-label">管理员密码<input autoFocus type="password" value={resetPassword} onChange={e=>{setResetPassword(e.target.value);setResetError('')}} onKeyDown={e=>{if(e.key==='Enter')confirmAdminReset()}} placeholder="输入管理员密码"/></label>{resetError&&<p className="reset-error">{resetError}</p>}<div className="confirm-actions"><button onClick={()=>setResetPasswordOpen(false)}>取消</button><button className="danger-button" onClick={confirmAdminReset}>确认重置</button></div></div></div>}{calendarPasswordOpen&&<div className="modal-backdrop" onClick={()=>setCalendarPasswordOpen(false)}><div className="confirm-modal admin-reset-modal" role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCalendarPasswordOpen(false)} aria-label="关闭编辑日历密码"><X/></button><p className="eyebrow">CALENDAR EDIT</p><h2>开启编辑日历？</h2><p className="confirm-copy">开启后可添加、修改、删除日期交易记录。每次开启编辑模式都需要管理员密码。</p><label className="reset-password-label">管理员密码<input autoFocus type="password" value={calendarPassword} onChange={e=>{setCalendarPassword(e.target.value);setCalendarPasswordError('')}} onKeyDown={e=>{if(e.key==='Enter')confirmCalendarEditEnable()}} placeholder="输入管理员密码"/></label>{calendarPasswordError&&<p className="reset-error">{calendarPasswordError}</p>}<div className="confirm-actions"><button onClick={()=>setCalendarPasswordOpen(false)}>取消</button><button className="confirm-button" onClick={confirmCalendarEditEnable}>确认开启</button></div></div></div>}{dayEditorOpen&&selectedDay&&<div className="modal-backdrop" onClick={()=>setDayEditorOpen(false)}><div className="day-editor-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setDayEditorOpen(false)} aria-label="关闭当天交易编辑"><X/></button><p className="eyebrow">EDIT DAY</p><h2>{selectedDay.replaceAll('-',' / ')}</h2><p className="confirm-copy">添加、修改或删除当天全部交易记录。</p><div className="day-editor-list">{trades.filter(t=>t.date===selectedDay).map((t,i)=><div className="day-editor-row" key={t.id}><button className="trade-index" onClick={()=>requestEditTrade(t)}>{String(i+1).padStart(2,'0')}</button><span className={t.result==='win'?'positive':'negative'}>{formatMoney(t.amount)}</span><button className="day-editor-edit" onClick={()=>requestEditTrade(t)}><Pencil size={14}/></button></div>)}{!trades.some(t=>t.date===selectedDay)&&<p className="empty">当天暂无交易</p>}</div><button className="day-editor-add" onClick={()=>setDayAddModalOpen(true)}><Plus size={15}/> 添加当天交易</button></div></div>}{dayAddModalOpen&&selectedDay&&<TradeModal date={selectedDay} onClose={()=>setDayAddModalOpen(false)} onSave={addTradeToSelectedDay}/>}{clearRange&&<div className="modal-backdrop" onClick={()=>setClearRange(null)}><div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setClearRange(null)} aria-label="关闭确认弹窗"><X/></button><p className="eyebrow"><Trash2 size={14}/> 危险操作</p><h2 id="clear-title">确认清空{clearLabel}？</h2><p className="confirm-copy">将删除 <b>{clearCount}</b> 笔交易记录，此操作无法撤销。</p><div className="confirm-actions"><button onClick={()=>setClearRange(null)}>否，保留数据</button><button className="danger-button" onClick={confirmClear}>确认清空</button></div></div></div>}</main>
}
