import pytest

from jobber.sources import RawPosting, role


@pytest.mark.parametrize("title,expected", [
    ("Senior Software Engineer", "swe"),
    ("Senior Java Developer", "swe"),
    ("Product Engineer", "swe"),
    ("Site Reliability Engineer", "devops"),
    ("DevOps Engineer (Kubernetes)", "devops"),
    ("Staff Platform Engineer", "devops"),
    ("QA Automation Engineer", "qa"),
    ("SDET, Payments", "qa"),
    ("Senior Machine Learning Engineer", "ml"),
    ("Data Engineer, Analytics", "data"),
    ("Product Security Engineer", "security"),
    ("Senior iOS Engineer", "mobile"),
    # Carries an engineering word, is not an engineering job.
    ("Sr. Solutions Engineer", None),
    ("Forward Deployed Engineer, Professional Services", None),
    ("Engineering Manager, Core Platform", None),
    ("Director of Engineering", None),
    ("Developer Relations", None),
    ("Staff Designated Support Engineer", None),
    ("Account Executive, Enterprise", None),
    ("Product Designer", None),
    ("", None),
])
def test_role(title, expected):
    assert role(title) == expected


def test_every_posting_is_classified_on_construction():
    posting = RawPosting(source="greenhouse", source_id="1", url="u",
                         title="Backend Engineer", company="acme",
                         description_text="text")
    assert posting.extra["role"] == "swe"
    assert posting.as_dict()["extra"]["role"] == "swe"
