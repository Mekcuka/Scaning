resource "yandex_container_registry" "main" {
  name      = "${var.environment}-decision-matrix-registry"
  folder_id = var.folder_id
}
