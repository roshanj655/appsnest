import { useEffect, useState } from 'react'
import axios from 'axios'
import { FormField } from '@/components/FormField'
import { authHeaders, listItems, listParams, storedBusinessUnitId } from '@/lib/api'
import SearchableSelect from '@/components/SearchableSelect'

type Unit = { _id: string; name: string; code: string; status?: string }

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  label?: string
  allowUnassigned?: boolean
  error?: string
  required?: boolean
}

export const defaultUnitFormValue = () => storedBusinessUnitId()

export const BusinessUnitSelect = ({
  id = 'business-unit',
  value,
  onChange,
  label = 'Business unit',
  allowUnassigned = true,
  error,
  required
}: Props) => {
  const [units, setUnits] = useState<Unit[]>([])

  useEffect(() => {
    axios
      .get('/api/business-units', { ...authHeaders(), ...listParams })
      .then((res) => setUnits(listItems<Unit>(res.data).filter((unit) => unit.status !== 'inactive')))
      .catch(() => setUnits([]))
  }, [])

  return (
    <FormField id={id} label={label} error={error} required={required}>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        invalid={Boolean(error)}
        required={required}
        emptyLabel={allowUnassigned ? 'Unassigned' : undefined}
        placeholder="Select business unit"
        searchPlaceholder="Search unit name or code…"
        options={units.map((unit) => ({
          value: unit._id,
          label: `${unit.name} (${unit.code})`,
          searchText: `${unit.name} ${unit.code}`
        }))}
      />
    </FormField>
  )
}
