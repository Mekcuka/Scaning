"""Server-side assistant response formatters."""

from app.assistant.chat.response_formatters import (
    format_cost_rates_summary,
    format_infra_objects_summary,
    format_job_summary,
    format_pois_summary,
    format_projects_summary,
    try_server_answer_after_tools,
)
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary


def test_format_infra_objects_summary_uses_manifest_labels():
    text = format_infra_objects_summary(
        {
            "count": 6,
            "count_by_subtype": {
                "autoroad": 1,
                "gas_processing": 1,
                "gas_pipeline": 1,
                "gtes": 1,
                "power_line": 1,
                "substation": 1,
            },
        },
        project_name="Участок Западный",
    )
    assert "6" in text
    assert "Автодорога" in text
    assert "ГКС" in text
    assert "скважин" not in text.lower()
    assert "магистрал" not in text.lower()


def test_try_server_answer_after_infra_tool():
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="какие объекты есть на карте?")],
        project_name="Участок Западный",
    )
    summaries = [ToolCallSummary(name="list_infra_objects", ok=True)]
    cache = {
        "list_infra_objects": {
            "count": 2,
            "count_by_subtype": {"node": 2},
        }
    }
    answer = try_server_answer_after_tools(request, summaries, cache)
    assert answer is not None
    assert "Узел: 2" in answer


def test_format_pois_summary_lists_names():
    text = format_pois_summary(
        {
            "count": 2,
            "preview": [{"name": "POI-A"}, {"name": "POI-B"}],
            "truncated": False,
        },
        project_name="Тест",
    )
    assert "2" in text
    assert "POI-A" in text
    assert "POI-B" in text


def test_try_server_answer_after_poi_tool():
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="сколько POI в проекте?")],
        project_name="Тест",
    )
    summaries = [ToolCallSummary(name="list_pois", ok=True)]
    cache = {"list_pois": {"count": 1, "preview": [{"name": "Well-1"}], "truncated": False}}
    answer = try_server_answer_after_tools(request, summaries, cache)
    assert answer is not None
    assert "Well-1" in answer


def test_format_projects_summary():
    text = format_projects_summary(
        {"count": 2, "preview": [{"name": "Alpha"}, {"name": "Beta"}], "truncated": False}
    )
    assert "2" in text
    assert "Alpha" in text


def test_format_job_summary_no_active():
    text = format_job_summary({"active": False}, project_name="Тест")
    assert "активных фоновых задач нет" in text.lower()


def test_format_job_summary_single_running():
    text = format_job_summary(
        {
            "job_type": "poi_analyze_all",
            "status": "running",
            "progress": 42.5,
        },
        project_name="Тест",
    )
    assert "Анализ окружения" in text
    assert "Выполняется" in text
    assert "42" in text


def test_try_server_answer_after_job_tool():
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="статус фоновой задачи")],
        project_name="Тест",
    )
    summaries = [ToolCallSummary(name="get_project_job", ok=True)]
    cache = {"get_project_job": {"active": False}}
    answer = try_server_answer_after_tools(request, summaries, cache)
    assert answer is not None
    assert "активных" in answer.lower()


def test_format_cost_rates_summary_grouped():
    text = format_cost_rates_summary(
        {"rates": {"autoroad": 5000, "gas_processing": 500000}},
        project_name="Тест",
        detailed=False,
    )
    assert "Линейные объекты" in text
    assert "тыс." in text


def test_try_server_answer_after_rates_tool():
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="покажи тарифы проекта")],
        project_name="Тест",
    )
    summaries = [ToolCallSummary(name="get_cost_rates", ok=True)]
    cache = {"get_cost_rates": {"rates": {"autoroad": 5000}}}
    answer = try_server_answer_after_tools(request, summaries, cache)
    assert answer is not None
    assert "тариф" in answer.lower() or "ставк" in answer.lower()
