import axios from 'axios'

import type { KeysToCamelCase } from '@/api/camelize-response'
import { camelizeResponse } from '@/api/camelize-response'
import type { components } from '@/api/schema'

type WireErrorResponse = components['schemas']['ErrorResponse']

export type ErrorResponse = KeysToCamelCase<WireErrorResponse>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isRecord(value) || !isRecord(value.error) || !isRecord(value.meta)) {
    return false
  }

  return (
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string' &&
    typeof value.meta.requestId === 'string'
  )
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null
  readonly details: unknown

  constructor({ status, code, message, requestId, details }: {
    status: number
    code: string
    message: string
    requestId?: string | null
    details?: unknown
  }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId ?? null
    this.details = details ?? null
  }
}

export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

export function apiErrorFrom({ status, payload, requestIdHeader }: {
  status: number
  payload: unknown
  requestIdHeader?: string | null
}): ApiError {
  const camelized = camelizeResponse(payload)
  if (isErrorResponse(camelized)) {
    return new ApiError({
      status,
      code: camelized.error.code,
      message: camelized.error.message,
      requestId: camelized.meta.requestId,
      details: camelized.error.details,
    })
  }

  return new ApiError({
    status,
    code: status ? 'MALFORMED_ERROR_RESPONSE' : 'NETWORK_ERROR',
    message: status
      ? 'The server returned an unreadable error.'
      : 'The server could not be reached.',
    requestId: requestIdHeader ?? null,
  })
}

api.interceptors.response.use(
  (response) => {
    response.data = camelizeResponse(response.data)
    return response
  },
  (error: unknown) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const headerRequestId = error.response?.headers['x-request-id']
    return Promise.reject(apiErrorFrom({
      status: error.response?.status ?? 0,
      payload: error.response?.data,
      requestIdHeader: typeof headerRequestId === 'string' ? headerRequestId : null,
    }))
  },
)
