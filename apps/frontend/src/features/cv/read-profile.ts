export const PROFILE_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_MAX_CHARS = 50_000
export const PROFILE_EXTENSIONS = ['.pdf', '.txt', '.md'] as const
export const PROFILE_ACCEPT = '.pdf,.txt,.md'

export type ProfileDocument = {
  name: string
  bytes: number
  text: string
}

export type ProfileReadCode =
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_PROFILE'
  | 'TEXT_TOO_LONG'
  | 'READ_FAILED'

export class ProfileReadError extends Error {
  readonly code: ProfileReadCode

  constructor(code: ProfileReadCode, message: string) {
    super(message)
    this.name = 'ProfileReadError'
    this.code = code
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}

const hasAllowedExtension = (name: string): boolean => {
  const lowered = name.toLowerCase()
  return PROFILE_EXTENSIONS.some((extension) => lowered.endsWith(extension))
}

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default

  const pdf = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
  }).promise

  const pages: string[] = []
  let length = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
      .map((item) => item.str + (item.hasEOL ? '\n' : ''))
      .join('')
    pages.push(text)
    length += text.length
    if (length > PROFILE_MAX_CHARS) break
  }

  return pages.join('\n\n').trim()
}

export const readProfile = async (file: File): Promise<ProfileDocument> => {
  if (!hasAllowedExtension(file.name)) {
    throw new ProfileReadError(
      'UNSUPPORTED_TYPE',
      `Jobber reads PDF, TXT, and Markdown files. ${file.name} is not one of those.`,
    )
  }

  if (file.size > PROFILE_MAX_BYTES) {
    throw new ProfileReadError(
      'FILE_TOO_LARGE',
      `${file.name} is ${formatBytes(file.size)}. The limit is 5 MB.`,
    )
  }

  const isPdf = file.name.toLowerCase().endsWith('.pdf')

  let text: string
  try {
    text = (isPdf ? await extractPdfText(file) : await file.text()).trim()
  } catch {
    throw new ProfileReadError('READ_FAILED', `Could not read ${file.name}.`)
  }

  if (!text) {
    throw new ProfileReadError(
      'EMPTY_PROFILE',
      `${file.name} has no extractable text — a scanned CV needs OCR, not a parser.`,
    )
  }

  if (text.length > PROFILE_MAX_CHARS) {
    throw new ProfileReadError(
      'TEXT_TOO_LONG',
      `${file.name} extracted ${text.length.toLocaleString()} characters. The limit is 50,000.`,
    )
  }

  return { name: file.name, bytes: file.size, text }
}
