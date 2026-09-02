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
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
      )}
      <Button type="button" size="sm" variant="secondary" onClick={onToggle}>
        {isActive ? disableLabel : enableLabel}
      </Button>
      <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}

export default RecordActions
