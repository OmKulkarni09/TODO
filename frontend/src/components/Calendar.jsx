import { useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  isPast,
  addMonths,
  subMonths,
  addDays,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Repeat,
} from 'lucide-react'
import TaskItem from './TaskItem.jsx'

const WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const RECURRENCE_LABELS = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

// JS port of the backend's _next_due_date. Used to project recurring task
// occurrences onto future calendar cells WITHOUT creating real DB entries —
// they are visualizations only and never affect Pending/Completed/Overdue.
function nextDueDate(rule, current) {
  if (!rule || !current) return null
  const next = new Date(current)
  if (rule === 'daily') {
    next.setDate(next.getDate() + 1)
    return next
  }
  if (rule === 'weekdays') {
    do {
      next.setDate(next.getDate() + 1)
    } while (next.getDay() === 0 || next.getDay() === 6)
    return next
  }
  if (rule === 'weekly') {
    next.setDate(next.getDate() + 7)
    return next
  }
  if (rule === 'monthly') {
    const day = next.getDate()
    next.setDate(1) // avoid month-overflow surprises (e.g. Jan 31 → Mar 3)
    next.setMonth(next.getMonth() + 1)
    const lastDay = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0
    ).getDate()
    next.setDate(Math.min(day, lastDay))
    return next
  }
  if (rule === 'yearly') {
    const month = next.getMonth()
    const day = next.getDate()
    next.setDate(1)
    next.setFullYear(next.getFullYear() + 1)
    next.setMonth(month)
    const lastDay = new Date(
      next.getFullYear(),
      month + 1,
      0
    ).getDate()
    next.setDate(Math.min(day, lastDay))
    return next
  }
  return null
}

function ProjectedRow({ task }) {
  const dt = task.due_date ? new Date(task.due_date) : null
  const timeStr = dt
    ? dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-venom-300/30 bg-venom-300/[0.04] px-3 py-2.5 opacity-90 transition-opacity hover:opacity-100">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-venom-300/15 ring-1 ring-venom-400/50 text-venom-600 dark:text-venom-300">
        <Repeat size={12} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="text-venom-600 dark:text-venom-300 font-semibold">
            {RECURRENCE_LABELS[task.recurrence] || task.recurrence}
          </span>
          {timeStr && (
            <>
              <span>·</span>
              <span>{timeStr}</span>
            </>
          )}
          <span>·</span>
          <span className="italic">projection (not yet created)</span>
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
    </div>
  )
}

function StatTile({ label, value, accent, icon: Icon }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon size={15} />
        </div>
      </div>
    </div>
  )
}

