import { useRef, useState } from 'react'
import axios from 'axios'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authHeaders } from '@/lib/api'

type ImportError = { row: number; message: string }

type ExcelImportProps = {
  samplePath: string
  importPath: string
  fileName: string
  onImported: () => void
}

const ExcelImport = ({ samplePath, importPath, fileName, onImported }: ExcelImportProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'sample' | 'upload' | null>(null)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<ImportError[]>([])

  const downloadSample = async () => {
    setBusy('sample')
    setMessage('')
    setErrors([])
    try {
      const res = await axios.get(samplePath, { ...authHeaders(), responseType: 'blob' })
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Unable to download the sample Excel file.')
    } finally {
      setBusy(null)
    }
  }

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setMessage('Upload an .xlsx Excel file.')
      return
    }
    setBusy('upload')
    setMessage('')
    setErrors([])
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post(importPath, form, authHeaders())
      setMessage(res.data?.message || 'Import finished.')
      setErrors(Array.isArray(res.data?.errors) ? res.data.errors.slice(0, 20) : [])
      onImported()
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Unable to import this Excel file.')
    } finally {
      setBusy(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-cyan-700/30 bg-cyan-50/40 p-4">
      <p className="text-sm font-medium text-foreground">Import from Excel</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Download the sample, fill your rows, then upload the same .xlsx file. Do not rename the header columns.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={downloadSample} disabled={Boolean(busy)}>
          <Download />
          {busy === 'sample' ? 'Preparing…' : 'Download sample Excel'}
        </Button>
        <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)}>
          <Upload />
          {busy === 'upload' ? 'Importing…' : 'Upload Excel'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadFile(file)
          }}
        />
      </div>
      {message && <p className="mt-3 text-sm text-foreground">{message}</p>}
      {errors.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-red-800">
          {errors.map((error) => (
            <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ExcelImport
