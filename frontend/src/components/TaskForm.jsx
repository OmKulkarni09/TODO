import { useEffect, useState } from 'react'
import { X, Flag, Calendar, Tag, Repeat } from 'lucide-react'
import { VenomSpider } from './VenomSpider.jsx'
import Dropdown from './Dropdown.jsx'

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'sky' },
  { value: 'medium', label: 'Medium', color: 'amber' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'rose' },
]

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Never' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
]

function toLocalDateTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

export default function TaskForm({ task, categories, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setPriority(task.priority || 'medium')
      setDueDate(toLocalDateTimeInput(task.due_date))
      setCategoryId(task.category_id ? String(task.category_id) : '')
      setRecurrence(task.recurrence || '')
    }
  }, [task])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        category_id: categoryId ? Number(categoryId) : null,
        recurrence: recurrence || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const quickSet = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(18, 0, 0, 0)
    setDueDate(toLocalDateTimeInput(d.toISOString()))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in
                 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg rounded-2xl border p-6 animate-slide-up
                   border-slate-200 bg-white shadow-2xl shadow-slate-900/30
                   dark:border-white/[0.08] dark:bg-[#13181f]
                   dark:shadow-[0_0_0_1px_rgba(184,255,58,0.06),inset_0_1px_0_rgba(255,255,255,0.05),0_30px_60px_-20px_rgba(0,0,0,0.95),0_0_80px_-30px_rgba(184,255,58,0.25)]"
      >
        {/* Venom accent strip — sits inside a clipped wrapper so it respects the rounded
            corners without clipping the dropdown menus elsewhere in the form. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-venom-300/60 to-transparent" />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-venom-300/20 blur-md" />
              <VenomSpider size={38} className="relative ring-1 ring-venom-300/40" />
            </div>
            <h2 className="text-lg font-bold">
              {task ? 'Edit Task' : 'New Hunt'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="input text-base font-medium"
            required
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description, notes, links…"
            rows={3}
            className="input resize-none"
          />

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Flag size={12} /> Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition
                    ${
                      priority === p.value
                        ? `bg-${p.color}-500 text-white border-transparent shadow-md`
                        : 'border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5'
                    }`}
                  style={
                    priority === p.value
                      ? {
                          background:
                            { sky: '#0ea5e9', amber: '#f59e0b', orange: '#f97316', rose: '#f43f5e' }[
                              p.color
                            ],
                          color: 'white',
                          borderColor: 'transparent',
                        }
                      : {}
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Calendar size={12} /> Due date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input"
              />
              <div className="mt-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => quickSet(0)}
                  className="text-[11px] rounded-md bg-slate-100 dark:bg-white/5 px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => quickSet(1)}
                  className="text-[11px] rounded-md bg-slate-100 dark:bg-white/5 px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => quickSet(7)}
                  className="text-[11px] rounded-md bg-slate-100 dark:bg-white/5 px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  +1 week
                </button>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="text-[11px] rounded-md text-rose-500 px-2 py-0.5 hover:bg-rose-500/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Tag size={12} /> Category
              </label>
              <Dropdown
                ariaLabel="Category"
                leftIcon={Tag}
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: '', label: 'No category' },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                    color: c.color,
                  })),
                ]}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Repeat size={12} /> Repeat
            </label>
            <Dropdown
              ariaLabel="Recurrence"
              leftIcon={Repeat}
              value={recurrence}
              onChange={setRecurrence}
              options={RECURRENCE_OPTIONS}
            />
            {recurrence && !dueDate && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                Set a due date — recurring tasks anchor to it to spawn the next
                occurrence.
              </p>
            )}
            {recurrence && dueDate && (
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                When you finish this, the next one auto-appears.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-soft">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : task ? 'Save changes' : 'Begin hunt'}
          </button>
        </div>
      </form>
    </div>
  )
}
