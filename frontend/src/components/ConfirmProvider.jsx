import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Themed replacement for window.confirm. Use:
 *
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title: 'Delete?', description: '...' })
 *   if (!ok) return
 *
 * Or with explicit actions to get back any value:
 *
 *   const choice = await confirm({
 *     title: 'Delete recurring task',
 *     actions: [
 *       { label: 'Cancel', value: null, variant: 'soft' },
 *       { label: 'Just this one', value: 'one', variant: 'danger' },
 *       { label: 'Entire series', value: 'series', variant: 'danger' },
 *     ],
 *   })
 */

const ConfirmCtx = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

const DEFAULT_ACTIONS = [
  { label: 'Cancel', value: false, variant: 'soft' },
  { label: 'Confirm', value: true, variant: 'primary' },
]

export default function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState(options || {})
    })
  }, [])

  const resolveWith = useCallback((value) => {
    const r = resolverRef.current
    resolverRef.current = null
    setState(null)
    if (r) r(value)
  }, [])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog state={state} onAction={resolveWith} />}
    </ConfirmCtx.Provider>
  )
}

function variantClasses(variant) {
  switch (variant) {
    case 'danger':
      return 'btn bg-rose-500/90 text-white shadow-md shadow-rose-500/30 hover:bg-rose-500'
    case 'primary':
      return 'btn-primary'
    case 'ghost':
      return 'btn-ghost'
    case 'soft':
    default:
      return 'btn-soft'
  }
}

function ConfirmDialog({ state, onAction }) {
  const {
    title = 'Are you sure?',
    description,
    icon = 'danger',
    actions = DEFAULT_ACTIONS,
  } = state

  const cancelRef = useRef(null)

  // Find a "cancel-like" action (variant=soft) to focus by default — safer
  // than focusing a destructive button (Enter wouldn't accidentally fire it).
  const cancelIdx = actions.findIndex((a) => a.variant === 'soft')

  useEffect(() => {
    if (cancelRef.current) cancelRef.current.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onAction(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onAction])

  const iconWrapClass =
    icon === 'danger'
      ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 ring-1 ring-rose-500/25'
      : 'bg-venom-300/15 text-venom-600 dark:text-venom-300 ring-1 ring-venom-300/25'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in
                 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md"
      onClick={() => onAction(null)}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border p-6 animate-slide-up
                   border-slate-200 bg-white shadow-2xl shadow-slate-900/30
                   dark:border-white/[0.08] dark:bg-[#13181f]
                   dark:shadow-[0_0_0_1px_rgba(184,255,58,0.06),inset_0_1px_0_rgba(255,255,255,0.05),0_30px_60px_-20px_rgba(0,0,0,0.95),0_0_80px_-30px_rgba(184,255,58,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        {/* Venom accent strip — clipped to round corners */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-venom-300/60 to-transparent" />
        </div>

        <div className="flex items-start gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconWrapClass}`}
          >
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-title"
              className="text-lg font-bold leading-tight tracking-tight"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAction(null)}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              ref={i === cancelIdx ? cancelRef : undefined}
              onClick={() => onAction(a.value)}
              className={variantClasses(a.variant)}
              type="button"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
