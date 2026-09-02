import { useEffect, useState } from 'react'
import axios from 'axios'
import { Label } from '@/components/ui/label'
import { authHeaders, listItems, listParams, storedBusinessUnitId } from '@/lib/api'

type Unit = { _id: string; name: string; code: string; status?: string }

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  label?: string
  allowUnassigned?: boolean
}

export const defaultUnitFormValue = () => storedBusinessUnitId()

export const BusinessUnitSelect = ({
  id = 'business-unit',
  value,
  onChange,
  label = 'Business unit',
  allowUnassigned = true
}: Props) => {
  const [units, setUnits] = useState<Unit[]>([])

  useEffect(() => {
    axios
      .get('/api/business-units', { ...authHeaders(), ...listParams })
      .then((res) => setUnits(listItems<Unit>(res.data).filter((unit) => unit.status !== 'inactive')))
      .catch(() => setUnits([]))
  }, [])

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      <select
        id={id}
        className="app-input h-10 w-full rounded-xl border px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowUnassigned && <option value="">Unassigned</option>}
        {units.map((unit) => (
          <option key={unit._id} value={unit._id}>
            {unit.name} ({unit.code})
          </option>
        ))}
      </select>
    </div>
  )
}
