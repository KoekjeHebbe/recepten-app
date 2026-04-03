const TAG_COLORS: Record<string, string> = {
  diner: 'bg-terracotta-100 text-terracotta-700',
  lunch: 'bg-amber-100 text-amber-700',
  bijgerecht: 'bg-yellow-100 text-yellow-700',
  tapas: 'bg-orange-100 text-orange-700',
  ontbijt: 'bg-sky-100 text-sky-700',
  snack: 'bg-purple-100 text-purple-700',
  dessert: 'bg-pink-100 text-pink-700',
}

interface Props {
  tag: string
  onClick?: () => void
  active?: boolean
}

export default function TagBadge({ tag, onClick, active }: Props) {
  const color = TAG_COLORS[tag] ?? 'bg-stone-100 text-stone-600'
  const display = tag.replace(/_/g, ' ')

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all border ${
          active ? 'ring-2 ring-offset-1 ring-terracotta-500 ' + color : color + ' border-transparent'
        }`}
      >
        {display}
      </button>
    )
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {display}
    </span>
  )
}
