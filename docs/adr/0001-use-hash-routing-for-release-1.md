# Use hash routing for Release 1

Release 1 needs shareable searches and job pages, but it does not need SEO or server rendering. The SPA will own routes below the URL hash. This keeps browser back and forward behavior without requiring Caddy fallback or API routing changes.
