import type { PostedWithin, Seniority, Workplace } from '@/routing/jobs-model'

export const WORKPLACE_LABELS: Record<Workplace, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
}

export const POSTED_LABELS: Record<PostedWithin, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}
