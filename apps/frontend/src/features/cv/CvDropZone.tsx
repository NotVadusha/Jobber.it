import { useEffect, useId, useRef, useState, type DragEvent, type ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { useCvConsent } from '@/features/cv/cv-consent'
import { providerLabel } from '@/features/cv/provider-labels'
import {
  PROFILE_ACCEPT,
  ProfileReadError,
  readProfile,
  type ProfileDocument,
} from '@/features/cv/read-profile'

const CONTROL_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const disclosureFacts = (provider: string | null): readonly string[] => {
  const named = provider ?? 'a third-party language-model provider'
  return [
    'The file is read in this browser. The file itself is never uploaded.',
    'Only the text extracted from it is sent, inside the search request.',
    `That text is sent to ${named} to be rewritten into a retrieval query.`,
    'Only the rewritten query is used to search the posting index. The CV text is not sent to the index.',
    `Jobber stores neither the file nor its text. What ${named} does with it is governed by their policy, not Jobber's.`,
    'CV text, the filename, and a CV-only search are never put into a shareable link.',
    "This choice is remembered in this browser and is cleared with the site's data.",
  ]
}

const Facts = ({ provider }: { provider: string | null }): ReactElement => {
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-tertiary">
      {disclosureFacts(provider).map((fact) => (
        <li key={fact} className="flex gap-2">
          <span aria-hidden="true">·</span>
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  )
}

export const CvDropZone = ({
  profile,
  onProfileChange,
  onReadError,
}: {
  profile: ProfileDocument | null
  onProfileChange(document: ProfileDocument | null): void
  onReadError(error: ProfileReadError | null): void
}): ReactElement => {
  const { granted, grant } = useCvConsent()
  const meta = useCorpusMetaQuery()
  const provider = providerLabel(meta.data?.data.rewriteProvider)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState<string | null>(null)
  const statusId = useId()

  useEffect(() => {
    if (!granted) return
    const block = (event: Event): void => {
      event.preventDefault()
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [granted])

  const accept = async (file: File | null | undefined): Promise<void> => {
    if (!file) return
    setReading(file.name)
    try {
      const document = await readProfile(file)
      onReadError(null)
      onProfileChange(document)
    } catch (failure) {
      onReadError(
        failure instanceof ProfileReadError
          ? failure
          : new ProfileReadError('READ_FAILED', `Could not read ${file.name}.`),
      )
    } finally {
      setReading(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    void accept(event.dataTransfer.files[0])
  }

  if (!granted) {
    return (
      <section
        aria-label="CV search"
        className="rounded-md border border-subtle bg-surface-raised p-4 sm:p-5"
      >
        <h3
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary"
        >
          Search with your CV
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-tertiary">
          A CV is optional. Search works from a typed query alone. If you attach one, this is
          exactly what happens to it.
        </p>
        <Facts provider={provider} />
        <button
          type="button"
          onClick={() => {
            grant()
            inputRef.current?.click()
          }}
          className={`mt-4 ${CONTROL_CLASS}`}
        >
          I understand — choose a file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={PROFILE_ACCEPT}
          onChange={(event) => void accept(event.currentTarget.files?.[0])}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </section>
    )
  }

  if (profile) {
    return (
      <section aria-label="CV search" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-subtle bg-surface px-4 py-3">
        <span className="min-w-0 truncate font-mono text-xs text-primary">{profile.name}</span>
        <span aria-hidden="true" className="text-tertiary">·</span>
        <span className="font-mono text-[11px] text-tertiary">
          {`${profile.bytes.toLocaleString()} bytes · ${profile.text.length.toLocaleString()} characters`}
        </span>
        <button
          type="button"
          onClick={() => {
            onReadError(null)
            onProfileChange(null)
          }}
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-secondary underline underline-offset-4 hover:text-primary"
        >
          Remove
          <span className="sr-only">{` ${profile.name}`}</span>
        </button>
      </section>
    )
  }

  return (
    <section aria-label="CV search" className="flex flex-col gap-2">
      <div
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={onDrop}
        aria-busy={reading !== null}
        className={`rounded-md border border-dashed p-4 text-center transition-colors motion-reduce:transition-none ${
          dragging ? 'border-accent bg-accent-soft' : 'border-subtle bg-surface'
        }`}
      >
        <label className="cursor-pointer font-mono text-xs text-secondary">
          <input
            ref={inputRef}
            type="file"
            accept={PROFILE_ACCEPT}
            onChange={(event) => void accept(event.currentTarget.files?.[0])}
            className="sr-only"
          />
          {dragging ? 'Release to attach' : 'Drop a CV here, or choose a file'}
        </label>
        <p className="mt-1 font-mono text-[11px] text-tertiary">
          PDF, TXT, or Markdown · up to 5 MB and 50,000 extracted characters
        </p>
        {reading && (
          <p id={statusId} role="status" className="mt-2 font-mono text-[11px] text-tertiary">
            {`Reading ${reading}…`}
          </p>
        )}
      </div>

      <details className="rounded-sm border border-subtle bg-surface-raised px-3 py-2">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
          What happens to this file
        </summary>
        <Facts provider={provider} />
      </details>
    </section>
  )
}
