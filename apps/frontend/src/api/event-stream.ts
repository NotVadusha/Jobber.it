export type EventStreamFrame = {
  name: string | null
  data: string
}

type PendingEvent = {
  name: string | null
  data: string[]
}

const applyField = (event: PendingEvent, line: string): void => {
  if (line.startsWith(':')) return

  const separator = line.indexOf(':')
  const field = separator === -1 ? line : line.slice(0, separator)
  const value = separator === -1
    ? ''
    : line.slice(line[separator + 1] === ' ' ? separator + 2 : separator + 1)

  if (field === 'event') event.name = value
  else if (field === 'data') event.data.push(value)
}

export async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<EventStreamFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  // A CR ends its line immediately, so a LF that follows it — possibly only in
  // the next chunk — belongs to that same ending and must not open a new line.
  let skipLineFeed = false
  let event: PendingEvent = { name: null, data: [] }

  const takeLines = (): string[] => {
    const lines: string[] = []
    let start = 0

    for (let index = 0; index < buffer.length; index += 1) {
      const character = buffer[index]

      if (skipLineFeed) {
        skipLineFeed = false
        if (character === '\n') {
          start = index + 1
          continue
        }
      }

      if (character === '\n') {
        lines.push(buffer.slice(start, index))
        start = index + 1
      } else if (character === '\r') {
        lines.push(buffer.slice(start, index))
        start = index + 1
        skipLineFeed = true
      }
    }

    buffer = buffer.slice(start)
    return lines
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      for (const line of takeLines()) {
        if (line !== '') {
          applyField(event, line)
          continue
        }
        if (event.data.length > 0) {
          yield { name: event.name, data: event.data.join('\n') }
        }
        event = { name: null, data: [] }
      }
    }
    // An event still open at end of stream is incomplete, and the SSE parsing
    // rules discard it rather than dispatching a truncated frame.
  } finally {
    reader.releaseLock()
  }
}
