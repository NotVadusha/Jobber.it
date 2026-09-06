import { describe, expect, it } from 'vitest'

import { readEventStream, type EventStreamFrame } from '@/api/event-stream'

const encoder = new TextEncoder()

const streamOf = (chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })

// controller.error() discards anything already queued, so the failure has to
// arrive on a later pull for the earlier chunks to reach the reader at all.
const streamFailingAfter = (
  chunks: Uint8Array[],
  error: Error,
): ReadableStream<Uint8Array> => {
  const pending = [...chunks]
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = pending.shift()
      if (next) controller.enqueue(next)
      else controller.error(error)
    },
  })
}

const collect = async (chunks: Uint8Array[]): Promise<EventStreamFrame[]> => {
  const frames: EventStreamFrame[] = []
  for await (const frame of readEventStream(streamOf(chunks))) frames.push(frame)
  return frames
}

const decode = (...text: string[]) => collect(text.map((part) => encoder.encode(part)))

const splitAt = (bytes: Uint8Array, index: number): Uint8Array[] => [
  bytes.slice(0, index),
  bytes.slice(index),
]

const STAGE = 'event: stage.completed\ndata: {"stage":"rewrite"}\n\n'
const FRAME: EventStreamFrame = { name: 'stage.completed', data: '{"stage":"rewrite"}' }

describe('readEventStream line endings', () => {
  it('decodes an LF delimited frame', async () => {
    expect(await decode(STAGE)).toEqual([FRAME])
  })

  it('decodes a CRLF delimited frame', async () => {
    expect(await decode(STAGE.replaceAll('\n', '\r\n'))).toEqual([FRAME])
  })

  it('decodes a CR delimited frame', async () => {
    expect(await decode(STAGE.replaceAll('\n', '\r'))).toEqual([FRAME])
  })

  it('decodes a frame with mixed endings', async () => {
    expect(
      await decode('event: stage.completed\r\ndata: {"stage":"rewrite"}\r\r'),
    ).toEqual([FRAME])
  })
})

describe('readEventStream chunk boundaries', () => {
  const crlf = encoder.encode(STAGE.replaceAll('\n', '\r\n'))

  it.each(Array.from({ length: crlf.length - 1 }, (_, index) => index + 1))(
    'decodes a CRLF frame split after byte %i',
    async (index) => {
      expect(await collect(splitAt(crlf, index))).toEqual([FRAME])
    },
  )

  it('decodes a frame delivered one byte at a time', async () => {
    const bytes = encoder.encode(STAGE)
    const single = Array.from(bytes, (byte) => new Uint8Array([byte]))

    expect(await collect(single)).toEqual([FRAME])
  })

  it('keeps a multibyte character split across chunks intact', async () => {
    const payload = 'event: stage.completed\ndata: {"detail":"Розробник — Київ"}\n\n'
    const bytes = encoder.encode(payload)
    const boundary = bytes.indexOf(encoder.encode('Р')[0]) + 1

    expect(await collect(splitAt(bytes, boundary))).toEqual([
      { name: 'stage.completed', data: '{"detail":"Розробник — Київ"}' },
    ])
  })
})

describe('readEventStream frame parsing', () => {
  it('yields every frame in a chunk carrying several', async () => {
    const frames = await decode(
      'event: search.started\ndata: 1\n\nevent: stage.started\ndata: 2\n\n',
    )

    expect(frames).toEqual([
      { name: 'search.started', data: '1' },
      { name: 'stage.started', data: '2' },
    ])
  })

  it('joins several data fields with newlines', async () => {
    expect(await decode('event: note\ndata: first\ndata: second\n\n')).toEqual([
      { name: 'note', data: 'first\nsecond' },
    ])
  })

  it('ignores comments and unsupported fields', async () => {
    expect(
      await decode(': keep-alive\nevent: note\nid: 7\nretry: 500\ndata: body\n\n'),
    ).toEqual([{ name: 'note', data: 'body' }])
  })

  it('keeps an empty data field as an empty payload', async () => {
    expect(await decode('event: note\ndata:\n\n')).toEqual([{ name: 'note', data: '' }])
  })

  it('drops an event that carries no data field', async () => {
    expect(await decode('event: note\nid: 7\n\n')).toEqual([])
  })

  it('reads a frame with no event name', async () => {
    expect(await decode('data: body\n\n')).toEqual([{ name: null, data: 'body' }])
  })

  it('discards an unterminated event at end of stream', async () => {
    expect(await decode('event: note\ndata: body\n')).toEqual([])
  })

  it('yields the frames decoded before a stream error', async () => {
    const frames: EventStreamFrame[] = []
    const stream = streamFailingAfter([encoder.encode(STAGE)], new Error('connection reset'))

    await expect(async () => {
      for await (const frame of readEventStream(stream)) frames.push(frame)
    }).rejects.toThrow('connection reset')
    expect(frames).toEqual([FRAME])
  })
})
