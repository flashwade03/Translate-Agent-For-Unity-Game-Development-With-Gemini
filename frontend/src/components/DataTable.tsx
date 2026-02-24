import { EditableCell } from './EditableCell'
import type { SheetData } from '../types'

interface DataTableProps {
  data: SheetData
  disabled?: boolean
  onCellSave: (key: string, langCode: string, value: string) => void
  onDeleteLanguage?: (code: string) => void
  onAddLanguage?: () => void
}

export function DataTable({ data, disabled, onCellSave, onDeleteLanguage, onAddLanguage }: DataTableProps) {
  const { languages, rows } = data

  return (
    <div className="border border-border rounded-[var(--radius-md)] overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-muted">
            <th className="text-left px-3 py-2 font-medium text-text-muted w-48 sticky left-0 bg-bg-muted">
              Key
            </th>
            {languages.map((lang) => (
              <th
                key={lang.code}
                className="text-left px-3 py-2 font-medium text-text-muted min-w-[200px]"
              >
                <span className="inline-flex items-center gap-1.5">
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
                </span>
              </th>
            ))}
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
            <tr key={row.key} className="border-b border-border last:border-b-0 hover:bg-bg-muted/50">
              <td className="px-3 py-1.5 font-mono text-xs text-text-muted sticky left-0 bg-white">
                {row.key}
              </td>
              {languages.map((lang) => (
                <td key={lang.code} className="px-1 py-0.5">
                  <EditableCell
                    value={row[lang.code] ?? ''}
                    readOnly={lang.isSource}
                    isEmpty={!lang.isSource && !row[lang.code]}
                    disabled={disabled}
                    onSave={(val) => onCellSave(row.key, lang.code, val)}
                  />
                </td>
              ))}
              {onAddLanguage && <td />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
