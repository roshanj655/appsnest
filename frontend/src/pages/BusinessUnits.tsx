import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { requiredMsg, useFieldErrors } from '@/lib/formValidation'
import ExcelImport from '@/components/ExcelImport'

type BusinessUnit = {
  _id: string
  name: string
  code: string
  notes?: string
  status: 'active' | 'inactive'
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const emptyForm = { name: '', code: '', notes: '' }

const BusinessUnits = () => {
  const [units, setUnits] = useState<BusinessUnit[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<BusinessUnit | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

  const fetchUnits = async () => {
    try {
      const res = await axios.get('/api/business-units', { ...authHeaders(), ...listParams })
      setUnits(listItems(res.data))
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to load business units.')
    }
  }

  useEffect(() => {
    fetchUnits()
  }, [])

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
    clearFieldErrors()
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setErrorMessage('')
    clearFieldErrors()
    setShowForm(true)
  }

  const openEdit = (unit: BusinessUnit) => {
    setEditingId(unit._id)
    setFormData({ name: unit.name, code: unit.code, notes: unit.notes || '' })
    setErrorMessage('')
    clearFieldErrors()
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    clearFieldErrors()
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors['unit-name'] = requiredMsg('Name')
    if (!formData.code.trim()) errors['unit-code'] = requiredMsg('Code')
    if (showFieldErrors(errors)) return
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      notes: formData.notes.trim()
    }
    try {
      setSaving(true)
      if (editingId) {
        await axios.put(`/api/business-units/${editingId}`, payload, authHeaders())
      } else {
        await axios.post('/api/business-units', payload, authHeaders())
      }
      closeForm()
      fetchUnits()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save business unit.')
    } finally {
      setSaving(false)
    }
  }

  const runConfirm = async () => {
    if (!confirmKind || !confirmRow) return
    setConfirmBusy(true)
    setErrorMessage('')
    try {
      if (confirmKind === 'delete') {
        await axios.delete(`/api/business-units/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/business-units/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'inactive' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      if (editingId === confirmRow._id) closeForm()
      fetchUnits()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Business units"
        description="Split one tenant into Disposable, Puja Samagri, Store, and any other divisions you operate."
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Close Form' : 'Add Unit'}
          </Button>
        }
      />

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Unit' : 'Add Business Unit'}</CardTitle>
            <CardDescription>Products, sales, purchases, and expenses can be tagged to a unit for split reports.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            {!editingId && (
              <div className="mb-5">
                <ExcelImport
                  samplePath="/api/business-units/import/sample"
                  importPath="/api/business-units/import"
                  fileName="business-units-import-sample.xlsx"
                  onImported={fetchUnits}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField id="unit-name" label="Name" error={fieldErrors['unit-name']} required>
                  <Input
                    id="unit-name"
                    value={formData.name}
                    onChange={(e) => {
                      clearFieldError('unit-name')
                      setFormData({ ...formData, name: e.target.value })
                    }}
                    placeholder="Disposable"
                    invalid={Boolean(fieldErrors['unit-name'])}
                  />
                </FormField>
                <FormField id="unit-code" label="Code" error={fieldErrors['unit-code']} required>
                  <Input
                    id="unit-code"
                    value={formData.code}
                    onChange={(e) => {
                      clearFieldError('unit-code')
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }}
                    placeholder="DISP"
                    invalid={Boolean(fieldErrors['unit-code'])}
                  />
                </FormField>
                <FormField id="unit-notes" label="Notes" error={fieldErrors['unit-notes']} className="md:col-span-2">
                  <Input
                    id="unit-notes"
                    value={formData.notes}
                    onChange={(e) => {
                      clearFieldError('unit-notes')
                      setFormData({ ...formData, notes: e.target.value })
                    }}
                    placeholder="Optional"
                    invalid={Boolean(fieldErrors['unit-notes'])}
                  />
                </FormField>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Unit' : 'Save Unit'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
          <CardDescription>{units.length} divisions under this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit._id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>{unit.code}</TableCell>
                  <TableCell>{unit.notes || '—'}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${unit.status === 'active' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/15 text-red-700'}`}>
                      {unit.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <RecordActions
                      isActive={unit.status === 'active'}
                      onEdit={() => openEdit(unit)}
                      onToggle={() => {
                        setConfirmRow(unit)
                        setConfirmKind(unit.status === 'active' ? 'disable' : 'enable')
                      }}
                      onDelete={() => {
                        setConfirmRow(unit)
                        setConfirmKind('delete')
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmKind && confirmRow)}
        title={confirmKind === 'delete' ? 'Delete unit' : confirmKind === 'disable' ? 'Disable unit' : 'Enable unit'}
        description={
          confirmKind === 'delete'
            ? `Do you want to delete ${confirmRow?.name}? Existing records keep their tags until you reassign them.`
            : confirmKind === 'disable'
              ? `Do you want to disable ${confirmRow?.name}?`
              : `Do you want to enable ${confirmRow?.name}?`
        }
        confirmLabel={confirmKind === 'delete' ? 'Delete' : confirmKind === 'disable' ? 'Disable' : 'Enable'}
        variant={confirmKind === 'enable' ? 'default' : 'destructive'}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmKind(null)
            setConfirmRow(null)
          }
        }}
      />
    </div>
  )
}

export default BusinessUnits
