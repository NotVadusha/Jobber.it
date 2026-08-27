"""Scrape targets — what `sources.toml` used to hold. Keys match
`jobber.sources.REGISTRY`; `delay` is seconds between requests for that source
and is popped by `scrape()` rather than passed to the parser.

The per-company ATS board lists are not here: they live in `boards.json`, since
they are data that grows by probing rather than config anyone hand-edits. See
`boards.py` for how a slug gets on that list.
"""

from __future__ import annotations

from .boards import known

BOARDS = known()

OPTIONS: dict[str, dict] = {
    "greenhouse": {"delay": 0.5, "companies": BOARDS["greenhouse"]},
    "lever": {"delay": 0.5, "companies": BOARDS["lever"]},
    "ashby": {"delay": 0.5, "companies": BOARDS["ashby"]},
    # Single aggregator feed, no per-company config.
    "jobico": {"delay": 1.0},
    "dou": {
        "delay": 1.5,
        "categories": ["Python", "Node.js", "JavaScript", "Golang", "Java",
                       "Data Engineer", "DevOps"],
    },
    "djinni": {
        "delay": 1.5,
        "max_pages": 5,  # 15 postings per page
        "keywords": ["Python", "Node.js", "JavaScript", "Golang", "Java",
                     "Data Engineer", "DevOps"],
    },
    "linkedin": {
        "actor": "curious_coder~linkedin-jobs-scraper",
        "date_posted": "past24Hours",
        "limit_per_source": 500,  # per URL, and the cap on what a run can charge for
        "scrape_company": False,  # extra request per job for detail nothing indexes
        "urls": ["https://www.linkedin.com/jobs/search/?geoId=91000000&location=Europe"],
    },
}
