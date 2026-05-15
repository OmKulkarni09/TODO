import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import TaskItem from './components/TaskItem.jsx'
import TaskForm from './components/TaskForm.jsx'
import Dashboard from './components/Dashboard.jsx'
import Calendar from './components/Calendar.jsx'
import Celebration from './components/Celebration.jsx'
import { VenomFace } from './components/VenomSpider.jsx'
import { useConfirm } from './components/ConfirmProvider.jsx'
import { api } from './api.js'
import { groupBySeries } from './utils/series.js'
import { Loader2 } from 'lucide-react'

const VIEW_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Today’s prey list, at a glance' },
  calendar: { title: 'Calendar', subtitle: 'A month of tasks at a glance' },
  today: { title: 'Today', subtitle: 'What you devour right now' },
  upcoming: { title: 'Upcoming', subtitle: 'Targets on the horizon' },
  overdue: { title: 'Overdue', subtitle: 'Tracks gone cold — hunt them down' },
  starred: { title: 'Starred', subtitle: 'Your priority hunts' },
  all: { title: 'All Tasks', subtitle: 'Everything in your grasp' },
  completed: { title: 'Completed', subtitle: 'Trophies of the week' },
}

const ALL_TASKS_VIEWS = new Set(['dashboard', 'all', 'calendar'])

