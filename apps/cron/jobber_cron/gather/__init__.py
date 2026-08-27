"""The gather chain: scrape -> normalize -> index. Each step is its own module
and only ever adds; prune is the removing half (see apps/cron/README.md)."""
