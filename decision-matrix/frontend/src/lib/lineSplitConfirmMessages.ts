import { SUBTYPE_LABELS } from './api';
import type { LineSplitCandidate } from './lineSplit';

export type LineSplitConfirmScenario = 'line_finish' | 'point_on_line';

export type LineSplitConfirmRequest = {
  split: LineSplitCandidate;
  pointLabel: string;
  scenario: LineSplitConfirmScenario;
};

export type LineSplitConfirmSummary = {
  lineName: string;
  lineSubtypeLabel: string;
  secondLineName: string;
  pointLabel: string;
  scenario: LineSplitConfirmScenario;
};

export function buildLineSplitConfirmSummary(
  request: LineSplitConfirmRequest,
): LineSplitConfirmSummary {
  const { split, pointLabel, scenario } = request;
  return {
    lineName: split.line.name,
    lineSubtypeLabel: SUBTYPE_LABELS[split.line.subtype] ?? split.line.subtype,
    secondLineName: `${split.line.name} (2)`,
    pointLabel,
    scenario,
  };
}
