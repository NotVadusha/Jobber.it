export const REPO_URL = 'https://github.com/NotVadusha/Jobber.it'
export const RELEASES_URL = `${REPO_URL}/releases`
export const RELEASES_API =
  'https://api.github.com/repos/NotVadusha/Jobber.it/releases?per_page=20'

export type ProjectLink = {
  label: string
  href: `https://${string}`
}

export const CREATOR = {
  name: 'Vadym Bondarchuk',
  role: 'Full-stack software engineer, and AI engineer.',
  motivation:
    'This project is a personal struggle. I got laid off, and with everything going on in ' +
    'the job market, finding suitable positions — multiple positions — is genuinely hard. ' +
    'I built an agent to do it, but that was not efficient: I cannot run an agent 24/7 and ' +
    'I cannot host it. So I decided to build a platform that both people and AI agents can ' +
    'use, and that stops recommending Scala and Java roles to me as a Node, Go, and Python ' +
    'engineer — a common thing on LinkedIn. This is the pain I have, and I want to solve it ' +
    'with the skills I have gathered over my career.',
}

export const CREATOR_LINKS: readonly ProjectLink[] = [
  { label: 'Source on GitHub', href: REPO_URL },
  { label: 'GitHub profile', href: 'https://github.com/NotVadusha' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/vadym-bondarchuk-55311a381/' },
  { label: 'vadymbondarchuk.com', href: 'https://vadymbondarchuk.com' },
]
