import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
  titleIcon?: 'warning'
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md', titleIcon }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`backdrop:bg-black/40 p-0 rounded-[var(--radius-lg)] border border-border w-full ${maxWidth}`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {titleIcon === 'warning' && (
              <svg className="w-5 h-5 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
