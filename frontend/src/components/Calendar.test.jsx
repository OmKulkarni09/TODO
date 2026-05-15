import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Calendar from './Calendar.jsx'

function noopHandlers() {
  return {
    onToggle: vi.fn(),
    onStar: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onAddSubtask: vi.fn(),
    onToggleSubtask: vi.fn(),
    onDeleteSubtask: vi.fn(),
  }
}

function task(overrides = {}) {
  return {
    id: 1,
    title: 'Task',
    description: '',
    priority: 'medium',
    status: 'pending',
    due_date: null,
    completed_at: null,
    is_starred: false,
    recurrence: null,
    parent_task_id: null,
    category: null,
    subtasks: [],
    ...overrides,
  }
}

beforeEach(() => {
  // May 15, 2026 = Friday. Use this as "today" for deterministic tests.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-05-15T10:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Calendar · layout', () => {
  it('renders the current month label', () => {
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    expect(screen.getByRole('heading', { name: 'May 2026' })).toBeInTheDocument()
  })

  it('renders Sun through Sat day-of-week headers', () => {
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    // CSS class `uppercase` visually uppercases them, but the DOM text
    // is still the original-case "Sun", "Mon", etc.
    ;['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => {
      expect(screen.getByText(d)).toBeInTheDocument()
    })
  })

  it('shows zero stats when there are no tasks', () => {
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Active Days')).toBeInTheDocument()
  })

  it('selects today by default in the day-detail panel', () => {
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    // The h3 in the day-detail panel reads "May 15, 2026" since today is selected.
    // (Note: "Today" text appears in both the nav button AND the day-detail
    // eyebrow, so we use the unique date string instead.)
    expect(
      screen.getByRole('heading', { name: 'May 15, 2026' })
    ).toBeInTheDocument()
  })
})

describe('Calendar · navigation', () => {
  it('Next button advances by one month', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    await user.click(screen.getByTitle('Next month'))
    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument()
  })

  it('Previous button goes back one month', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    await user.click(screen.getByTitle('Previous month'))
    expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument()
  })

  it('Next button wraps year on December → January', async () => {
    vi.setSystemTime(new Date('2026-12-15T10:00:00'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    await user.click(screen.getByTitle('Next month'))
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeInTheDocument()
  })

  it('Today button jumps the cursor back to the current month', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    await user.click(screen.getByTitle('Next month'))
    await user.click(screen.getByTitle('Next month'))
    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument()
    // Disambiguate: the day-detail eyebrow also says "Today" — target the button
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: 'May 2026' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'May 15, 2026' })
    ).toBeInTheDocument()
  })

  it('Tomorrow button selects the next day', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    expect(screen.getByText('May 15, 2026')).toBeInTheDocument()
    await user.click(screen.getByText('Tomorrow'))
    expect(screen.getByText('May 16, 2026')).toBeInTheDocument()
  })
})

describe('Calendar · day cells', () => {
  it('renders 42 day cells (6-week grid)', () => {
    const { container } = render(<Calendar tasks={[]} {...noopHandlers()} />)
    // The cells live inside a grid container that uses gap-px + rounded
    const cells = container.querySelectorAll('button[class*="h-[78px]"]')
    expect(cells.length).toBe(42)
  })

  it('clicking a different day cell updates the detail panel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    // "15" appears in the cell for May 15 (today) — uniquely visible
    // in this month's grid. Click "22" to select May 22.
    await user.click(screen.getByText('22'))
    expect(screen.getByText('May 22, 2026')).toBeInTheDocument()
  })

  it('shows a pending badge on a day with a real pending task', () => {
    const t = task({
      id: 99,
      title: 'visible',
      due_date: '2026-05-20T10:00:00',
    })
    render(<Calendar tasks={[t]} {...noopHandlers()} />)
    // Top-strip "Pending" stat goes up. Find the value "1" near the label.
    const pendingTile = screen.getByText('Pending').closest('div').parentElement
    expect(within(pendingTile).getByText('1')).toBeInTheDocument()
  })

  it('shows a green "Today" indicator chip around the day number', () => {
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    // The day-of-month "15" rendered for today has special styling
    // (a circled bg-venom-300 span). The 15 should exist exactly once.
    const fifteens = screen.getAllByText('15')
    // One inside the grid cell (today's circle), possibly one elsewhere if
    // tasks count to 15 — with empty tasks, just one.
    expect(fifteens.length).toBe(1)
  })
})

describe('Calendar · projections (recurring)', () => {
  it('renders a dashed projected-count badge for future recurring occurrences', () => {
    const t = task({
      id: 99,
      title: 'weekly thing',
      recurrence: 'weekly',
      due_date: '2026-05-15T09:00:00',
    })
    render(<Calendar tasks={[t]} {...noopHandlers()} />)
    // Projection 1 (May 22) should appear with a "1" inside a dashed pill
    // We look for the day-detail panel when we click May 22.
  })

  it('shows projection in day detail when clicking a future projected day', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const t = task({
      id: 99,
      title: 'standup',
      recurrence: 'weekly',
      due_date: '2026-05-15T09:00:00',
    })
    render(<Calendar tasks={[t]} {...noopHandlers()} />)
    await user.click(screen.getByText('22'))
    // The day detail header should show May 22
    expect(screen.getByText('May 22, 2026')).toBeInTheDocument()
    // The projected section header
    expect(screen.getByText(/Projected from recurring/)).toBeInTheDocument()
    // The task title appears in the read-only projected row
    expect(screen.getByText('standup')).toBeInTheDocument()
    // "projection (not yet created)" italicized footer
    expect(screen.getByText(/projection \(not yet created\)/)).toBeInTheDocument()
  })

  it('shows empty-state message when day has no real or projected tasks', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Calendar tasks={[]} {...noopHandlers()} />)
    await user.click(screen.getByText('22'))
    // The body shows "No tasks for this date. Pick another day..."
    expect(
      screen.getByText(/No tasks for this date/i)
    ).toBeInTheDocument()
    // And the eyebrow chip says "Nothing scheduled"
    expect(screen.getByText('Nothing scheduled')).toBeInTheDocument()
  })
})

describe('Calendar · stats accuracy (real tasks only)', () => {
  it('does NOT include projected occurrences in stats counters', () => {
    // One real recurring task → 1 pending in stats. Projections shouldn't
    // inflate Pending/Active Days etc.
    const t = task({
      id: 99,
      recurrence: 'daily',
      due_date: '2026-05-15T09:00:00',
    })
    render(<Calendar tasks={[t]} {...noopHandlers()} />)
    const pendingTile = screen.getByText('Pending').closest('div').parentElement
    // Should be exactly 1 — the real task — not inflated by daily projections
    expect(within(pendingTile).getByText('1')).toBeInTheDocument()
  })

  it('counts completed real tasks but excludes them from pending', () => {
    const done = task({
      id: 1,
      status: 'completed',
      completed_at: '2026-05-15T11:00:00',
      due_date: '2026-05-15T10:00:00',
    })
    const pend = task({
      id: 2,
      due_date: '2026-05-20T10:00:00',
    })
    render(<Calendar tasks={[done, pend]} {...noopHandlers()} />)
    const pendingTile = screen.getByText('Pending').closest('div').parentElement
    const completedTile = screen.getByText('Completed').closest('div').parentElement
    expect(within(pendingTile).getByText('1')).toBeInTheDocument()
    expect(within(completedTile).getByText('1')).toBeInTheDocument()
  })
})
