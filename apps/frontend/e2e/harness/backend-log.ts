// Playwright's webServer entries pipe backend stdout/stderr into this
// process's own std streams (visible as "[WebServer] ..." lines). Spec files
// run in separate worker processes and cannot read those streams directly,
// so this globalSetup taps them here — in the one process that sees them —
// and tees every chunk into a plain file specs can poll.
import { appendFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const BACKEND_LOG_PATH = fileURLToPath(
  new URL('../.backend-log.ndjson', import.meta.url),
)

const tee = (stream: NodeJS.WriteStream): void => {
  const original = stream.write.bind(stream)
  stream.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    appendFileSync(BACKEND_LOG_PATH, chunk)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original as any)(chunk, ...rest)
  }) as typeof stream.write
}

const globalSetup = (): void => {
  writeFileSync(BACKEND_LOG_PATH, '')
  tee(process.stdout)
  tee(process.stderr)
}

export default globalSetup
