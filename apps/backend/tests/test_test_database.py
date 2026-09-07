from __future__ import annotations

import pytest

from tests.support.database import validated_url


@pytest.mark.parametrize("url", [
    "postgresql://localhost/jobber_test_e2e",
    "postgresql://localhost/jobber_test%5Fe2e",
    "postgresql://localhost/jobber_test_e2e?connect_timeout=2",
    "postgresql://localhost/postgres?dbname=jobber_test_e2e",
    "host=localhost dbname=jobber_test_e2e",
])
def test_test_database_connections_accept_the_effective_database_name(url):
    assert validated_url(url) == url


@pytest.mark.parametrize("url", [
    "", "   ", "not a connection string", "postgresql://localhost/%ZZ",
    "postgresql://localhost/postgres", "postgresql://localhost/",
    "postgresql://localhost/jobber_test_e2e?dbname=postgres",
])
def test_test_database_connections_reject_missing_invalid_or_unsafe_names(url):
    with pytest.raises(ValueError):
        validated_url(url)
