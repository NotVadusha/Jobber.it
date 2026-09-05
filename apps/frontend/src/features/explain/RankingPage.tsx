import type { ReactElement } from 'react'

import type { components } from '@/api/schema'
import { Prose } from '@/ui/Prose'
import { ProseSection } from '@/ui/ProseSection'

type RankingStage = components['schemas']['RankingStage']

type StageCopy = {
  title: string
  what: string
  caveat: string
}

const STAGES: Record<RankingStage, StageCopy> = {
  rewrite: {
    title: 'Rewrite',
    what: 'Your goal and, if you attached one, your CV are turned into a compact requirements statement and a list of technology terms. They are sent as two labelled inputs, so a stated goal is not drowned out by a long history.',
    caveat: 'If this step is unavailable the search still runs, using your text as written. The trace says when that happened.',
  },
  filter: {
    title: 'Filter',
    what: 'Your hard constraints are turned into conditions. Some can be pushed into the index and are applied during retrieval; the rest are applied to what comes back.',
    caveat: 'A constraint is a constraint, not a preference. A posting that fails one is absent from the results, never shown lower down.',
  },
  retrieve: {
    title: 'Retrieve',
    what: 'A fixed pool of candidate chunks is retrieved from the index, combining dense and sparse matching. A posting is stored as several chunks, so one posting can contribute more than one candidate.',
    caveat: 'This is the step that decides what can possibly be ranked. Nothing outside the pool can appear in your results.',
  },
  group: {
    title: 'Group',
    what: 'Candidate chunks are grouped by posting, and each posting is looked up in the database so the result carries current, complete details rather than whatever was indexed.',
    caveat: 'Postings that are no longer listed are dropped here.',
  },
  rerank: {
    title: 'Rerank',
    what: 'One document is built per posting from its requirements, responsibilities, and description, and the whole set is scored once by a reranking model. The order you see is that score, descending.',
    caveat: 'Each posting is scored once, as a whole. It does not compete against itself chunk by chunk.',
  },
}

const STAGE_ORDER = Object.keys(STAGES) as readonly RankingStage[]

export function RankingPage(): ReactElement {
  return (
    <Prose
      title="How ranking works"
      lead="Jobber has two ways to find postings. All postings is an exhaustive text and filter search over everything it holds. Best matches is a retrieval pipeline that scores postings against what you are looking for. This page explains the second one, and what its numbers do and do not mean."
    >
      <ProseSection title="The pipeline">
        <p>Every Best-match search runs these steps, in this order.</p>
        <ol className="flex flex-col gap-4">
          {STAGE_ORDER.map((stage, index) => (
            <li key={stage} className="flex gap-3">
              <span className="pt-0.5 font-mono text-xs tabular-nums text-tertiary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {STAGES[stage].title}
                </h3>
                <p className="mt-1">{STAGES[stage].what}</p>
                <p className="mt-1 text-tertiary">{STAGES[stage].caveat}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-tertiary">
          How large the candidate pool is and how many postings are kept are tuning parameters that
          change as the product is measured. Rather than print numbers here that would go stale, the
          retrieval trace shown with every Best-match search reports the real counts and durations
          for that search.
        </p>
      </ProseSection>

      <ProseSection title="What “% match” is">
        <p className="rounded-md border border-strong bg-surface-raised p-4 text-primary">
          The percentage on a result is the reranking model’s raw score for that posting, multiplied
          by one hundred. It is not calibrated. It is not a probability. It is not a prediction that
          you will be interviewed or hired, and it is not a guarantee of anything. Two searches
          produce two different sets of scores, so a 72 in one search and a 72 in another are not
          comparable.
        </p>
        <p>
          It is useful for one thing: comparing postings inside a single search, in the order they
          are already shown. Treat it as the model’s relative confidence, and read the posting.
        </p>
      </ProseSection>

      <ProseSection title="What “Why this ranked” shows">
        <p>
          Where a result carries an explanation, it contains only two kinds of fact: terms that
          literally occur in the text Jobber holds for that posting, and the sections whose chunks
          were actually retrieved for it.
        </p>
        <p>
          It deliberately contains no weights, no per-term contributions, and no written reasoning. A
          reranking model does not expose why it scored a document the way it did, and inventing a
          plausible explanation would be worse than showing none.
        </p>
      </ProseSection>

      <ProseSection title="All postings is different">
        <p>
          All postings is a text and filter search straight over the database. It matches words, not
          meaning; it never reorders by relevance; and it can reach every live posting Jobber holds,
          not only what a retrieval step surfaced. When Best matches has nothing left to show, this
          is the exhaustive fallback.
        </p>
      </ProseSection>

      <ProseSection title="Known limitations">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>The score is uncalibrated, and this page will keep saying so until it is not.</li>
          <li>Only postings Jobber has scraped and indexed can be ranked. Coverage is not complete.</li>
          <li>A posting can be filled or withdrawn before Jobber notices. The source is authoritative.</li>
          <li>Structured fields such as seniority and salary come from automated extraction and can be wrong.</li>
          <li>Ranking quality depends on what you write. A goal of two words gives the pipeline two words to work with.</li>
        </ul>
      </ProseSection>
    </Prose>
  )
}
