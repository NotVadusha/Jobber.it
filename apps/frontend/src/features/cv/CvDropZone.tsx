import { useEffect, useId, useRef, useState, type DragEvent, type ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { useCvConsent } from '@/features/cv/cv-consent'
import { CvDisclosureFacts } from '@/features/cv/CvDisclosureFacts'
import { providerLabel } from '@/features/cv/provider-labels'
import {
  PROFILE_ACCEPT,
  ProfileReadError,
  readProfile,
  type ProfileDocument,
} from '@/features/cv/read-profile'

const CONTROL_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

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
  const { data: meta } = useCorpusMetaQuery()
  const provider = providerLabel(meta?.data.rewriteProvider)
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
        <CvDisclosureFacts provider={provider} />
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
        <CvDisclosureFacts provider={provider} />
      </details>
    </section>
  )
}
