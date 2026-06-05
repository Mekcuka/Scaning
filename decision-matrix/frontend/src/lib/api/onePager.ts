export interface OnePagerRoadmapStage {
  stage: string;
  duration_months: number | null;
}

export interface OnePager {
  id: string;
  project_id: string;
  poi_id: string;
  title: string;
  coordinates: string | null;
  engineer_name: string | null;
  report_date: string | null;
  final_variant_data: Record<string, unknown>;
  engineering_params: Record<string, unknown>;
  roadmap: OnePagerRoadmapStage[];
  recommendation_text: string | null;
  is_recommendation_edited: boolean;
  generation_status: string;
  poi_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OnePagerCreatePayload {
  poi_id: string;
  engineer_name?: string | null;
  roadmap?: OnePagerRoadmapStage[] | null;
  recommendation_text?: string | null;
  map_snapshot_base64?: string | null;
}

export interface OnePagerUpdatePayload {
  recommendation_text?: string | null;
  roadmap?: OnePagerRoadmapStage[] | null;
  map_snapshot_base64?: string | null;
  engineer_name?: string | null;
}
