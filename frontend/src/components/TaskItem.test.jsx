import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskItem from './TaskItem.jsx'

function makeTask(overrides = {}) {
  return {
    id: 1,
    title: 'Test task',
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

function makeHandlers() {
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

beforeEach(() => {
  // Fix "now" so date chips (Today, Tomorrow) are deterministic
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-05-15T10:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TaskItem · rendering', () => {
  it('renders title, description, and priority chip', () => {
    render(
      <TaskItem
        task={makeTask({ title: 'Buy milk', description: 'whole, 2L', priority: 'high' })}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByText('whole, 2L')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('renders category chip when category is set', () => {
    render(
      <TaskItem
        task={makeTask({ category: { id: 1, name: 'Work', color: '#06b6d4' } })}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('renders recurrence chip with label', () => {
    render(<TaskItem task={makeTask({ recurrence: 'weekly' })} {...makeHandlers()} />)
    expect(screen.getByText('Weekly')).toBeInTheDocument()
  })

  it('renders series count chip when _seriesCount > 1', () => {
    render(
      <TaskItem
        task={makeTask({ recurrence: 'daily', _seriesCount: 3 })}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText(/×3/)).toBeInTheDocument()
  })

  it('does NOT render series count when _seriesCount is undefined', () => {
    render(<TaskItem task={makeTask({ recurrence: 'daily' })} {...makeHandlers()} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it('formats due_date "Today" when same as system clock', () => {
    const today = '2026-05-15T15:00:00'
    render(<TaskItem task={makeTask({ due_date: today })} {...makeHandlers()} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('formats due_date "Tomorrow" for next-day tasks', () => {
    render(
      <TaskItem
        task={makeTask({ due_date: '2026-05-16T10:00:00' })}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('renders day-of-week label for dates within the current week (future)', () => {
    // Override base time to Sunday May 10 so a same-week future date exists.
    // (With Friday as today, the only future same-week date is Saturday,
    // which gets caught by the "Tomorrow" branch first.)
    vi.setSystemTime(new Date('2026-05-10T10:00:00'))
    render(
      <TaskItem
        task={makeTask({ due_date: '2026-05-13T10:00:00' })}
        {...makeHandlers()}
      />
    )
    // May 13, 2026 is a Wednesday — falls in same week as May 10
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
  })

  it('applies line-through styling on completed tasks', () => {
    render(
      <TaskItem
        task={makeTask({ status: 'completed' })}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText('Test task').className).toContain('line-through')
  })

  it('shows "Mark complete" title on pending tick, "Mark incomplete" on done', () => {
    const { rerender } = render(
      <TaskItem task={makeTask({ status: 'pending' })} {...makeHandlers()} />
    )
    expect(screen.getByTitle('Mark complete')).toBeInTheDocument()
    rerender(<TaskItem task={makeTask({ status: 'completed' })} {...makeHandlers()} />)
    expect(screen.getByTitle('Mark incomplete')).toBeInTheDocument()
  })
})

describe('TaskItem · interactions', () => {
  it('calls onToggle when tick is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const handlers = makeHandlers()
    const task = makeTask()
    render(<TaskItem task={task} {...handlers} />)
    await user.click(screen.getByTitle('Mark complete'))
    expect(handlers.onToggle).toHaveBeenCalledWith(task)
  })

  it('calls onStar when star button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const handlers = makeHandlers()
    const task = makeTask()
    render(<TaskItem task={task} {...handlers} />)
    await user.click(screen.getByTitle('Star'))
    expect(handlers.onStar).toHaveBeenCalledWith(task)
  })

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const handlers = makeHandlers()
    const task = makeTask()
    render(<TaskItem task={task} {...handlers} />)
    await user.click(screen.getByTitle('Edit'))
    expect(handlers.onEdit).toHaveBeenCalledWith(task)
  })

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const handlers = makeHandlers()
    const task = makeTask()
    render(<TaskItem task={task} {...handlers} />)
    await user.click(screen.getByTitle('Delete'))
    expect(handlers.onDelete).toHaveBeenCalledWith(task)
  })
})

describe('TaskItem · subtasks', () => {
  function withSubtasks() {
    return makeTask({
      subtasks: [
        { id: 10, title: 'Sub A', completed: false, task_id: 1 },
        { id: 11, title: 'Sub B', completed: true, task_id: 1 },
      ],
    })
  }

  it('shows "1/2 subtasks" chip when collapsed', () => {
    render(<TaskItem task={withSubtasks()} {...makeHandlers()} />)
    expect(screen.getByText('1/2 subtasks')).toBeInTheDocument()
    // Items are hidden by default
    expect(screen.queryByText('Sub A')).not.toBeInTheDocument()
  })

  it('reveals subtask items when chip is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TaskItem task={withSubtasks()} {...makeHandlers()} />)
    await user.click(screen.getByText('1/2 subtasks'))
    expect(screen.getByText('Sub A')).toBeInTheDocument()
    expect(screen.getByText('Sub B')).toBeInTheDocument()
  })

  it('calls onAddSubtask when Enter is pressed in the add-subtask input', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const handlers = makeHandlers()
    const task = withSubtasks()
    render(<TaskItem task={task} {...handlers} />)
    await user.click(screen.getByText('1/2 subtasks'))
    const input = screen.getByPlaceholderText('Add subtask…')
    await user.type(input, 'New thing{Enter}')
    expect(handlers.onAddSubtask).toHaveBeenCalledWith(task.id, { title: 'New thing' })
  })
})
