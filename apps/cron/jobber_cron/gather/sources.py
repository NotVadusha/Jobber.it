from __future__ import annotations

from .boards import known

BOARDS = known()

OPTIONS: dict[str, dict] = {
    "greenhouse": {"delay": 0.5, "companies": BOARDS["greenhouse"]},
    "lever": {"delay": 0.5, "companies": BOARDS["lever"]},
    "ashby": {"delay": 0.5, "companies": BOARDS["ashby"]},
    "jobico": {"delay": 1.0},
    "dou": {
        "delay": 1.5,
        "categories": ["Python", "Node.js", "JavaScript", "Golang", "Java",
                       "Data Engineer", "DevOps"],
    },
    "djinni": {
        "delay": 1.5,
        "max_pages": 5,
        "keywords": ["Python", "Node.js", "JavaScript", "Golang", "Java",
                     "Data Engineer", "DevOps"],
    },
    "linkedin": {
        "actor": "curious_coder~linkedin-jobs-scraper",
        "date_posted": "past24Hours",
        "limit_per_source": 500,
        "scrape_company": False,
        "urls": ["https://www.linkedin.com/jobs/search/?geoId=91000000&location=Europe"],
    },
}
