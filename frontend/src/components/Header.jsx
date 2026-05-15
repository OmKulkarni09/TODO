import { Search, Sun, Moon, Plus, Filter } from 'lucide-react'
import Dropdown from './Dropdown.jsx'

const PRIORITIES = [
  { value: '', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent', color: '#f43f5e' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#0ea5e9' },
]

export default function Header({
  title,
  subtitle,
  search,
  setSearch,
  priority,
  setPriority,
  onNew,
  dark,
  toggleDark,
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="input w-60 pl-10"
          />
        </div>

        <Dropdown
          ariaLabel="Filter by priority"
          leftIcon={Filter}
          value={priority}
          onChange={setPriority}
          options={PRIORITIES}
          className="w-44"
          menuClassName="right-0"
        />

        <button
          onClick={toggleDark}
          className="btn-soft !px-2.5"
          title="Toggle theme"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button onClick={onNew} className="btn-primary">
          <Plus size={16} /> New hunt
        </button>
      </div>
    </header>
  )
}
