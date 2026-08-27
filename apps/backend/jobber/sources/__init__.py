"""Source parsers, one module each. `REGISTRY[name](fetch, **opts)` yields
RawPostings; the keys are also what `jobber_cron.gather.sources.OPTIONS` is
keyed by."""

from .base import RawPosting, html_to_text, role, _iso
from .ashby import ashby
from .djinni import djinni
from .dou import dou
from .greenhouse import greenhouse
from .jobico import jobico
from .lever import lever
from .linkedin import linkedin

REGISTRY = {
    "greenhouse": greenhouse,
    "lever": lever,
    "ashby": ashby,
    "jobico": jobico,
    "dou": dou,
    "djinni": djinni,
    "linkedin": linkedin,
}

__all__ = ["REGISTRY", "RawPosting", "html_to_text", "role", "_iso"]
