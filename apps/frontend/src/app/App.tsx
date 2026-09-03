import { AppShell } from '@/ui/shell/AppShell'
import { SearchPage } from '@/features/search/SearchPage'

export default function App() {
  return (
    <AppShell homeHref="#/" navigation={[]} footerGroups={[]}>
      <SearchPage />
    </AppShell>
  )
}
