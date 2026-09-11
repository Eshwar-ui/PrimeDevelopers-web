import { useEffect, useId, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'

const VARIANTS = {
  pill: {
    trigger:
      'h-11 rounded-full border-content/20 bg-surface px-4 text-content hover:border-content/35 sm:text-[13px]',
    placeholder: 'text-content/60',
    icon: 'text-content/70',
    menu: 'border-line bg-surface',
    option:
      'text-content/75 hover:bg-content/10 hover:text-content focus-visible:bg-content/10 focus-visible:text-content',
  },
  form: {
    trigger:
      'contact-field h-12 rounded-xl border-[var(--color-line)] bg-carbon px-4 text-bone hover:border-bone/30',
    placeholder: 'text-bone-3',
    icon: 'text-bone/70',
    menu: 'border-[var(--color-line)] bg-carbon',
    option: 'text-bone/75 hover:bg-bone/10 hover:text-bone focus-visible:bg-bone/10 focus-visible:text-bone',
  },
}

export default function CustomSelect({
  id,
  label,
  name,
  value,
  defaultValue = '',
  placeholder = 'Select one',
  options,
  onChange,
  required = false,
  variant = 'pill',
}) {
  const controlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const generatedId = useId()
  const listboxId = generatedId + '-listbox'
  const currentValue = controlled ? value : internalValue
  const selectedIndex = options.findIndex((option) => option.value === currentValue)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null
  const styles = VARIANTS[variant] ?? VARIANTS.pill

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const focusTimer = window.setTimeout(() => {
      optionRefs.current[activeIndex]?.focus()
    }, 0)

    return () => window.clearTimeout(focusTimer)
  }, [activeIndex, open])

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const focusOption = (index) => {
    setActiveIndex((index + options.length) % options.length)
  }

  const selectOption = (option) => {
    if (!controlled) setInternalValue(option.value)
    onChange?.(option.value)
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  const handleOptionKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusOption(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusOption(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(options[index])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={'relative min-w-0 ' + (open ? 'z-40' : '')}>
      {name && <input type="hidden" name={name} value={currentValue} readOnly />}
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required || undefined}
        data-open={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={
          'flex w-full items-center justify-between gap-4 border text-left font-body text-[16px] font-semibold outline-none transition-[border-color,box-shadow] focus-visible:border-accent/75 focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[open=true]:border-accent/75 data-[open=true]:ring-[3px] data-[open=true]:ring-accent/15 ' +
          styles.trigger
        }
      >
        <span className={'min-w-0 truncate ' + (selectedOption ? '' : styles.placeholder)}>
          {selectedOption?.label ?? placeholder}
        </span>
        <CaretDown
          size={16}
          weight="bold"
          aria-hidden="true"
          className={'shrink-0 transition-transform duration-200 ' + styles.icon + (open ? ' rotate-180' : '')}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={
            'absolute left-0 top-[calc(100%+0.5rem)] z-40 max-h-72 w-full overflow-y-auto rounded-xl border p-1.5 shadow-[0_22px_55px_-28px_rgba(0,0,0,0.75)] ' +
            styles.menu
          }
        >
          {options.map((option, index) => {
            const selected = option.value === currentValue

            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => selectOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={
                  'flex min-h-10 w-full items-center justify-between gap-3 rounded-[9px] px-3 py-2 text-left font-body text-[14px] font-medium outline-none transition-colors ' +
                  (selected ? 'bg-accent text-white dark:text-void' : styles.option)
                }
              >
                <span>{option.label}</span>
                <Check
                  size={15}
                  weight="bold"
                  aria-hidden="true"
                  className={selected ? 'shrink-0' : 'invisible shrink-0'}
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}