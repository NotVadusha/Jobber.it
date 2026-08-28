import inspect

import pytest
from jobber.sources import REGISTRY

from jobber_cron.gather.sources import OPTIONS


@pytest.mark.parametrize("name", sorted(OPTIONS))
def test_every_entry_matches_its_parser(name):
    assert name in REGISTRY, f"{name} is not a source"
    opts = {k: v for k, v in OPTIONS[name].items() if k != "delay"}
    inspect.signature(REGISTRY[name]).bind_partial(fetch=None, **opts)
