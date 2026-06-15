// Twee-tonig in de huisstijl: maaltijdtypes krijgen een terracotta-tint,
// alle overige (inhouds-)tags vallen terug op de olive-tint hieronder.
const TAG_COLORS: Record<string, string> = {
  diner:      'bg-terracotta-100 text-terracotta-700 border-terracotta-200',
  lunch:      'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  bijgerecht: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  tapas:      'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  ontbijt:    'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  snack:      'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  dessert:    'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
}

interface Props {
  tag: string
  onClick?: () => void
  active?: boolean
}

export default function TagBadge({ tag, onClick, active }: Props) {
  const color = TAG_COLORS[tag] ?? 'bg-olive-50 text-olive-600 border-olive-100'
  const display = tag.replace(/_/g, ' ')

  if (onClick) {
    return (
      <button
        onClick={onClick}
        aria-pressed={!!active}
        className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide border transition-all btn-magnetic ${
          active
            ? 'bg-olive-700 text-cream border-olive-700 ring-2 ring-olive-700/20 ring-offset-1'
            : color
        }`}
      >
        {display}
      </button>
    )
  }

  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide border ${color}`}>
      {display}
    </span>
  )
}
