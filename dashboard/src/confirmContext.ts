import { createContext, useContext } from "react"

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
}

type ConfirmRequest = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmRequest | null>(null)

export function useConfirmation() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error("ConfirmationProvider is missing")
  return confirm
}