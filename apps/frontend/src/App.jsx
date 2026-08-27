import { useEffect, useState } from 'react'

const REMOTE = ['remote', 'hybrid', 'onsite']
const SENIORITY = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal']
// Verified against the indexed corpus; an example returning nothing misleads.
const EXAMPLES = ['python aws terraform', 'node.js typescript nestjs', 'distributed systems scala']

// The only tokenizer: the server sends stack tokens verbatim.
const split = (text) => text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)

const money = (min, max) => {
  if (!min && !max) return null
  const k = (n) => `$${Math.round(n / 1000)}k`
  return min && max && min !== max ? `${k(min)}–${k(max)}` : k(max || min)
}

const posted = (iso) => {
  const at = new Date(iso)
  return Number.isNaN(at.valueOf())
    ? null
    : at.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function Label({ children }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{children}</span>
  )
}

function Toggle({ on, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`border px-2.5 py-1 font-mono text-xs transition-colors ${
        on
          ? 'border-lex bg-lex/10 text-lex'
          : 'border-line text-muted hover:border-edge hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}

function Number_({ label, value, onChange, placeholder }) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 border border-line bg-transparent px-2 py-1 font-mono text-xs text-paper
                   placeholder:text-muted/60 hover:border-edge focus:border-lex focus:outline-none"
      />
    </label>
  )
}

function Trace({ data, busy }) {
  return (
    <section className="mt-10 border border-line bg-panel" aria-label="Retrieval trace">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3">
        <Label>Retrieval trace</Label>
        <p className="font-mono text-[11px] tabular-nums text-muted">
          {busy ? 'running…' : `${data.results.length} of ${data.corpus_size} · ${data.took_ms} ms`}
        </p>
      </div>

      <div className="relative px-5 py-6">
        <div className="absolute inset-x-5 top-[30px] h-px" aria-hidden="true">
          <div className="mx-[16.6%] h-px bg-edge" />
        </div>
        <ol className="relative grid grid-cols-3 gap-1">
          {data.trace.map((node) => {
            const ran = node.status === 'ran'
            return (
              <li key={node.node} className="flex flex-col items-center text-center">
                <span className="inline-flex bg-panel px-3">
                  <span
                    className={`block size-3 rotate-45 ${
                      ran ? 'bg-lex' : 'border border-sem/60 bg-panel'
                    }`}
                  />
                </span>
                <span
                  className={`mt-3 font-mono text-[11px] uppercase tracking-[0.14em] ${
                    ran ? 'text-paper' : 'text-muted'
                  }`}
                >
                  {node.node}
                </span>
                {node.count != null && (
                  <span className="mt-1 font-mono text-[11px] tabular-nums text-lex">
                    {node.count}
                  </span>
                )}
                {/* Detail is what a phone drops; the name and count are the rail. */}
                <span className="mt-1 hidden max-w-[16ch] font-mono text-[10px] leading-relaxed text-muted sm:block">
                  {node.detail}
                </span>
                {!ran && (
                  <span className="mt-1 font-mono text-[10px] text-sem/70">not wired yet</span>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <dl className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:gap-8">
        <div className="flex flex-wrap items-center gap-2">
          <dt><Label>Terms</Label></dt>
          {data.terms.length ? (
            data.terms.map((term) => (
              <dd key={term} className="font-mono text-xs text-lex">{term}</dd>
            ))
          ) : (
            <dd className="font-mono text-xs text-muted">none — no stack tokens extracted</dd>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt><Label>Filters</Label></dt>
          {data.filters_applied.length ? (
            data.filters_applied.map((filter) => (
              <dd
                key={filter.field}
                title={filter.note}
                className="border border-edge px-2 py-0.5 font-mono text-xs text-paper"
              >
                {filter.field.replace(/_/g, ' ')} = {filter.label}
              </dd>
            ))
          ) : (
            <dd className="font-mono text-xs text-muted">none — full corpus in scope</dd>
          )}
        </div>
      </dl>
    </section>
  )
}

function Result({ result, rank, tokens }) {
  const place = result.location
  const policy = result.remote_policy !== 'unknown' && result.remote_policy
  const facts = [
    place,
    policy && policy !== place?.toLowerCase() && policy,
    result.seniority !== 'unknown' && result.seniority,
    result.years_required != null && `${result.years_required}y+`,
    money(result.salary_min, result.salary_max),
    result.source,
    posted(result.posted_at),
  ].filter(Boolean)

  return (
    <li
      className="rise grid grid-cols-[2rem_1fr] gap-x-4 border-b border-line py-6"
      style={{ animationDelay: `${Math.min(rank, 12) * 45}ms` }}
    >
      <span className="pt-1 font-mono text-sm tabular-nums text-muted">
        {String(rank + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-medium leading-snug">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-lex"
            >
              {result.title}
              <span aria-hidden="true" className="ml-1.5 text-xs text-muted">↗</span>
            </a>
          </h3>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <div className="h-[3px] w-14 bg-line" aria-hidden="true">
              <div className="h-full bg-lex" style={{ width: `${result.score * 100}%` }} />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted">
              {result.score.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="mt-1.5 font-mono text-xs text-muted">
          <span className="text-paper">{result.company}</span>
          {facts.map((fact) => (
            <span key={fact}> · {fact}</span>
          ))}
        </p>

        {result.stack?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {result.stack.map((tech) => {
              const hit = split(tech).some((token) => tokens.includes(token))
              return (
                <li
                  key={tech}
                  className={`border px-2 py-0.5 font-mono text-xs ${
                    hit ? 'border-lex/60 bg-lex/10 text-lex' : 'border-line text-muted'
                  }`}
                >
                  {tech}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </li>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState([])
  const [seniority, setSeniority] = useState('')
  const [maxYears, setMaxYears] = useState('')
  const [minSalary, setMinSalary] = useState('')
  const [profile, setProfile] = useState(null)
  const [meta, setMeta] = useState(null)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setError('The search API is not answering. Start it with: jobber serve'))
  }, [])

  async function run(text = query) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          profile_text: profile?.text ?? '',
          filters: {
            remote_policy: remote,
            seniority: seniority ? [seniority] : [],
            max_years: maxYears === '' ? null : Number(maxYears),
            min_salary: minSalary === '' ? null : Number(minSalary),
          },
        }),
      })
      if (!response.ok) throw new Error(`search failed: ${response.status}`)
      setData(await response.json())
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  async function pdfText(file) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent()
      pages.push(content.items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join(''))
    }
    return pages.join('\n\n').trim()
  }

  async function readProfile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const text = isPdf ? await pdfText(file) : await file.text()
      if (!text) throw new Error(`${file.name} has no extractable text — a scanned CV needs OCR, not a parser.`)
      setProfile({ name: file.name, text })
    } catch (failure) {
      setProfile(null)
      setError(failure.message)
    }
  }

  const toggleRemote = (value) =>
    setRemote((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    )

  const terms = data ? data.terms.flatMap(split) : []

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4">
          <span className="font-mono text-sm font-semibold tracking-tight">
            jobber<span className="text-lex">.</span>it
          </span>
          <Label>
            {meta
              ? `${meta.corpus_size} postings · ${meta.sources.length} boards · ${meta.retrieval} retrieval`
              : 'connecting'}
          </Label>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <div className="pt-14 pb-10">
          <h1 className="max-w-2xl font-mono text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Ranked postings, and why each one ranked.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Search the normalized corpus by free text, or attach a CV to search by profile.
            Hard constraints run as metadata filters — they are never embedded.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            run()
          }}
        >
          <label htmlFor="q" className="sr-only">Query</label>
          <div className="flex items-center gap-3 border-b-2 border-edge py-3 transition-colors focus-within:border-lex">
            <span aria-hidden="true" className="font-mono text-lg text-lex">›</span>
            <input
              id="q"
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="node.js kafka kubernetes"
              className="min-w-0 flex-1 bg-transparent font-mono text-lg outline-none placeholder:text-muted/50 sm:text-xl"
            />
            <button
              type="submit"
              disabled={busy || (!query.trim() && !profile)}
              className="shrink-0 bg-lex px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.14em]
                         text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {busy ? 'Searching' : 'Search'}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-2">
              <Label>Remote</Label>
              {REMOTE.map((value) => (
                <Toggle key={value} on={remote.includes(value)} onClick={() => toggleRemote(value)}>
                  {value}
                </Toggle>
              ))}
            </div>

            <label className="flex items-center gap-2">
              <Label>Seniority</Label>
              <select
                value={seniority}
                onChange={(event) => setSeniority(event.target.value)}
                className="border border-line bg-transparent px-2 py-1 font-mono text-xs text-paper
                           hover:border-edge focus:border-lex focus:outline-none"
              >
                <option value="">any</option>
                {SENIORITY.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <Number_ label="max yrs" value={maxYears} onChange={setMaxYears} placeholder="any" />
            <Number_ label="min $" value={minSalary} onChange={setMinSalary} placeholder="any" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Label>Profile</Label>
            <label className="cursor-pointer border border-dashed border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-edge hover:text-paper">
              <input type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" onChange={readProfile} className="sr-only" />
              {profile ? `${profile.name} · ${profile.text.length} chars` : 'Attach a CV (.pdf, .txt, .md)'}
            </label>
            {profile && (
              <button
                type="button"
                onClick={() => setProfile(null)}
                className="font-mono text-xs text-muted underline underline-offset-4 hover:text-paper"
              >
                Remove
              </button>
            )}
            <span className="font-mono text-[11px] text-muted">
              read in your browser · stage 3 compresses it into a requirements block before search
            </span>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-8 border border-lex/50 bg-lex/5 px-4 py-3 font-mono text-xs text-lex">
            {error}
          </p>
        )}

        {data && <Trace data={data} busy={busy} />}

        <div aria-live="polite">
          {data && data.results.length > 0 && (
            <ol className="mt-4 border-t border-line">
              {data.results.map((result, rank) => (
                <Result key={result.id} result={result} rank={rank} tokens={terms} />
              ))}
            </ol>
          )}

          {data && data.results.length === 0 && (
            <p className="mt-10 font-mono text-sm text-muted">
              Nothing cleared the filters. Drop a constraint, or search fewer terms.
            </p>
          )}

          {!data && !error && (
            <section className="mt-16">
              <Label>Try</Label>
              <ul className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(example)
                        run(example)
                      }}
                      className="border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-lex hover:text-lex"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-4xl px-6 py-5 font-mono text-[11px] leading-relaxed text-muted">
          Every result links to the posting on its original board. A query or profile runs the full
          retrieve → rerank → respond pipeline over the live Pinecone index; leave both blank
          and this lists the filtered corpus off disk instead, since there's nothing to embed.
        </p>
      </footer>
    </div>
  )
}