export default function App() {
  const [view, setView] = useState('dashboard')
  const [categoryId, setCategoryId] = useState(null)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [celebrationKey, setCelebrationKey] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const confirm = useConfirm()
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const loadTasks = useCallback(async () => {
    const params = {
      search: search || undefined,
      priority: priority || undefined,
      category_id: categoryId ?? undefined,
    }
    if (!ALL_TASKS_VIEWS.has(view)) params.view = view
    const data = await api.listTasks(params)
    setTasks(data)
  }, [view, categoryId, search, priority])

  const loadCategories = useCallback(async () => {
    const data = await api.listCategories()
    setCategories(data)
  }, [])

  const loadStats = useCallback(async () => {
    const data = await api.stats()
    setStats(data)
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTasks(), loadStats()])
  }, [loadTasks, loadStats])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadTasks(), loadCategories(), loadStats()]).finally(() =>
      setLoading(false)
    )
  }, [loadTasks, loadCategories, loadStats])

  const handleToggle = async (task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed'
    await api.updateTask(task.id, { status: next })
    if (next === 'completed' && task.status !== 'completed') {
      setCelebrationKey((k) => k + 1)
      setShowCelebration(true)
    }
    refreshAll()
  }

  const handleStar = async (task) => {
    await api.updateTask(task.id, { is_starred: !task.is_starred })
    refreshAll()
  }

  const handleDelete = async (task) => {
    if (task._seriesCount > 1) {
      const choice = await confirm({
        title: 'Delete recurring task',
        description: `"${task.title}" has been completed ${task._seriesCount} times. Choose what to remove.`,
        actions: [
          { label: 'Cancel', value: null, variant: 'soft' },
          { label: 'Just this one', value: 'one', variant: 'danger' },
          { label: 'Entire series', value: 'series', variant: 'danger' },
        ],
      })
      if (choice === 'one') {
        await api.deleteTask(task.id)
      } else if (choice === 'series') {
        await api.deleteTaskSeries(task.id)
      } else {
        return
      }
    } else {
      const ok = await confirm({
        title: 'Delete task',
        description: `This will permanently remove "${task.title}".`,
        actions: [
          { label: 'Cancel', value: false, variant: 'soft' },
          { label: 'Delete', value: true, variant: 'danger' },
        ],
      })
      if (!ok) return
      await api.deleteTask(task.id)
    }
    refreshAll()
  }

  const handleSaveTask = async (data) => {
    if (editing) await api.updateTask(editing.id, data)
    else await api.createTask(data)
    setEditing(null)
    refreshAll()
  }

  const openNew = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (task) => {
    setEditing(task)
    setShowForm(true)
  }

  const handleAddSubtask = async (taskId, data) => {
    await api.addSubtask(taskId, data)
    loadTasks()
  }

  const handleToggleSubtask = async (s) => {
    await api.updateSubtask(s.id, { completed: !s.completed })
    loadTasks()
  }

  const handleDeleteSubtask = async (id) => {
    await api.deleteSubtask(id)
    loadTasks()
  }

  const meta = useMemo(() => {
    if (categoryId != null) {
      const c = categories.find((x) => x.id === categoryId)
      return {
        title: c?.name || 'Category',
        subtitle: `Tasks tagged ${c?.name || ''}`,
      }
    }
    return VIEW_META[view] || VIEW_META.all
  }, [view, categoryId, categories])

  const visibleTasks = tasks
  const grouped = useMemo(() => {
    const active = visibleTasks.filter((t) => t.status !== 'completed')
    const done = visibleTasks.filter((t) => t.status === 'completed')
    // Collapse recurring completions into one representative per series.
    // Pass `tasks` (not just done) so we can resolve parent ids that might
    // belong to pending ancestors in views where they coexist.
    const doneGrouped = groupBySeries(done, tasks)
    return { active, done, doneGrouped, doneCount: done.length }
  }, [visibleTasks, tasks])

  return (
    <div className="flex h-full">
      <div className="hidden md:flex p-4 pr-2">
        <Sidebar
          view={view}
          setView={setView}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          categories={categories}
          stats={stats}
          onCreateCategory={async (d) => {
            await api.createCategory(d)
            loadCategories()
          }}
          onUpdateCategory={async (id, d) => {
            await api.updateCategory(id, d)
            loadCategories()
            refreshAll()
          }}
          onDeleteCategory={async (id) => {
            await api.deleteCategory(id)
            loadCategories()
            refreshAll()
            if (categoryId === id) setCategoryId(null)
          }}
        />
      </div>

      <main className="flex flex-1 flex-col overflow-hidden p-4 pl-2">
        <div className="mb-4">
          <Header
            title={meta.title}
            subtitle={meta.subtitle}
            search={search}
            setSearch={setSearch}
            priority={priority}
            setPriority={setPriority}
            onNew={openNew}
            dark={dark}
            toggleDark={() => setDark((d) => !d)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="grid h-64 place-items-center text-venom-300">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : view === 'dashboard' && categoryId == null ? (
            <Dashboard
              stats={stats}
              tasks={tasks}
              categories={categories}
              onToggle={handleToggle}
              onEdit={openEdit}
            />
          ) : view === 'calendar' && categoryId == null ? (
            <Calendar
              tasks={tasks}
              onToggle={handleToggle}
              onStar={handleStar}
              onDelete={handleDelete}
              onEdit={openEdit}
              onAddSubtask={handleAddSubtask}
              onToggleSubtask={handleToggleSubtask}
              onDeleteSubtask={handleDeleteSubtask}
            />
          ) : visibleTasks.length === 0 ? (
            <EmptyState view={view} onNew={openNew} />
          ) : (
            <div className="space-y-3 pb-6">
              {grouped.active.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onToggle={handleToggle}
                  onStar={handleStar}
                  onDelete={handleDelete}
                  onEdit={openEdit}
                  onAddSubtask={handleAddSubtask}
                  onToggleSubtask={handleToggleSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                />
              ))}
              {grouped.doneGrouped.length > 0 && (
                <div className="pt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Completed · {grouped.doneCount}
                    {grouped.doneCount !== grouped.doneGrouped.length && (
                      <span className="ml-1 font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                        ({grouped.doneGrouped.length} series)
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {grouped.doneGrouped.map((t) => (
                      <TaskItem
                        key={t.id}
                        task={t}
                        onToggle={handleToggle}
                        onStar={handleStar}
                        onDelete={handleDelete}
                        onEdit={openEdit}
                        onAddSubtask={handleAddSubtask}
                        onToggleSubtask={handleToggleSubtask}
                        onDeleteSubtask={handleDeleteSubtask}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <TaskForm
          task={editing}
          categories={categories}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSave={handleSaveTask}
        />
      )}

      {showCelebration && (
        <Celebration
          key={celebrationKey}
          onDone={() => setShowCelebration(false)}
        />
      )}
    </div>
  )
}

function EmptyState({ view, onNew }) {
  const messages = {
    today: ['No prey today', 'The symbiote sleeps. Enjoy the quiet — or add a hunt.'],
    upcoming: ['Nothing on the horizon', 'Stake out a target. The hunt sharpens with planning.'],
    overdue: ['No tracks gone cold', 'Clean kill record. Stay sharp.'],
    starred: ['Nothing starred', 'Mark a task to keep it in your jaws.'],
    completed: ['No trophies yet', 'Close one task to claim your first kill.'],
    all: ['Empty grasp', 'Add your first hunt and the symbiote awakens.'],
  }
  const [title, sub] = messages[view] || messages.all
  return (
    <div className="grid min-h-[420px] place-items-center animate-fade-in">
      <div className="text-center">
        <div className="relative mx-auto mb-5 w-[240px]">
          <div className="absolute inset-0 -z-10 rounded-full bg-venom-300/15 blur-3xl" />
          <VenomFace width={240} className="animate-pulse-venom" />
        </div>
        <div className="text-lg font-bold tracking-tight">{title}</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {sub}
        </div>
        <button onClick={onNew} className="btn-primary mt-5">
          New hunt
        </button>
      </div>
    </div>
  )
}
