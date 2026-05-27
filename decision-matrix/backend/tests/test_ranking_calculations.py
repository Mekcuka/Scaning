from app.services.calculations import calc_topsis_scores, normalize_matrix, rebalance_weights, thousand_to_million_rub


def test_normalize_matrix_cost_and_benefit():
    values = [
        [100.0, 1.0],
        [50.0, 2.0],
    ]
    normalized = normalize_matrix(values, ["cost", "benefit"])
    assert normalized[0][0] == 0.0
    assert normalized[1][0] == 1.0
    assert normalized[0][1] == 0.0
    assert normalized[1][1] == 1.0


def test_rebalance_weights_keeps_sum_and_boosts_target():
    base = {"a": 0.5, "b": 0.3, "c": 0.2}
    result = rebalance_weights(base, "b", 0.1)
    assert abs(sum(result.values()) - 1.0) < 1e-9
    assert result["b"] > base["b"]


def test_topsis_and_units_conversion():
    normalized = [[0.8, 0.2], [0.2, 0.8]]
    scores = calc_topsis_scores(normalized, [0.5, 0.5])
    assert len(scores) == 2
    assert thousand_to_million_rub(2500) == 2.5
