import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { fout: boolean }

/** Vangt render-fouten op zodat één kapot recept niet de hele app wit maakt. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { fout: false }

  static getDerivedStateFromError(): State {
    return { fout: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Onverwachte fout in de UI:', error)
  }

  render() {
    if (this.state.fout) {
      return (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">😕</p>
          <p className="text-olive-700/60 mb-4 text-sm">Er ging iets mis bij het tonen van deze pagina.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => this.setState({ fout: false })}
              className="text-sm font-semibold px-4 py-2 rounded-full border border-olive-700/15 text-olive-700/60 hover:text-olive-700 hover:border-olive-700/30 transition-all"
            >
              Opnieuw proberen
            </button>
            <a
              href="/recepten-app/"
              className="text-sm font-semibold px-4 py-2 rounded-full bg-terracotta-600 text-white transition-all"
            >
              Naar overzicht
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
