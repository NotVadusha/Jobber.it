export type EventStreamFrame = {
  name: string | null
  data: string
}

const FRAME_TERMINATOR = '\n\n'

function parseFrame(block: string): EventStreamFrame | null {
  let name: string | null = null
  const data: string[] = []

  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line.startsWith(':')) continue

    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1
      ? ''
      : line.slice(line[separator + 1] === ' ' ? separator + 2 : separator + 1)

    if (field === 'event') name = value
    else if (field === 'data') data.push(value)
  }

  if (data.length === 0) return null
  return { name, data: data.join('\n') }
}

export async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<EventStreamFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let split = buffer.indexOf(FRAME_TERMINATOR)
      while (split !== -1) {
        const frame = parseFrame(buffer.slice(0, split))
        buffer = buffer.slice(split + FRAME_TERMINATOR.length)
        if (frame) yield frame
        split = buffer.indexOf(FRAME_TERMINATOR)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
