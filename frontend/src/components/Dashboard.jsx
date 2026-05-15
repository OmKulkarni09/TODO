import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Sun,
  ListTodo,
  Trophy,
  Search,
  RotateCcw,
  Pencil,
  Repeat,
  X,
} from 'lucide-react'
import {
  formatDistanceToNow,
  isAfter,
  startOfDay,
  subDays,
} from 'date-fns'
import Dropdown from './Dropdown.jsx'
import { groupBySeries } from '../utils/series.js'

const PRIORITY_COLORS = {
  urgent: '#f43f5e',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#0ea5e9',
}

function StatCard({ icon: Icon, label, value, accent, hint }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
          {hint && (
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {hint}
            </div>
          )}
        </div>
        <div
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon size={17} />
        </div>
      </div>
    </div>
  )
}

const PRIORITY_ACCENT = {
  urgent: '#f43f5e',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#0ea5e9',
}

const TIME_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Any priority' },
  { value: 'urgent', label: 'Urgent', color: '#f43f5e' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#0ea5e9' },
]

function rangeCutoff(range) {
  const now = new Date()
  if (range === 'today') return startOfDay(now)
  if (range === '7d') return subDays(now, 7)
  if (range === '30d') return subDays(now, 30)
  return null
}

function CompletedRow({ task, onToggle, onEdit }) {
  const completedAt = task.completed_at ? new Date(task.completed_at) : null
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.04]">
      <button
        onClick={() => onToggle(task)}
        className="tick done shrink-0"
        title="Mark incomplete (undo)"
        aria-label="Undo completion"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-obsidian-950"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: PRIORITY_ACCENT[task.priority] }}
          />
          <span className="truncate text-sm font-medium text-slate-500 line-through dark:text-slate-400">
            {task.title}
          </span>
          {task._seriesCount > 1 && (
            <span
              className="chip shrink-0 border border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-300"
              title={`Completed ${task._seriesCount} times`}
            >
              <Repeat size={10} />×{task._seriesCount}
            </span>
          )}
        </div>
      </div>

      {task.category && (
        <span
          className="chip shrink-0"
          style={{
            background: `${task.category.color}22`,
            color: task.category.color,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: task.category.color }}
          />
          {task.category.name}
        </span>
      )}

      <span className="hidden md:inline text-xs tabular-nums text-slate-500 dark:text-slate-400 min-w-[88px] text-right">
        {completedAt
          ? formatDistanceToNow(completedAt, { addSuffix: true })
          : '—'}
      </span>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-venom-500 dark:hover:bg-white/10 dark:hover:text-venom-300"
          title="Edit"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onToggle(task)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-venom-500 dark:hover:bg-white/10 dark:hover:text-venom-300"
          title="Undo"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  )
}

