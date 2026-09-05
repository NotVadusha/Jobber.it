from jobber.sources.base import html_to_markdown


def test_display_markdown_preserves_structure_without_active_content():
    rendered = html_to_markdown(
        '<h2>About the role</h2><p>Build <strong>reliable</strong> systems.</p>'
        '<ul><li>Python</li><li>SQL</li></ul>'
        '<script>evil()</script><style>bad</style><img src="https://tracking.test/pixel">'
    )
    assert '## About the role' in rendered
    assert '**reliable**' in rendered
    assert '- Python' in rendered
    assert '- SQL' in rendered
    assert 'evil' not in rendered
    assert 'tracking.test' not in rendered


def test_empty_description_has_no_display_markdown():
    assert html_to_markdown(None) == ''
