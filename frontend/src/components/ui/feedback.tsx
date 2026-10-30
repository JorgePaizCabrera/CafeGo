import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: number, kind: ToastKind, message: string }

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  soloConfirmar?: boolean
}
interface ConfirmRequest extends ConfirmOptions { resolve: (ok: boolean) => void }

let toasts: ToastItem[] = []
let confirmRequest: ConfirmRequest | null = null
let nextId = 1
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

function pushToast(kind: ToastKind, message: string) {
  const id = nextId++
  toasts = [...toasts.slice(-3), { id, kind, message }]
  emit()
  setTimeout(() => dismissToast(id), kind === 'error' ? 6000 : 3500)
}

export const toast = {
  success: (message: string) => pushToast('success', message),
  error: (message: string) => pushToast('error', message),
  info: (message: string) => pushToast('info', message),
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  confirmRequest?.resolve(false)
  return new Promise(resolve => {
    confirmRequest = { ...options, resolve }
    emit()
  })
}

function closeConfirm(ok: boolean) {
  confirmRequest?.resolve(ok)
  confirmRequest = null
  emit()
}

const TOAST_STYLE: Record<ToastKind, { icon: typeof Info, className: string }> = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  error: { icon: XCircle, className: 'border-red-200 bg-red-50 text-red-800' },
  info: { icon: Info, className: 'border-stone-200 bg-white text-stone-800' },
}

export function FeedbackHost() {
  const items = useSyncExternalStore(subscribe, () => toasts)
  const request = useSyncExternalStore(subscribe, () => confirmRequest)

  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96">
        {items.map(t => {
          const { icon: Icon, className } = TOAST_STYLE[t.kind]
          return (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`animate-slide-up pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium shadow-lg ${className}`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button type="button" aria-label="Cerrar" className="-m-1 rounded-lg p-1 opacity-60 transition hover:opacity-100" onClick={() => dismissToast(t.id)}><X size={15} /></button>
            </div>
          )
        })}
      </div>
      {request && <ConfirmModal request={request} />}
    </>
  )
}

function ConfirmModal({ request }: { request: ConfirmRequest }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    (request.danger ? cancelRef : confirmRef).current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeConfirm(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request])

  return (
    <div className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4" onClick={() => closeConfirm(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="gc-confirm-title" className="animate-slide-up w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex gap-4">
          {request.danger && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><AlertTriangle size={20} /></div>}
          <div>
            <h3 id="gc-confirm-title" className="text-lg font-bold text-stone-900">{request.title}</h3>
            {request.message && <p className="mt-1.5 text-sm text-stone-600">{request.message}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!request.soloConfirmar && <button ref={cancelRef} type="button" className="btn-secondary" onClick={() => closeConfirm(false)}>{request.cancelLabel ?? 'Cancelar'}</button>}
          <button ref={confirmRef} type="button" className={request.danger ? 'btn-danger' : 'btn-primary'} onClick={() => closeConfirm(true)}>{request.confirmLabel ?? 'Confirmar'}</button>
        </div>
      </div>
    </div>
  )
}