function RecentlyCompleted({ tasks = [], categories = [], onToggle, onEdit }) {
  const [range, setRange] = useState('7d')
  const [priority, setPriority] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Any category' },
      ...categories.map((c) => ({
        value: String(c.id),
        label: c.name,
        color: c.color,
      })),
    ],
    [categories]
  )

  const filtered = useMemo(() => {
    const cutoff = rangeCutoff(range)
    const q = search.trim().toLowerCase()
    const matching = tasks
      .filter((t) => t.status === 'completed' && t.completed_at)
      .filter((t) =>
        cutoff ? isAfter(new Date(t.completed_at), cutoff) : true
      )
      .filter((t) => !priority || t.priority === priority)
      .filter(
        (t) => !categoryId || String(t.category_id ?? '') === categoryId
      )
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      )
    // Collapse each recurring series into a single representative row
    return groupBySeries(matching, tasks)
  }, [tasks, range, priority, categoryId, search])

  const totalCompleted = tasks.filter((t) => t.status === 'completed').length
  const hasActiveFilters =
    range !== '7d' || priority !== '' || categoryId !== '' || search !== ''

  const clearFilters = () => {
    setRange('7d')
    setPriority('')
    setCategoryId('')
    setSearch('')
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-venom-300/15 text-venom-500 dark:text-venom-300">
            <Trophy size={17} />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Recently Completed</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {(() => {
                const totalShown = filtered.reduce(
                  (sum, t) => sum + (t._seriesCount || 1),
                  0
                )
                const taskWord = `task${totalCompleted === 1 ? '' : 's'}`
                if (totalShown === totalCompleted) {
                  return `${totalCompleted} ${taskWord} closed`
                }
                return `${totalShown} of ${totalCompleted} shown`
              })()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="input w-44 pl-9"
            />
          </div>
          <Dropdown
            ariaLabel="Time range"
            value={range}
            onChange={setRange}
            options={TIME_RANGE_OPTIONS}
            className="w-36"
          />
          <Dropdown
            ariaLabel="Priority filter"
            value={priority}
            onChange={setPriority}
            options={PRIORITY_OPTIONS}
            className="w-36"
          />
          <Dropdown
            ariaLabel="Category filter"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            className="w-40"
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-ghost !px-2.5 text-xs"
              title="Clear filters"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
          {totalCompleted === 0
            ? 'No tasks closed yet — finish one to see it here.'
            : 'No matches for these filters.'}
        </div>
      ) : (
        <div className="-mx-2 space-y-0.5">
          {filtered.map((t) => (
            <CompletedRow
              key={t.id}
              task={t}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CompletionLineChart({ data }) {
  const W = 700
  const H = 200
  const padL = 18
  const padR = 18
  const padT = 28
  const padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const lastIdx = data.length - 1

  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(1, data.length - 1)) * innerW,
    y: padT + innerH - (d.count / maxCount) * innerH,
    count: d.count,
    label: d.date,
  }))

  const smoothPath = (pts) => {
    if (pts.length < 2) return ''
    let path = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
    const t = 0.55 // tension — lower = smoother but more overshoot risk
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] || p2
      const cp1x = p1.x + ((p2.x - p0.x) * t) / 6
      const cp1y = p1.y + ((p2.y - p0.y) * t) / 6
      const cp2x = p2.x - ((p3.x - p1.x) * t) / 6
      const cp2y = p2.y - ((p3.y - p1.y) * t) / 6
      path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
    }
    return path
  }

  const linePath = smoothPath(points)
  const baselineY = padT + innerH
  const areaPath = `${linePath} L ${points[lastIdx].x.toFixed(2)} ${baselineY} L ${points[0].x.toFixed(2)} ${baselineY} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => padT + (1 - p) * innerH)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-44 overflow-visible"
    >
      <defs>
        <linearGradient id="line-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8ff3a" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#b8ff3a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#b8ff3a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="line-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#88e300" />
          <stop offset="55%" stopColor="#b8ff3a" />
          <stop offset="100%" stopColor="#caff5e" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {gridLines.map((y, i) => (
        <line
          key={i}
          x1={padL}
          y1={y}
          x2={W - padR}
          y2={y}
          stroke="currentColor"
          strokeOpacity={i === gridLines.length - 1 ? 0.18 : 0.06}
          strokeDasharray={i === gridLines.length - 1 ? '0' : '3 5'}
          className="text-slate-400 dark:text-slate-500"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#line-area-fill)" />

      {/* Smooth line */}
      <path
        d={linePath}
        fill="none"
        stroke="url(#line-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 6px rgba(184,255,58,0.45))' }}
      />

      {/* Data points */}
      {points.map((p, i) => {
        const isToday = i === lastIdx
        return (
          <g key={i}>
            {isToday && (
              <circle
                cx={p.x}
                cy={p.y}
                r="11"
                fill="#b8ff3a"
                opacity="0.18"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={isToday ? 5.5 : 4}
              fill="#b8ff3a"
              vectorEffect="non-scaling-stroke"
              style={
                isToday
                  ? { filter: 'drop-shadow(0 0 6px rgba(184,255,58,0.8))' }
                  : undefined
              }
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={isToday ? 2.4 : 1.8}
              className="fill-white dark:fill-[#06070a]"
            />
          </g>
        )
      })}

      {/* Value labels above non-zero points */}
      {points.map((p, i) =>
        p.count > 0 ? (
          <text
            key={`v-${i}`}
            x={p.x}
            y={p.y - 12}
            textAnchor="middle"
            className="fill-venom-700 dark:fill-venom-200 font-bold"
            style={{ fontSize: 11 }}
          >
            {p.count}
          </text>
        ) : null
      )}

      {/* Day labels */}
      {points.map((p, i) => {
        const isToday = i === lastIdx
        return (
          <text
            key={`d-${i}`}
            x={p.x}
            y={H - 8}
            textAnchor="middle"
            className={
              isToday
                ? 'fill-venom-600 dark:fill-venom-300 font-bold'
                : 'fill-slate-500 dark:fill-slate-400 font-medium'
            }
            style={{ fontSize: 11, letterSpacing: '0.05em' }}
          >
            {p.label}
          </text>
        )
      })}
    </svg>
  )
}

export default function Dashboard({
  stats,
  tasks = [],
  categories = [],
  onToggle,
  onEdit,
}) {
  if (!stats) return null

  const totalPriority = Object.values(stats.by_priority).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="animate-fade-in space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={ListTodo}
          label="Total"
          value={stats.total}
          accent="#b8ff3a"
        />
        <StatCard
          icon={Sun}
          label="Due Today"
          value={stats.due_today}
          accent="#f59e0b"
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={stats.in_progress}
          accent="#06b6d4"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={stats.overdue}
          accent="#ff2d6d"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          accent="#88e300"
        />
        <StatCard
          icon={TrendingUp}
          label="Completion"
          value={`${stats.completion_rate}%`}
          accent="#7c3aed"
          hint={`${stats.completed}/${stats.total} done`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          {(() => {
            const counts = stats.completed_last_7_days.map((d) => d.count)
            const total = counts.reduce((a, b) => a + b, 0)
            const peak = Math.max(0, ...counts)
            const avg = total / counts.length
            return (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Completed this week</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Your momentum over the last 7 days
                    </p>
                  </div>
                  <div className="flex items-center gap-5 text-right">
                    <div>
                      <div className="text-2xl font-bold leading-none">{total}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        tasks done
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold leading-none">
                        {avg.toFixed(1)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        daily avg
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold leading-none">{peak}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        peak day
                      </div>
                    </div>
                  </div>
                </div>
                <CompletionLineChart data={stats.completed_last_7_days} />
              </>
            )
          })()}
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-semibold">By Priority</h3>
          <div className="space-y-2.5">
            {['urgent', 'high', 'medium', 'low'].map((p) => {
              const count = stats.by_priority[p] || 0
              const pct = (count / totalPriority) * 100
              return (
                <div key={p}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="capitalize font-medium">{p}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: PRIORITY_COLORS[p],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {stats.by_category.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 font-semibold">By Category</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.by_category.map((c) => (
              <div
                key={c.id}
                className="rounded-xl p-3"
                style={{ background: `${c.color}15` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="truncate text-sm font-medium">{c.name}</span>
                </div>
                <div className="mt-1 text-xl font-bold" style={{ color: c.color }}>
                  {c.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RecentlyCompleted
        tasks={tasks}
        categories={categories}
        onToggle={onToggle}
        onEdit={onEdit}
      />
    </div>
  )
}
