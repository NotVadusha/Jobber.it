import json

from jobber import db
from jobber_cron.gather.normalize import (Extracted, merge, snap, unannualize,
                                          verbatim_fidelity)

POSTING = {
    "id": "djinni:764691",
    "source": "djinni",
    "url": "https://djinni.co/jobs/764691-junior-python-software-engineer/",
    "title": "Junior Python Software Engineer",
    "company": "Keymakr",
    "description_text": "Keymakr is a leading provider of data annotation.\nRequirements: 2 years of Python.",
    "location_raw": "Countries of Europe or Ukraine",
    "posted_at": "2026-08-18T22:38:00+03:00",
    "extra": {"salary_text": "to $700", "meta_line": "Full Remote - 2 years of experience", "tags": []},
}

EXTRACTED = {
    "seniority": "junior",
    "years_required": 2,
    "remote_policy": "remote",
    "location": "Europe",
    "salary_min": None,
    "salary_max": 8400,
    "stack": ["Python"],
    "responsibilities_text": "Build internal tools.",
    "requirements_text": "2 years of Python.",
}


def test_schema_obeys_structured_output_limits():
    schema = Extracted.model_json_schema()
    blob = json.dumps(schema)
    for unsupported in ("minimum", "maximum", "minLength", "maxLength", "multipleOf"):
        assert unsupported not in blob, f"{unsupported} is not supported in structured outputs"
    assert schema["type"] == "object"
    assert set(schema["required"]) == set(Extracted.model_fields)
    assert schema["additionalProperties"] is False
    for sub in schema.get("$defs", {}).values():
        if sub.get("type") == "object":
            assert sub["additionalProperties"] is False


def test_merge_yields_exactly_the_postings_columns():
    record = merge(POSTING, EXTRACTED)
    assert tuple(record) == db.POSTING_FIELDS
    assert record["id"] == POSTING["id"]
    assert record["title"] == POSTING["title"]
    assert record["seniority"] == EXTRACTED["seniority"]
    assert record["salary_max"] == EXTRACTED["salary_max"]
    assert record["salary_min"] is None
    assert set(db.STAGE2) <= set(record)


def _record(resp, req, source="We build data pipelines. You will own the ETL layer. Requires 3 years of Python."):
    return {"description_text": source, "responsibilities_text": resp, "requirements_text": req}


def test_fidelity_scores_copied_spans_full():
    record = _record("You will own the ETL layer.", "Requires 3 years of Python.")
    assert verbatim_fidelity(record) == 1.0


def test_fidelity_catches_paraphrase():
    record = _record("Own the ETL pipeline layer", "3+ years Python experience needed")
    assert verbatim_fidelity(record) == 0.0


def test_fidelity_is_partial_when_one_span_drifts():
    record = _record("You will own the ETL layer.", "3+ years Python experience needed")
    assert verbatim_fidelity(record) == 0.5


def test_fidelity_ignores_whitespace_and_case():
    record = _record("you  will   own\nthe ETL layer.", "REQUIRES 3 YEARS OF PYTHON.")
    assert verbatim_fidelity(record) == 1.0


def test_fidelity_is_none_when_nothing_to_measure():
    assert verbatim_fidelity(_record("", "")) is None


SOURCE = (
    "About us\n\nWe build things.\n\n"
    "What you'll do:\n- Design and ship backend services in Go\n"
    "- Own the deployment pipeline end to end\n\n"
    "Requirements:\n- 4+ years of commercial Go experience\n"
    "- Comfortable with Kubernetes and Terraform\n\nBenefits: snacks."
)


def test_snap_returns_source_slice_for_a_paraphrase():
    paraphrased = ("Designing and shipping backend services using Go, and owning "
                   "the deployment pipeline from end to end.")
    out = snap(paraphrased, SOURCE)
    assert out in SOURCE
    assert "- Design and ship backend services in Go" in out
    assert "- Own the deployment pipeline end to end" in out
    assert "Benefits: snacks." not in out


def test_snap_leaves_an_already_verbatim_span_intact():
    exact = "- 4+ years of commercial Go experience"
    assert snap(exact, SOURCE) == exact


def test_snap_refuses_when_the_span_is_not_in_the_source():
    assert snap("We offer dental insurance and a company car in Lisbon.", SOURCE) == ""


def test_snap_returns_empty_for_empty_input():
    assert snap("", SOURCE) == ""
    assert snap("anything", "") == ""


def test_merge_makes_paraphrased_spans_verbatim():
    posting = {"id": "x:1", "source": "x", "description_text": SOURCE}
    extracted = {
        "responsibilities_text": "Designing and shipping Go backend services.",
        "requirements_text": "Around four years of Go, plus Kubernetes and Terraform.",
        "stack": ["Go"],
    }
    record = merge(posting, extracted)
    assert verbatim_fidelity(record) == 1.0


def test_unannualize_undoes_a_x12_on_an_annual_band():
    source = "The salary range for this role is $212,000 - $318,000 per year."
    assert unannualize(2_544_000, source) == 212_000


def test_unannualize_leaves_a_genuine_monthly_conversion_alone():
    assert unannualize(8_400, "Salary: to $700") == 8_400


def test_unannualize_leaves_a_normal_salary_alone():
    assert unannualize(180_000, "We pay $180,000.") == 180_000


def test_unannualize_keeps_a_high_value_with_no_matching_figure():
    assert unannualize(1_500_000, "No numbers here.") == 1_500_000


def test_unannualize_passes_none_through():
    assert unannualize(None, "$100,000") is None


def test_unannualize_snaps_to_the_printed_figure_not_the_quotient():
    assert unannualize(1_886_400, "Base pay is $156,800.00 - $235,200.00.") == 156_800