export default function Calendar({
  tasks,
  onToggle,
  onStar,
  onDelete,
  onEdit,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}) {
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(new Date())

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const tasksByDate = useMemo(() => {
    const map = new Map()
    const ensure = (key) => {
      if (!map.has(key)) map.set(key, { pending: [], completed: [], projected: [] })
      return map.get(key)
    }

    // 1) Real tasks bucketed by due_date
    for (const t of tasks) {
      if (!t.due_date) continue
      const key = format(new Date(t.due_date), 'yyyy-MM-dd')
      const bucket = ensure(key)
      if (t.status === 'completed') bucket.completed.push(t)
      else bucket.pending.push(t)
    }

    // 2) Project future occurrences for pending recurring tasks, but only
    //    within the visible grid window. These are visualizations — they
    //    don't exist in the DB yet, can't be interacted with, and never
    //    count toward Pending/Completed/Overdue stats.
    const ms = startOfMonth(cursor)
    const me = endOfMonth(cursor)
    const gs = startOfWeek(ms)
    const ge = endOfWeek(me)

    // Build a set of task ids that already have a spawned successor in the
    // DB. We skip projection from these (their successor is the real next
    // instance — projecting from the parent would double-count).
    const parentsWithChildren = new Set(
      tasks
        .map((t) => t.parent_task_id)
        .filter((id) => id != null)
    )

    for (const t of tasks) {
      if (t.status === 'completed') continue
      if (!t.recurrence || !t.due_date) continue
      if (parentsWithChildren.has(t.id)) continue

      let next = nextDueDate(t.recurrence, new Date(t.due_date))
      // Fast-forward past any window-preceding occurrences (handles deeply-
      // overdue tasks without consuming the safety budget)
      let ff = 400
      while (next && next < gs && ff-- > 0) {
        next = nextDueDate(t.recurrence, next)
      }

      // Collect projections that fall inside the visible window
      let safety = 90
      while (next && next <= ge && safety-- > 0) {
        const key = format(next, 'yyyy-MM-dd')
        ensure(key).projected.push({
          ...t,
          id: `${t.id}-proj-${key}`,
          due_date: next.toISOString(),
          _isProjected: true,
          _projectedFromId: t.id,
        })
        next = nextDueDate(t.recurrence, next)
      }
    }

    return map
  }, [tasks, cursor])

  const maxPending = useMemo(() => {
    let max = 0
    for (const v of tasksByDate.values()) {
      const total = v.pending.length + (v.projected?.length || 0)
      if (total > max) max = total
    }
    return max
  }, [tasksByDate])

  const monthStats = useMemo(() => {
    let pending = 0
    let completed = 0
    let overdue = 0
    const activeDays = new Set()
    const now = new Date()
    for (const d of days) {
      if (!isSameMonth(d, cursor)) continue
      const key = format(d, 'yyyy-MM-dd')
      const b = tasksByDate.get(key)
      if (!b) continue
      pending += b.pending.length
      completed += b.completed.length
      if (b.pending.length > 0 || b.completed.length > 0) activeDays.add(key)
      if (isPast(d) && !isToday(d)) overdue += b.pending.length
    }
    return { pending, completed, overdue, activeDays: activeDays.size }
  }, [days, tasksByDate, cursor])

  const selectedKey = format(selected, 'yyyy-MM-dd')
  const selectedBucket =
    tasksByDate.get(selectedKey) || { pending: [], completed: [], projected: [] }
  const selectedTasks = [...selectedBucket.pending, ...selectedBucket.completed]
  const selectedProjected = selectedBucket.projected || []

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      {/* Stats — glass tiles sit over body gradients for depth */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Pending"
          value={monthStats.pending}
          accent="#b8ff3a"
          icon={Sparkles}
        />
        <StatTile
          label="Completed"
          value={monthStats.completed}
          accent="#10b981"
          icon={CheckCircle2}
        />
        <StatTile
          label="Overdue"
          value={monthStats.overdue}
          accent="#ff2d6d"
          icon={AlertTriangle}
        />
        <StatTile
          label="Active Days"
          value={monthStats.activeDays}
          accent="#7c3aed"
          icon={Sparkles}
        />
      </div>

      {/* The Instrument — solid panel: month nav + day labels + grid + legend together */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-3.5 shadow-sm
                      dark:border-white/[0.07] dark:bg-[#13181f]
                      dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_44px_-22px_rgba(0,0,0,0.9)]">
        {/* venom accent strip at top edge of the instrument */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-venom-300/45 to-transparent" />

        {/* Month nav header inside the instrument */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(subMonths(cursor, 1))}
              className="btn-soft !p-2"
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-xl font-bold tracking-tight tabular-nums min-w-[180px]">
              {format(cursor, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="btn-soft !p-2"
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const now = new Date()
                setCursor(now)
                setSelected(now)
              }}
              className="btn-soft"
            >
              Today
            </button>
            <button
              onClick={() => {
                const tomorrow = addDays(new Date(), 1)
                setCursor(tomorrow)
                setSelected(tomorrow)
              }}
              className="btn-soft"
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Hairline divider between header and grid */}
        <div className="mb-3 h-px bg-slate-200/70 dark:bg-white/[0.06]" />

        <div className="mb-1.5 grid grid-cols-7 gap-px">
          {WEEK_LABELS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200 dark:bg-[#2a3140] dark:ring-[#2a3140]">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const bucket = tasksByDate.get(key)
            const pendingCount = bucket?.pending.length || 0
            const completedCount = bucket?.completed.length || 0
            const projectedCount = bucket?.projected?.length || 0
            const totalLoad = pendingCount + projectedCount
            const isCurrentMonth = isSameMonth(day, cursor)
            const isCurrentDay = isToday(day)
            const isSelected = isSameDay(day, selected)
            // Overdue is REAL pending only — projections never go overdue.
            const isOverdue =
              pendingCount > 0 && isPast(day) && !isCurrentDay

            const intensity =
              totalLoad && maxPending > 0
                ? Math.min(1, 0.20 + (totalLoad / maxPending) * 0.55)
                : 0

            const baseBg = isCurrentMonth
              ? 'bg-white dark:bg-[#1c2230]'
              : 'bg-slate-50 dark:bg-[#0d1117]'

            return (
              <button
                key={key}
                onClick={() => setSelected(day)}
                className={`
                  group relative h-[78px] p-1.5 text-left transition-all
                  ${baseBg}
                  ${isCurrentMonth ? '' : 'opacity-55'}
                  ${
                    isSelected
                      ? 'ring-2 ring-inset ring-venom-300 z-10 shadow-venom-soft'
                      : 'hover:ring-1 hover:ring-inset hover:ring-venom-300/40'
                  }
                `}
                style={
                  intensity > 0 && isCurrentMonth && !isOverdue
                    ? { background: `rgba(184,255,58,${intensity})` }
                    : isOverdue && isCurrentMonth
                    ? {
                        background: `rgba(244,63,94,${
                          0.14 + (pendingCount / maxPending) * 0.22
                        })`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`tabular-nums ${
                      isCurrentDay
                        ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-venom-300 text-[11px] font-bold text-obsidian-950 shadow-[0_0_8px_rgba(184,255,58,0.6)]'
                        : 'text-xs font-bold'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {(pendingCount > 0 ||
                    projectedCount > 0 ||
                    completedCount > 0) && (
                    <span className="flex items-center gap-1">
                      {pendingCount > 0 && (
                        <span
                          className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                            isOverdue
                              ? 'bg-rose-500 text-white'
                              : 'bg-venom-300 text-obsidian-950'
                          }`}
                          title={`${pendingCount} pending`}
                        >
                          {pendingCount}
                        </span>
                      )}
                      {projectedCount > 0 && (
                        <span
                          className="inline-flex h-4 items-center gap-0.5 rounded-full border border-dashed border-venom-400/80 px-1 text-[10px] font-bold text-venom-600 dark:text-venom-200"
                          title={`${projectedCount} projected (recurring)`}
                        >
                          <Repeat size={8} strokeWidth={2.5} />
                          {projectedCount}
                        </span>
                      )}
                      {completedCount > 0 && pendingCount === 0 && projectedCount === 0 && (
                        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/80 px-1 text-[10px] font-bold text-white">
                          ✓{completedCount}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-venom-400 shadow-[0_0_6px_rgba(184,255,58,0.8)]" />
            today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-3.5 items-center gap-0.5 rounded-full bg-venom-300 px-1 text-[9px] font-bold text-obsidian-950">
              N
            </span>
            pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-3.5 items-center gap-0.5 rounded-full border border-dashed border-venom-400/80 px-1 text-[9px] font-bold text-venom-600 dark:text-venom-200">
              <Repeat size={7} strokeWidth={2.5} />N
            </span>
            projected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded ring-1 ring-rose-500/50 bg-rose-500/20" />
            overdue
          </span>
          <span>·</span>
          <span>density →</span>
          <div className="flex items-center gap-0.5">
            {[0.12, 0.25, 0.4, 0.6].map((o) => (
              <div
                key={o}
                className="h-3.5 w-3.5 rounded-sm"
                style={{ background: `rgba(184,255,58,${o})` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isToday(selected) ? 'Today' : format(selected, 'EEEE')}
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              {format(selected, 'MMMM d, yyyy')}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {selectedBucket.pending.length > 0 && (
              <span className="chip bg-venom-300/20 text-venom-700 dark:text-venom-200">
                {selectedBucket.pending.length} pending
              </span>
            )}
            {selectedBucket.completed.length > 0 && (
              <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                {selectedBucket.completed.length} done
              </span>
            )}
            {selectedProjected.length > 0 && (
              <span className="chip border border-dashed border-venom-400/60 text-venom-600 dark:text-venom-200">
                <Repeat size={10} />
                {selectedProjected.length} projected
              </span>
            )}
            {selectedTasks.length === 0 && selectedProjected.length === 0 && (
              <span className="text-slate-500 dark:text-slate-400">
                Nothing scheduled
              </span>
            )}
          </div>
        </div>

        {selectedTasks.length > 0 && (
          <div className="space-y-2.5">
            {selectedTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={onToggle}
                onStar={onStar}
                onDelete={onDelete}
                onEdit={onEdit}
                onAddSubtask={onAddSubtask}
                onToggleSubtask={onToggleSubtask}
                onDeleteSubtask={onDeleteSubtask}
              />
            ))}
          </div>
        )}

        {selectedProjected.length > 0 && (
          <div className={selectedTasks.length > 0 ? 'mt-5' : ''}>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Repeat size={11} />
              Projected from recurring
              <span className="font-normal normal-case tracking-normal text-[10px] opacity-80">
                · spawns when its predecessor is completed
              </span>
            </div>
            <div className="space-y-2">
              {selectedProjected.map((t) => (
                <ProjectedRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {selectedTasks.length === 0 && selectedProjected.length === 0 && (
          <div className="grid place-items-center py-10 text-sm text-slate-500 dark:text-slate-400">
            No tasks for this date. Pick another day or schedule something new.
          </div>
        )}
      </div>
    </div>
  )
}
