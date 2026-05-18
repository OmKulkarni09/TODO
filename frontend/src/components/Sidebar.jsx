import { useState } from 'react'
import {
  Inbox,
  CalendarDays,
  CalendarRange,
  Sun,
  AlertTriangle,
  Star,
  CheckCircle2,
  BarChart3,
  Plus,
  Trash2,
  Pencil,
  Tag,
  X,
  LogOut,
} from 'lucide-react'
import { VenomSpider } from './VenomSpider.jsx'
import { useConfirm } from './ConfirmProvider.jsx'
import { useAuth } from './AuthProvider.jsx'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarRange },
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'all', label: 'All Tasks', icon: Inbox },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
]

const PRESET_COLORS = [
  '#b8ff3a', '#ff2d6d', '#7c3aed', '#06b6d4',
  '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
]

export default function Sidebar({
  view,
  setView,
  categoryId,
  setCategoryId,
  categories,
  stats,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState(null)
  const confirm = useConfirm()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sign out',
      description: `You'll be signed out of ${user?.email || 'your account'}.`,
      actions: [
        { label: 'Cancel', value: false, variant: 'soft' },
        { label: 'Sign out', value: true, variant: 'danger' },
      ],
    })
    if (ok) logout()
  }

  const counts = {
    today: stats?.due_today ?? 0,
    overdue: stats?.overdue ?? 0,
    completed: stats?.completed ?? 0,
    all: stats?.total ?? 0,
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    await onCreateCategory({ name: newName.trim(), color: newColor })
    setNewName('')
    setShowAdd(false)
  }

  return (
    <aside
      className="relative h-full w-72 shrink-0 overflow-y-auto rounded-2xl border p-4 flex flex-col gap-2 shadow-sm
                 border-slate-200 bg-white
                 dark:border-white/[0.08] dark:bg-[#181d27]
                 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_0_rgba(0,0,0,0.5),0_20px_44px_-20px_rgba(0,0,0,0.9)]"
    >
      {/* Subtle venom-green halo at the top, behind the logo, for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-2xl bg-gradient-to-b from-venom-300/[0.05] via-venom-300/[0.02] to-transparent" />

      <div className="relative flex items-center gap-3 px-1 pb-3 pt-1">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-venom-300/20 blur-lg" />
          <VenomSpider
            size={48}
            glow
            className="relative ring-1 ring-venom-300/40"
          />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-black italic leading-none tracking-tight">
            <span className="text-slate-900 dark:text-white">ven</span>
            <span className="text-venom-300 text-venom-glow">OM</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Hunt your day
          </div>
        </div>
      </div>

      <nav className="space-y-0.5">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = view === v.id && categoryId == null
          const count = counts[v.id]
          return (
            <button
              key={v.id}
              onClick={() => {
                setView(v.id)
                setCategoryId(null)
              }}
              className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all
                ${
                  active
                    ? 'bg-venom-300/10 text-venom-700 dark:text-venom-200 font-semibold ring-1 ring-venom-300/25'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-venom-300 shadow-[0_0_10px_rgba(184,255,58,0.7)]" />
              )}
              <span className="flex items-center gap-3">
                <Icon size={17} className={active ? 'text-venom-400' : ''} />
                {v.label}
              </span>
              {count !== undefined && count > 0 && (
                <span
                  className={`chip ${
                    active
                      ? 'bg-venom-300 text-obsidian-950'
                      : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-4 mb-1 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          <Tag size={12} /> Categories
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-venom-500 dark:hover:bg-white/5 dark:hover:text-venom-300"
          title="New category"
        >
          {showAdd ? <X size={15} /> : <Plus size={15} />}
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-2.5 animate-slide-up">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Category name"
            className="input mb-2"
          />
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{ background: c }}
                className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-obsidian-800 transition ${
                  newColor === c ? 'ring-2 ring-venom-300' : ''
                }`}
              />
            ))}
          </div>
          <button onClick={handleAdd} className="btn-primary w-full text-xs py-1.5">
            Add Category
          </button>
        </div>
      )}

      <div className="space-y-0.5">
        {categories.map((c) => {
          const active = categoryId === c.id
          const isEditing = editingId === c.id
          if (isEditing) {
            return (
              <CategoryEdit
                key={c.id}
                category={c}
                onCancel={() => setEditingId(null)}
                onSave={async (data) => {
                  await onUpdateCategory(c.id, data)
                  setEditingId(null)
                }}
              />
            )
          }
          return (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all
                ${
                  active
                    ? 'bg-slate-100 dark:bg-white/10 font-semibold'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              <button
                onClick={() => {
                  setCategoryId(c.id)
                  setView('all')
                }}
                className="flex flex-1 items-center gap-2.5 text-left"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: c.color,
                    boxShadow: `0 0 8px ${c.color}80`,
                  }}
                />
                <span className="truncate">{c.name}</span>
              </button>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                <button
                  onClick={() => setEditingId(c.id)}
                  className="rounded p-1 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete category',
                      description: `Tasks tagged "${c.name}" stay — they just lose this label.`,
                      actions: [
                        { label: 'Cancel', value: false, variant: 'soft' },
                        { label: 'Delete category', value: true, variant: 'danger' },
                      ],
                    })
                    if (ok) onDeleteCategory(c.id)
                  }}
                  className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-3 space-y-2">
        <div className="rounded-xl border border-venom-300/15 bg-venom-300/[0.04] px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-venom-600 dark:text-venom-300">Tip ·</span>{' '}
          Star tasks you must close today. The hunt sharpens when the prey list is short.
        </div>
        {user && (
          <button
            onClick={handleLogout}
            className="group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
            title="Sign out"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                {user.email}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Signed in
              </div>
            </div>
            <LogOut
              size={14}
              className="shrink-0 text-slate-400 group-hover:text-rose-500"
            />
          </button>
        )}
      </div>
    </aside>
  )
}

function CategoryEdit({ category, onCancel, onSave }) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-2.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input mb-2"
      />
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{ background: c }}
            className={`h-5 w-5 rounded-full transition ${
              color === c ? 'ring-2 ring-venom-300' : ''
            }`}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onSave({ name, color })}
          className="btn-primary flex-1 text-xs py-1.5"
        >
          Save
        </button>
        <button onClick={onCancel} className="btn-soft text-xs py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}
