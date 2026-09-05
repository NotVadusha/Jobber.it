import { useState } from 'react'

import { ApiError } from '@/api/client'
import { ProfileReadError, readProfile, type ProfileDocument } from '@/features/cv/read-profile'
import { useToast } from '@/ui/toast'

export function useSearchProfile(onError: (error: ApiError | null) => void) {
  const [profile, setProfile] = useState<ProfileDocument | null>(null)
  const { showToast } = useToast()

  async function selectProfile(file: File | null): Promise<void> {
    if (!file) return

    try {
      setProfile(await readProfile(file))
      onError(null)
    } catch (failure) {
      setProfile(null)
      onError(new ApiError({
        status: 0,
        code: failure instanceof ProfileReadError ? failure.code : 'READ_FAILED',
        message: failure instanceof Error ? failure.message : 'Could not read the selected file.',
      }))
    }
  }

  function removeProfile(): void {
    setProfile(null)
    showToast({ message: 'Profile removed', tone: 'info' })
  }

  return { profile, selectProfile, removeProfile }
}
