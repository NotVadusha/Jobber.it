import { Label } from '@/features/search/SearchForm'

// Verified against the indexed corpus; an example returning nothing misleads.
const EXAMPLES = ['python aws terraform', 'node.js typescript nestjs', 'distributed systems scala']

export function SearchExamples({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <section className="mt-16">
      <Label>Try</Label>
      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => onSelect(example)}
              className="border border-subtle px-3 py-1.5 font-mono text-xs text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
