import { Button } from '@/components/ui/button'

type RecordActionsProps = {
  isActive: boolean
  disableLabel?: string
  enableLabel?: string
  hideEdit?: boolean
  onEdit?: () => void
  onToggle: () => void
  onDelete: () => void
}

const RecordActions = ({
  isActive,
  disableLabel = 'Disable',
  enableLabel = 'Enable',
  hideEdit = false,
  onEdit,
  onToggle,
  onDelete
}: RecordActionsProps) => {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!hideEdit && onEdit && (
        <Button type="button" size="sm" variant="outline" className="min-h-9 px-3" onClick={onEdit}>
          Edit
        </Button>
      )}
      <Button type="button" size="sm" variant="secondary" className="min-h-9 px-3" onClick={onToggle}>
        {isActive ? disableLabel : enableLabel}
      </Button>
      <Button type="button" size="sm" variant="destructive" className="min-h-9 px-3" onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}

export default RecordActions
