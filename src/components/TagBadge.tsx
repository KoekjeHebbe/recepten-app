const TAG_COLORS: Record<string, string> = {
  diner:      'bg-terracotta-100 text-terracotta-700 border-terracotta-200',
  lunch:      'bg-amber-50 text-amber-700 border-amber-200',
  bijgerecht: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  tapas:      'bg-orange-50 text-orange-700 border-orange-200',
  ontbijt:    'bg-sky-50 text-sky-700 border-sky-200',
  snack:      'bg-purple-50 text-purple-700 border-purple-200',
  dessert:    'bg-pink-50 text-pink-700 border-pink-200',
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
