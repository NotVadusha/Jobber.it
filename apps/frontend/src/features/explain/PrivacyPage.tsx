import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { providerLabel } from '@/features/cv/provider-labels'
import {
  PROFILE_EXTENSIONS,
  PROFILE_MAX_BYTES,
  PROFILE_MAX_CHARS,
} from '@/features/cv/read-profile'
import { RELEASES_URL } from '@/features/explain/project'
import { DEVICE_STORAGE } from '@/lib/storage-keys'
import { Prose } from '@/ui/Prose'
import { ProseSection } from '@/ui/ProseSection'

const FORMATS = PROFILE_EXTENSIONS.map((extension) =>
  extension.replace('.', '').toUpperCase(),
).join(', ')
const MAX_MB = PROFILE_MAX_BYTES / (1024 * 1024)

export function PrivacyPage(): ReactElement {
  const meta = useCorpusMetaQuery()
  const provider = providerLabel(meta.data?.data.rewriteProvider)
  const named = provider ?? 'a third-party language-model provider'

  return (
    <Prose
      title="CV parsing and privacy"
      lead="Jobber aggregates public job postings and links to the original source. It hosts no postings, has no accounts, and asks for nothing about you. This page says exactly what it stores, what it sends, and where."
    >
      <ProseSection title="What Jobber does not do">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>No accounts, sign-in, or profile.</li>
          <li>No analytics, no tracking cookies, no advertising, and no third-party scripts.</li>
          <li>No third-party fonts. Typefaces are served from this site.</li>
          <li>No email address, name, or contact detail is collected anywhere.</li>
        </ul>
      </ProseSection>

      <ProseSection title="What is stored on your device">
        <p>
          Everything below lives in this browser only. Nothing is synchronised, and clearing this
          site’s data removes all of it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
            <caption className="sr-only">Values Jobber stores in this browser</caption>
            <thead>
              <tr className="border-b border-subtle text-tertiary">
                <th scope="col" className="py-2 pr-4 font-mono font-semibold uppercase tracking-[0.08em]">Key</th>
                <th scope="col" className="py-2 pr-4 font-mono font-semibold uppercase tracking-[0.08em]">Holds</th>
                <th scope="col" className="py-2 font-mono font-semibold uppercase tracking-[0.08em]">Written</th>
              </tr>
            </thead>
            <tbody>
              {DEVICE_STORAGE.map((entry) => (
                <tr key={entry.key} className="border-b border-subtle align-top">
                  <th scope="row" className="py-2 pr-4 font-mono font-normal text-secondary">{entry.key}</th>
                  <td className="py-2 pr-4 text-tertiary">{entry.holds}</td>
                  <td className="py-2 text-tertiary">{entry.written}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-tertiary">
          None of these holds a search query, CV text, a filename, a result, a ranking, or anything
          identifying you.
        </p>
      </ProseSection>

      <ProseSection title="What happens to a CV">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>{`Accepted formats are ${FORMATS}, up to ${MAX_MB} MB and ${PROFILE_MAX_CHARS.toLocaleString()} extracted characters.`}</li>
          <li>The file is read in your browser. The file itself is never uploaded.</li>
          <li>Only the text extracted from it is sent, inside the search request body.</li>
          <li>{`That text is sent to ${named} to be rewritten into a retrieval query.`}</li>
          <li>Only the rewritten query searches the posting index. Your CV text is not sent to the index.</li>
          <li>{`Jobber stores neither the file nor its text, and writes neither to a log. What ${named} does with it is governed by their policy, not Jobber's.`}</li>
          <li>Your consent is recorded in this browser so the disclosure is not repeated. Nothing about the file is recorded with it.</li>
        </ul>
      </ProseSection>

      <ProseSection title="What the server records">
        <p>
          Each request writes one structured log line containing the route pattern, the method, the
          response status, an anonymous request identifier, and how long it took. The route pattern
          is recorded rather than the address, so which posting you opened is not in the log.
        </p>
        <p>
          No search query, CV text, rewritten query, or posting identifier is written to a log line,
          returned in an error, or stored on the server.
        </p>
      </ProseSection>

      <ProseSection title="Rate limiting">
        <p>
          Semantic search is limited per client so one visitor cannot exhaust the search budget. The
          limiter identifies a client by hashing their network address with a random value generated
          when the server starts, then keeps only that hash in memory. No address is stored, logged,
          or returned, the hash cannot be reversed to an address, and every record disappears when
          the process restarts.
        </p>
        <p>Browsing all postings is not limited.</p>
      </ProseSection>

      <ProseSection title="Requests to other services">
        <p>
          The{' '}
          <a className="text-accent underline underline-offset-4" href="#/changelog">
            Changelog
          </a>{' '}
          page reads the release notes published for this project directly from GitHub’s public API,
          so opening that page means GitHub sees your address, exactly as visiting{' '}
          <a
            className="text-accent underline underline-offset-4"
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            the releases page
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          would. No other page in Jobber contacts a third party.
        </p>
      </ProseSection>

      <ProseSection title="Links you share">
        <p>
          A link to a search carries your typed query, your filters, and which page you were on. It
          never carries CV text, a filename, or anything derived from a CV. A search that used only a
          CV has nothing shareable, and Jobber says so rather than producing a link that quietly
          drops it.
        </p>
      </ProseSection>
    </Prose>
  )
}
