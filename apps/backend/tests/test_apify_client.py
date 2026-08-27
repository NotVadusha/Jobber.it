import pytest
from apify_client._models import Run

from jobber import apify as apify_client


class FakeDataset:
    def iterate_items(self):
        return iter([{"id": "1"}])


class FakeActor:
    def __init__(self, run):
        self._run = run

    def call(self, run_input=None):
        return self._run


class FakeClient:
    def __init__(self, run):
        self._run = run

    def actor(self, actor):
        return FakeActor(self._run)

    def dataset(self, dataset_id):
        assert dataset_id == "ds1"
        return FakeDataset()


def patch(monkeypatch, tmp_path, run):
    monkeypatch.setattr(apify_client.config, "get", lambda: type("C", (), {"apify_token": "t"})())
    monkeypatch.setattr(apify_client, "ApifyClient", lambda token: FakeClient(run))
    monkeypatch.setattr(apify_client, "CACHE_DIR", tmp_path)


def test_succeeded_run_yields_dataset_items(monkeypatch, tmp_path):
    run = Run.model_construct(id="r1", status="SUCCEEDED", default_dataset_id="ds1")
    patch(monkeypatch, tmp_path, run)
    assert apify_client.run_actor("a~b", {"urls": []}, cache=False) == [{"id": "1"}]


@pytest.mark.parametrize("run", [Run.model_construct(id="r1", status="ABORTED"), None])
def test_unfinished_run_raises(monkeypatch, tmp_path, run):
    patch(monkeypatch, tmp_path, run)
    with pytest.raises(RuntimeError, match="not SUCCEEDED"):
        apify_client.run_actor("a~b", {"urls": []}, cache=False)
