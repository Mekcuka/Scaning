export interface ImportConnectionCreate {
  name: string;
  api_url: string;
  auth_type?: string;
  credentials?: string;
  registry_type?: string | null;
}

export interface ImportConnection {
  id: string;
  project_id: string;
  name: string;
  api_url: string;
  auth_type: string;
  registry_type?: string | null;
  created_at: string;
}

export interface InfrastructureNetwork {
  id: string;
  project_id: string;
  name: string;
}

export interface NetworkNode {
  id: string;
  network_id: string;
  infrastructure_object_id: string | null;
  lon: number;
  lat: number;
}

export interface NetworkEdge {
  id: string;
  network_id: string;
  from_node_id: string;
  to_node_id: string;
  length_km: number;
}

export interface ImportLog {
  id: string;
  project_id?: string | null;
  source_type: string;
  file_name: string | null;
  status: string;
  records_total: number;
  records_imported: number;
  errors: string[];
  created_at: string;
}
