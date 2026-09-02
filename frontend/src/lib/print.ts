import axios from 'axios'
import { authHeaders } from '@/lib/api'

export const printPosReceipt = async (saleId: string, options?: { reprint?: boolean }) => {
  const response = await axios.get(`/api/sales/${saleId}/invoice`, {
    ...authHeaders(),
    params: {
      format: 'pos',
      print: 1,
      reprint: options?.reprint ? 1 : undefined
    },
    responseType: 'blob'
  })
  const blob = new Blob([response.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.src = url
  const cleanup = () => {
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url)
      frame.remove()
    }, 60_000)
  }
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    cleanup()
  }
  document.body.appendChild(frame)
}
