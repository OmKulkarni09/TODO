import { useState } from 'react'
import {
  Check,
  Star,
  Trash2,
  Pencil,
  Calendar,
  AlertCircle,
  Flag,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Repeat,
} from 'lucide-react'

const RECURRENCE_LABELS = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns'

const PRIORITY_STYLES = {
  urgent: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  low: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
}

const PRIORITY_DOT = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
}

function formatDue(d) {
  const date = new Date(d)
  if (isToday(date)) return { label: 'Today', tone: 'text-venom-600 dark:text-venom-300' }
  if (isTomorrow(date)) return { label: 'Tomorrow', tone: 'text-violet-600 dark:text-violet-400' }
  if (isPast(date)) return { label: format(date, 'MMM d'), tone: 'text-rose-600 dark:text-rose-400' }
  if (isThisWeek(date)) return { label: format(date, 'EEEE'), tone: 'text-emerald-600 dark:text-emerald-400' }
  return { label: format(date, 'MMM d'), tone: 'text-slate-500 dark:text-slate-400' }
}

export default function TaskItem({
  task,
  onToggle,
  onStar,
  onDelete,
  onEdit,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}) {
  const [expanded, setExpanded] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  const done = task.status === 'completed'
  const due = task.due_date ? formatDue(task.due_date) : null
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !done
  const subtaskCount = task.subtasks?.length || 0
  const subtaskDone = task.subtasks?.filter((s) => s.completed).length || 0

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return
    onAddSubtask(task.id, { title: newSubtask.trim() })
    setNewSubtask('')
  }

  return (
    <div
      className={`card card-hover p-4 animate-slide-up
        ${done ? 'opacity-55' : ''}
        ${isOverdue ? 'ring-1 ring-rose-500/30' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task)}
          className={`tick mt-0.5 ${done ? 'done' : ''}`}
          title={done ? 'Mark incomplete' : 'Mark complete'}
        >
          {done && <Check size={12} className="text-white" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
                />
                <h3
                  className={`truncate font-semibold ${
                    done ? 'line-through text-slate-500' : ''
                  }`}
                >
                  {task.title}
                </h3>
              </div>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                  {task.description}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {due && (
                  <span
                    className={`chip border border-transparent ${
                      isOverdue
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-100 dark:bg-white/5'
                    } ${due.tone}`}
                  >
                    {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
                    {due.label}
                  </span>
                )}
                <span
                  className={`chip border ${PRIORITY_STYLES[task.priority]}`}
                >
                  <Flag size={10} />
                  {task.priority}
                </span>
                {task.category && (
                  <span
                    className="chip"
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
                {task.recurrence && RECURRENCE_LABELS[task.recurrence] && (
                  <span
                    className="chip bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/20"
                    title={
                      task._seriesCount > 1
                        ? `Recurring · completed ${task._seriesCount} times`
                        : `Recurring · ${RECURRENCE_LABELS[task.recurrence]}`
                    }
                  >
                    <Repeat size={10} />
                    {RECURRENCE_LABELS[task.recurrence]}
                    {task._seriesCount > 1 && (
                      <span className="ml-0.5 font-bold">
                        · ×{task._seriesCount}
                      </span>
                    )}
                  </span>
                )}
                {subtaskCount > 0 && (
                  <button
                    onClick={() => setExpanded((s) => !s)}
                    className="chip bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                  >
                    {expanded ? (
                      <ChevronDown size={11} />
                    ) : (
                      <ChevronRight size={11} />
                    )}
                    {subtaskDone}/{subtaskCount} subtasks
                  </button>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => onStar(task)}
                className={`rounded-lg p-1.5 transition ${
                  task.is_starred
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                }`}
                title="Star"
              >
                <Star
                  size={15}
                  fill={task.is_starred ? 'currentColor' : 'none'}
                />
              </button>
              <button
                onClick={() => onEdit(task)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-venom-500 dark:hover:text-venom-300 hover:bg-venom-300/10"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDelete(task)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {(expanded || subtaskCount === 0) && (
            <div className="mt-3 space-y-1.5">
              {expanded &&
                task.subtasks?.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <button
                      onClick={() => onToggleSubtask(s)}
                      className={`tick !h-4 !w-4 ${s.completed ? 'done' : ''}`}
                    >
                      {s.completed && (
                        <Check size={9} className="text-white" strokeWidth={3} />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        s.completed ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {s.title}
                    </span>
                    <button
                      onClick={() => onDeleteSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-400 hover:text-rose-500"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              {expanded && (
                <div className="flex items-center gap-1.5 pl-1">
                  <Plus size={13} className="text-slate-400" />
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add subtask…"
                    className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
