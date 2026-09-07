import { useEffect, useState } from 'react'
import axios from 'axios'
import { Label } from '@/components/ui/label'
import { authHeaders, listItems, listParams, storedBusinessUnitId } from '@/lib/api'
import SearchableSelect from '@/components/SearchableSelect'

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
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        emptyLabel={allowUnassigned ? 'Unassigned' : undefined}
        placeholder="Select business unit"
        searchPlaceholder="Search unit name or code…"
        options={units.map((unit) => ({
          value: unit._id,
          label: `${unit.name} (${unit.code})`,
          searchText: `${unit.name} ${unit.code}`
        }))}
      />
    </div>
  )
}
