# Domain vocabulary

These terms are canonical in plans, contracts, and code.

**Posting:** One normalized, aggregated job listing identified by the existing `source:source_id` posting ID.
_Avoid:_ vacancy record, opportunity record, job entity.

**Source:** A stable ingestion-adapter ID such as `greenhouse`, `ashby`, or `djinni`. It is not an individual employer board.
_Avoid:_ board when referring to the filter dimension.

**All postings:** The exhaustive PostgreSQL-backed catalogue of live postings satisfying the hard filters.
_Avoid:_ browse search, unranked search.

**Best matches:** A bounded, query/profile-based semantic ranking snapshot.
_Avoid:_ all results, semantic catalogue.

**Hard filter:** An explicit user-selected constraint applied independently of query/profile embedding.
_Avoid:_ search term, ranking preference.

**Profile text:** Text extracted locally from an attached CV and sent as background experience.
_Avoid:_ CV query, resume prompt.

**Ranking snapshot:** The ordered set of Best-match postings returned by one completed pipeline run and progressively revealed in the browser.
_Avoid:_ search cache when referring to browser-held results.

**Ranking context:** Session-only evidence connecting a Best-match result to the pipeline run that produced it.
_Avoid:_ posting score when referring to the complete context.

**Published date:** `posted_at` supplied by the source.

**Discovered date:** `first_seen_at`, used only when the source has no published date.
