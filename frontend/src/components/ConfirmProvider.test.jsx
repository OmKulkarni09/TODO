import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmProvider, { useConfirm } from './ConfirmProvider.jsx'

function Trigger({ options, onResult }) {
  const confirm = useConfirm()
  return (
    <button
      onClick={async () => {
        const r = await confirm(options)
        onResult(r)
      }}
    >
      Trigger
    </button>
  )
}

describe('useConfirm hook · safety', () => {
  it('throws when used outside ConfirmProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bad() {
      useConfirm()
      return null
    }
    expect(() => render(<Bad />)).toThrow(/useConfirm must be used inside/)
    spy.mockRestore()
  })
})

describe('ConfirmProvider · default actions', () => {
  it('resolves true when Confirm is clicked', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'Sure?' }} onResult={onResult} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    expect(screen.getByText('Sure?')).toBeInTheDocument()
    await user.click(screen.getByText('Confirm'))
    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('resolves false when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'Sure?' }} onResult={onResult} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    await user.click(screen.getByText('Cancel'))
    expect(onResult).toHaveBeenCalledWith(false)
  })

  it('renders description below the title', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmProvider>
        <Trigger
          options={{ title: 'Delete?', description: 'This is permanent.' }}
          onResult={vi.fn()}
        />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    expect(screen.getByText('Delete?')).toBeInTheDocument()
    expect(screen.getByText('This is permanent.')).toBeInTheDocument()
  })

  it('autofocuses the soft (Cancel) button — Enter is safe by default', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'Delete?' }} onResult={vi.fn()} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    expect(screen.getByText('Cancel')).toHaveFocus()
  })
})

describe('ConfirmProvider · custom actions', () => {
  it('returns whatever value the chosen action carries', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger
          options={{
            title: 'Choose',
            actions: [
              { label: 'Cancel', value: null, variant: 'soft' },
              { label: 'Option A', value: 'a', variant: 'danger' },
              { label: 'Option B', value: 'b', variant: 'danger' },
            ],
          }}
          onResult={onResult}
        />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    await user.click(screen.getByText('Option B'))
    expect(onResult).toHaveBeenCalledWith('b')
  })

  it('handles three-way series-delete shape (matches the actual app usage)', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger
          options={{
            title: 'Delete recurring task',
            actions: [
              { label: 'Cancel', value: null, variant: 'soft' },
              { label: 'Just this one', value: 'one', variant: 'danger' },
              { label: 'Entire series', value: 'series', variant: 'danger' },
            ],
          }}
          onResult={onResult}
        />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    await user.click(screen.getByText('Entire series'))
    expect(onResult).toHaveBeenCalledWith('series')
  })
})

describe('ConfirmProvider · dismissal', () => {
  it('resolves null when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'X?' }} onResult={onResult} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    await user.keyboard('{Escape}')
    expect(onResult).toHaveBeenCalledWith(null)
  })

  it('resolves null when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'X?' }} onResult={onResult} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    await user.click(screen.getByRole('presentation'))
    expect(onResult).toHaveBeenCalledWith(null)
  })

  it('resolves null when the close (×) icon is clicked', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'X?' }} onResult={onResult} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    await user.click(screen.getByLabelText('Close'))
    expect(onResult).toHaveBeenCalledWith(null)
  })

  it('does NOT resolve when clicking inside the dialog body (event stopPropagation works)', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(
      <ConfirmProvider>
        <Trigger
          options={{ title: 'Body click test', description: 'click me' }}
          onResult={onResult}
        />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    // Click the description text — inside the dialog, should not dismiss
    await user.click(screen.getByText('click me'))
    expect(onResult).not.toHaveBeenCalled()
    // Dialog still open
    expect(screen.getByText('Body click test')).toBeInTheDocument()
  })

  it('dialog disappears after action is chosen', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmProvider>
        <Trigger options={{ title: 'Bye' }} onResult={vi.fn()} />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    expect(screen.getByText('Bye')).toBeInTheDocument()
    await user.click(screen.getByText('Confirm'))
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })
})

describe('ConfirmProvider · concurrent calls', () => {
  it('multiple confirms in succession each resolve independently', async () => {
    const user = userEvent.setup()
    const results = []
    function DoubleTrigger() {
      const confirm = useConfirm()
      return (
        <button
          onClick={async () => {
            results.push(await confirm({ title: 'First' }))
            results.push(await confirm({ title: 'Second' }))
          }}
        >
          Trigger
        </button>
      )
    }
    render(
      <ConfirmProvider>
        <DoubleTrigger />
      </ConfirmProvider>
    )
    await user.click(screen.getByText('Trigger'))
    expect(screen.getByText('First')).toBeInTheDocument()
    await user.click(screen.getByText('Confirm'))
    // After resolving first, the second pops up
    expect(await screen.findByText('Second')).toBeInTheDocument()
    await user.click(screen.getByText('Cancel'))
    expect(results).toEqual([true, false])
  })
})
