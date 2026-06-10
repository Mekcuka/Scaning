"""Server-side assistant response formatters."""

from app.assistant.chat.formatters.analysis import (
    format_poi_analysis_summary,
    format_poi_candidates_summary,
)
from app.assistant.chat.formatters.admin import format_admin_jobs_summary
from app.assistant.chat.formatters.counts import format_layers_summary, format_project_card
from app.assistant.chat.formatters.flow_sand import (
    format_flow_schematic_summary,
    format_sand_logistics_summary,
)
from app.assistant.chat.formatters.registry import try_server_answer_after_tools as _try_answer
from app.assistant.chat.response_formatters import (
    format_cost_rates_summary,
    format_infra_objects_summary,
    format_job_summary,
    format_pois_summary,
    format_projects_summary,
    try_server_answer_after_tools,
)
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary


def _try(request, summaries, cache):
    answer, _ = _try_answer(request, summaries, cache)
    return answer


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


def test_try_server_answer_tool_first_projects_count():
    request = ChatRequest(messages=[ChatMessage(role="user", content="сколько?")])
    summaries = [ToolCallSummary(name="list_projects", ok=True)]
    cache = {
        "list_projects": {
            "count": 3,
            "preview": [{"name": "A"}, {"name": "B"}],
            "truncated": False,
        }
    }
    answer = try_server_answer_after_tools(request, summaries, cache)
    assert answer is not None
    assert "3" in answer


def test_format_layers_summary():
    text = format_layers_summary(
        {
            "count": 2,
            "count_by_layer_type": {"vector": 1, "raster": 1},
            "preview": [{"title": "Base"}, {"title": "Roads"}],
        },
        project_name="Тест",
    )
    assert "2" in text
    assert "Base" in text


def test_try_server_answer_layers_tool():
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="сколько слоёв на карте?")],
        project_name="Тест",
    )
    summaries = [ToolCallSummary(name="list_infra_layers", ok=True)]
    cache = {"list_infra_layers": {"count": 4, "preview": [{"title": "L1"}], "truncated": False}}
    answer = _try(request, summaries, cache)
    assert answer is not None
    assert "4" in answer


def test_format_project_card():
    text = format_project_card(
        {
            "name": "Alpha",
            "status": "active",
            "poi_count": 5,
            "owner_email": "user@test.ru",
        }
    )
    assert "Alpha" in text
    assert "5" in text


def test_try_server_answer_get_project_card():
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="расскажи о проекте")],
        project_id="00000000-0000-0000-0000-000000000001",
    )
    summaries = [ToolCallSummary(name="get_project", ok=True)]
    cache = {
        "get_project": {
            "name": "Alpha",
            "status": "active",
            "poi_count": 2,
            "owner_email": "a@test.ru",
        }
    }
    answer = _try(request, summaries, cache)
    assert answer is not None
    assert "Alpha" in answer


def test_try_server_answer_single_tool_error():
    request = ChatRequest(messages=[ChatMessage(role="user", content="анализ")])
    summaries = [ToolCallSummary(name="get_poi_analysis", ok=False, code="not_found")]
    cache = {"get_poi_analysis": {"error": True, "code": "not_found", "error_message": "Нет анализа"}}
    answer, source = _try_answer(request, summaries, cache)
    assert answer is not None
    assert source == "tool_error"
    assert "Нет анализа" in answer


def test_format_poi_analysis_summary():
    text = format_poi_analysis_summary(
        {
            "total_cost_mln": 12.5,
            "overall_status": "warning",
            "rows": [
                {"subtype": "autoroad", "status": "exceed", "cost_mln": 5.0},
                {"subtype": "gas_pipeline", "status": "ok", "cost_mln": 1.0},
            ],
        }
    )
    assert "12.5" in text
    assert "превыш" in text.lower() or "Превыш" in text


def test_format_poi_candidates_summary():
    text = format_poi_candidates_summary(
        {
            "count": 2,
            "preview": [
                {"name": "Obj-A", "distance_km": 1.5},
                {"name": "Obj-B", "distance_km": 3.0},
            ],
        }
    )
    assert "Obj-A" in text
    assert "1.50" in text


def test_format_admin_jobs_summary():
    text = format_admin_jobs_summary(
        {
            "total": 10,
            "items": [
                {
                    "job_type": "poi_analyze_all",
                    "status": "running",
                    "project_name": "P1",
                }
            ],
        }
    )
    assert "10" in text
    assert "P1" in text


def test_format_sand_logistics_summary():
    text = format_sand_logistics_summary(
        {
            "subnet_count": 1,
            "timeline": [
                {
                    "year": 2024,
                    "total_demand_m3": 1000,
                    "total_allocated_m3": 900,
                    "unmet_m3": 100,
                }
            ],
            "subnets": [{"name": "West", "quarry_count": 2, "consumer_count": 3}],
        }
    )
    assert "2024" in text
    assert "West" in text


def test_format_flow_schematic_summary():
    text = format_flow_schematic_summary(
        {"nodes": [{"id": "n1"}], "edges": [{"id": "e1"}], "source": "auto"}
    )
    assert "узлов" in text.lower() or "узл" in text.lower()
    assert "1" in text
