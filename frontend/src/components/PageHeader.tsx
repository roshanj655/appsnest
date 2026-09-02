import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
  return (
    <div className="page-header mb-6 flex flex-col gap-3 overflow-hidden rounded-[24px] border px-4 py-4 shadow-[0_18px_60px_rgba(2,8,23,0.2)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <p className="page-header-kicker text-[10px] font-semibold uppercase tracking-[0.24em]">Operations Panel</p>
        <h2 className="page-header-title mt-1.5 text-lg font-medium tracking-tight sm:text-xl">{title}</h2>
        {description && <p className="page-header-description mt-1.5 max-w-3xl text-xs sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}

export default PageHeader
