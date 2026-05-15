import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Themed dropdown — replaces the native <select>, which can't be styled
 * in dark mode (the option menu is OS-rendered).
 *
 * options: Array<{ value: any, label: string, color?: string, hint?: string }>
 *   - if `color` is set, a colored dot is shown next to the label
 * value: currently selected value (matches one option.value)
 * onChange: (newValue) => void
 * leftIcon: optional icon component shown in the trigger when no color is set
 * placeholder: text when no value is selected
 * className: extra classes for the trigger button
 * menuClassName: extra classes for the floating menu (e.g. "right-0" for alignment)
 */
export default function Dropdown({
  options,
  value,
  onChange,
  leftIcon: LeftIcon,
  placeholder = 'Select…',
  className = '',
  menuClassName = '',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Flip the menu upward when there's not enough room below the trigger.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    // Estimate: ~40px per item + 8px padding, capped at the menu's max-h-72 (288px)
    const estMenuHeight = Math.min(options.length * 40 + 16, 288)
    setOpenUp(spaceBelow < estMenuHeight + 8 && spaceAbove > spaceBelow)
  }, [open, options.length])

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`input flex cursor-pointer items-center justify-between gap-2 pl-3 pr-2.5 ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.color ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: current.color,
                boxShadow: `0 0 6px ${current.color}80`,
              }}
            />
          ) : LeftIcon ? (
            <LeftIcon size={13} className="shrink-0 text-slate-400" />
          ) : null}
          <span
            className={`truncate ${
              current ? '' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {current?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-30 min-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-slide-up
                      dark:border-white/10 dark:bg-[#13181f] dark:shadow-black/50
                      ${openUp ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'}
                      ${menuClassName}`}
        >
          <ul className="max-h-72 overflow-y-auto p-1">
            {options.map((o) => {
              const active = o.value === value
              return (
                <li key={String(o.value)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition
                      ${
                        active
                          ? 'bg-venom-300/12 text-venom-700 dark:text-venom-200 font-semibold ring-1 ring-venom-300/25'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                      }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {o.color ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: o.color,
                            boxShadow: `0 0 6px ${o.color}80`,
                          }}
                        />
                      ) : LeftIcon ? (
                        <LeftIcon size={13} className="shrink-0 text-slate-400" />
                      ) : null}
                      <span className="truncate">{o.label}</span>
                      {o.hint && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {o.hint}
                        </span>
                      )}
                    </span>
                    {active && (
                      <Check
                        size={14}
                        className="shrink-0 text-venom-500 dark:text-venom-300"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
