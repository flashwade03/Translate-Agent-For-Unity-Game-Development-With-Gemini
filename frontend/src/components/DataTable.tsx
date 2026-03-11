import { useState } from 'react'
import { EditableCell } from './EditableCell'
import type { SheetData } from '../types'

interface DataTableProps {
  data: SheetData
  disabled?: boolean
  visibleLanguages?: string[] | null
  pendingCells?: Record<string, Record<string, string>>
  baseRows?: Record<string, Record<string, string>>
  hideCheckboxes?: boolean
  hideAddRow?: boolean
  onCellSave: (key: string, langCode: string, value: string) => void
  onDeleteLanguage?: (code: string) => void
  onAddLanguage?: () => void
  onAddRow?: (key: string) => void
  onDeleteRows?: (keys: string[]) => void
  onToggleVisibility?: (code: string) => void
}

export function DataTable({
  data,
  disabled,
  visibleLanguages,
  pendingCells,
  baseRows,
  hideCheckboxes,
  hideAddRow,
  onCellSave,
  onDeleteLanguage,
  onAddLanguage,
  onAddRow,
  onDeleteRows,
  onToggleVisibility,
}: DataTableProps) {
  const { languages, rows } = data

  const isVisible = (code: string) => !visibleLanguages || visibleLanguages.includes(code)
  const [newKey, setNewKey] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const showCheckboxes = !hideCheckboxes
  const showAddRow = !hideAddRow && onAddRow

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedKeys.size === rows.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(rows.map((r) => r.key)))
    }
  }

  const handleAddRow = () => {
    const trimmed = newKey.trim()
    if (!trimmed || !onAddRow) return
    onAddRow(trimmed)
    setNewKey('')
  }

  const isPending = (key: string, langCode: string) =>
    !!pendingCells && !!pendingCells[key] && langCode in pendingCells[key]

  const getBaseValue = (key: string, langCode: string) =>
    baseRows?.[key]?.[langCode] ?? ''

  return (
    <div>
      {showCheckboxes && selectedKeys.size > 0 && onDeleteRows && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => {
              onDeleteRows(Array.from(selectedKeys))
              setSelectedKeys(new Set())
            }}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-error rounded-[var(--radius-md)] hover:bg-error/90 disabled:opacity-50 cursor-pointer"
          >
            Delete Selected ({selectedKeys.size})
          </button>
        </div>
      )}
      <div className="border border-border rounded-[var(--radius-md)] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-muted">
              {showCheckboxes && (
                <th className="px-3 py-2 w-11">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedKeys.size === rows.length}
                    onChange={toggleSelectAll}
                    disabled={disabled}
                    className="accent-accent"
                  />
                </th>
              )}
              <th className="text-left px-3 py-2 font-medium text-text-muted w-48 sticky left-0 bg-bg-muted">
                Key
              </th>
              {languages.map((lang) => {
                const visible = isVisible(lang.code)
                if (!visible && !onToggleVisibility) return null
                return (
                  <th
                    key={lang.code}
                    className={`text-left px-3 py-2 font-medium text-text-muted ${visible ? 'min-w-[200px]' : 'w-10'}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {onToggleVisibility && (
                        <button
                          onClick={() => onToggleVisibility(lang.code)}
                          className="text-text-muted hover:text-accent cursor-pointer shrink-0"
                          title={visible ? `Hide ${lang.label}` : `Show ${lang.label}`}
                        >
                          {visible ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          )}
                        </button>
                      )}
                      {visible && (
                        <>
                          {lang.label}
                          {lang.isSource && (
                            <span className="text-xs text-accent font-normal">(source)</span>
                          )}
                          {!lang.isSource && onDeleteLanguage && (
                            <button
                              onClick={() => onDeleteLanguage(lang.code)}
                              className="ml-1 text-text-muted hover:text-error text-xs cursor-pointer"
                              title={`Delete ${lang.label}`}
                            >
                              &times;
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </th>
                )
              })}
              {onAddLanguage && (
                <th className="px-3 py-2 w-12">
                  <button
                    onClick={onAddLanguage}
                    className="text-text-muted hover:text-accent text-lg leading-none cursor-pointer"
                    title="Add language"
                  >
                    +
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-border last:border-b-0 ${selectedKeys.has(row.key) ? 'bg-accent/5' : 'hover:bg-bg-muted/50'}`}
              >
                {showCheckboxes && (
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row.key)}
                      onChange={() => toggleSelect(row.key)}
                      disabled={disabled}
                      className="accent-accent"
                    />
                  </td>
                )}
                <td className="px-3 py-1.5 font-mono text-xs text-text-muted sticky left-0 bg-white">
                  {row.key}
                </td>
                {languages.map((lang) => {
                  const visible = isVisible(lang.code)
                  if (!visible && !onToggleVisibility) return null
                  if (!visible) return <td key={lang.code} />

                  const cellIsPending = isPending(row.key, lang.code)
                  const baseVal = getBaseValue(row.key, lang.code)
                  const isNew = cellIsPending && !baseVal

                  return (
                    <td
                      key={lang.code}
                      className={`px-1 py-0.5 ${
                        cellIsPending
                          ? isNew
                            ? 'bg-green-50 border-l-2 border-green-300'
                            : 'bg-amber-50 border-l-2 border-amber-300'
                          : ''
                      }`}
                    >
                      {cellIsPending && !isNew && baseVal !== row[lang.code] && (
                        <div className="px-2 text-xs text-text-muted line-through truncate" title={baseVal}>
                          {baseVal}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <EditableCell
                          value={row[lang.code] ?? ''}
                          isEmpty={!row[lang.code]}
                          disabled={disabled}
                          onSave={(val) => onCellSave(row.key, lang.code, val)}
                        />
                        {cellIsPending && isNew && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
                {onAddLanguage && <td />}
              </tr>
            ))}
            {showAddRow && (
              <tr className="border-b border-border last:border-b-0">
                {showCheckboxes && (
                  <td className="px-3 py-1.5">{/* empty checkbox cell */}</td>
                )}
                <td className="px-3 py-1.5 sticky left-0 bg-white">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAddRow()
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="new_key"
                      disabled={disabled}
                      className="w-full font-mono text-xs px-2 py-1 border border-border rounded-[var(--radius-sm)] outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent placeholder:text-text-muted/50"
                    />
                    <button
                      type="submit"
                      disabled={disabled || !newKey.trim()}
                      className="text-accent hover:text-accent/80 disabled:opacity-30 text-lg leading-none shrink-0"
                      title="Add key"
                    >
                      +
                    </button>
                  </form>
                </td>
                {languages.map((lang) => {
                  const visible = isVisible(lang.code)
                  if (!visible && !onToggleVisibility) return null
                  return (
                    <td key={lang.code} className="px-1 py-0.5 text-text-muted/30 text-xs italic">
                      {/* empty cells for new row placeholder */}
                    </td>
                  )
                })}
                {onAddLanguage && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
