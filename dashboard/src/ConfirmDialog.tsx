import { useId, useRef, useState, type ReactNode } from "react"
import { ConfirmContext, type ConfirmOptions } from "./confirmContext"

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null)
  const resolveRequest = useRef<((accepted: boolean) => void) | null>(null)
  const titleId = useId()
  const messageId = useId()

  function confirm(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      resolveRequest.current?.(false)
      resolveRequest.current = resolve
      setRequest(options)
    })
  }

  function finish(accepted: boolean) {
    setRequest(null)
    resolveRequest.current?.(accepted)
    resolveRequest.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <div className="confirm-backdrop">
        <section aria-describedby={messageId} aria-labelledby={titleId} aria-modal="true" className="confirm-dialog" role="alertdialog">
          <h2 id={titleId}>{request.title}</h2>
          <p id={messageId}>{request.message}</p>
          <div className="confirm-actions">
            <button autoFocus className="quiet-button" onClick={() => finish(false)} type="button">Cancel</button>
            <button className="primary-button confirm-danger" onClick={() => finish(true)} type="button">{request.confirmLabel ?? "Delete"}</button>
          </div>
        </section>
      </div>}
    </ConfirmContext.Provider>
  )
}