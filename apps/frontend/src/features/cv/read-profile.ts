export type ProfileDocument = {
  name: string
  text: string
}

export class ProfileReadError extends Error {
  readonly code: 'EMPTY_PROFILE' | 'READ_FAILED'

  constructor(code: ProfileReadError['code'], message: string) {
    super(message)
    this.name = 'ProfileReadError'
    this.code = code
  }
}

type PdfExtractor = (file: File) => Promise<string>

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
        .map((item) => item.str + (item.hasEOL ? '\n' : ''))
        .join(''),
    )
  }

  return pages.join('\n\n').trim()
}

export async function readProfile(
  file: File,
  pdfExtractor: PdfExtractor = extractPdfText,
): Promise<ProfileDocument> {
  try {
    const lowerName = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf')
    const text = (isPdf ? await pdfExtractor(file) : await file.text()).trim()

    if (!text) {
      throw new ProfileReadError(
        'EMPTY_PROFILE',
        `${file.name} has no extractable text — a scanned CV needs OCR, not a parser.`,
      )
    }

    return { name: file.name, text }
  } catch (error) {
    if (error instanceof ProfileReadError) throw error
    throw new ProfileReadError('READ_FAILED', `Could not read ${file.name}.`)
  }
}
