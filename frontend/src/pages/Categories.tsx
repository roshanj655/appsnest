import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import ExcelImport from '@/components/ExcelImport'

type Category = {
  _id: string
  name: string
  status: 'active' | 'inactive'
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const emptyForm = { name: '' }

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Category | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/categories', { ...authHeaders(), ...listParams })
      setCategories(listItems(res.data))
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to load categories.')
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setErrorMessage('')
    setShowForm(true)
  }

  const openEdit = (category: Category) => {
    setEditingId(category._id)
    setFormData({ name: category.name })
    setErrorMessage('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!formData.name.trim()) {
      setErrorMessage('Category name is required.')
      return
    }
    try {
      setSaving(true)
      if (editingId) {
        await axios.put(`/api/categories/${editingId}`, { name: formData.name.trim() }, authHeaders())
      } else {
        await axios.post('/api/categories', { name: formData.name.trim() }, authHeaders())
      }
      closeForm()
      fetchCategories()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save category.')
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
        await axios.delete(`/api/categories/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/categories/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'inactive' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      if (editingId === confirmRow._id) closeForm()
      fetchCategories()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Categories"
        description="Organize your catalog with clean category groups and active status tracking."
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Close Form' : 'Add Category'}
          </Button>
        }
      />

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Category' : 'Add New Category'}</CardTitle>
            <CardDescription>Use short, clear names that match your inventory structure.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            {!editingId && (
              <div className="mb-5">
                <ExcelImport
                  samplePath="/api/categories/import/sample"
                  importPath="/api/categories/import"
                  fileName="categories-import-sample.xlsx"
                  onImported={fetchCategories}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category Name</Label>
                <Input
                  id="category-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="Enter category name"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Category' : 'Save Category'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Category List</CardTitle>
          <CardDescription>{categories.length} categories available for your catalog.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category._id}>
                  <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${category.status === 'active' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/15 text-red-700'}`}>
                      {category.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <RecordActions
                      isActive={category.status === 'active'}
                      onEdit={() => openEdit(category)}
                      onToggle={() => {
                        setConfirmRow(category)
                        setConfirmKind(category.status === 'active' ? 'disable' : 'enable')
                      }}
                      onDelete={() => {
                        setConfirmRow(category)
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
        title={confirmKind === 'delete' ? 'Delete category' : confirmKind === 'disable' ? 'Disable category' : 'Enable category'}
        description={
          confirmKind === 'delete'
            ? `Do you want to delete ${confirmRow?.name}?`
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

export default Categories
