"""OPTIONS is passed straight into the parsers as **kwargs, so a key the parser
does not accept is a TypeError at 3am. As toml this was unverifiable; as code it
is a signature check."""

import inspect

import pytest
from jobber.sources import REGISTRY

from jobber_cron.gather.sources import OPTIONS


@pytest.mark.parametrize("name", sorted(OPTIONS))
def test_every_entry_matches_its_parser(name):
    assert name in REGISTRY, f"{name} is not a source"
    opts = {k: v for k, v in OPTIONS[name].items() if k != "delay"}  # scrape pops delay
    # bind_partial, not bind: the parser supplies its own defaults for the rest.
    inspect.signature(REGISTRY[name]).bind_partial(fetch=None, **opts)
