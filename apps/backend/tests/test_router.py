from jobber import router


def test_clauses():
    clauses, applied = router.clauses(router.Filters(remote_policy=["remote"], max_years=3))
    assert clauses == [{"remote_policy": {"$in": ["remote"]}}, {"years_required": {"$lte": 3}}]
    assert [a["field"] for a in applied] == ["remote_policy", "max_years"]


def test_min_salary_keeps_postings_without_a_stated_salary(monkeypatch):
    hits = [{"posting_id": "a", "salary_max": None},
            {"posting_id": "b", "salary_max": 80_000},
            {"posting_id": "c", "salary_max": 120_000}]
    monkeypatch.setattr(router.profile_mod, "to_query",
                        lambda text: router.profile_mod.Query(requirements_text=text, stack=[]))
    monkeypatch.setattr(router.pipeline_mod, "run", lambda q, f: ([], hits))
    monkeypatch.setattr(router.index_mod, "combine", lambda clauses: None)
    monkeypatch.setattr(router, "stats", lambda: (0, []))

    body = router.search(router.Search(query="python",
                                       filters=router.Filters(min_salary=100_000)))
    assert [r["id"] for r in body["results"]] == ["a", "c"]
