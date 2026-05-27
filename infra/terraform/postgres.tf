resource "yandex_mdb_postgresql_cluster" "main" {
  count       = var.enable_managed_postgres ? 1 : 0
  name        = "${var.environment}-sppr-postgres"
  environment = "PRODUCTION"
  network_id  = yandex_vpc_network.main.id
  folder_id   = var.folder_id

  config {
    version = var.postgres_version
    resources {
      resource_preset_id = "s2.micro"
      disk_type_id       = "network-ssd"
      disk_size          = var.postgres_disk_size_gb
    }
  }

  host {
    zone      = var.zone
    subnet_id = yandex_vpc_subnet.main.id
  }
}

resource "yandex_mdb_postgresql_user" "app" {
  count      = var.enable_managed_postgres ? 1 : 0
  cluster_id = yandex_mdb_postgresql_cluster.main[0].id
  name       = var.postgres_username
  password   = var.postgres_password
}

resource "yandex_mdb_postgresql_database" "app" {
  count      = var.enable_managed_postgres ? 1 : 0
  cluster_id = yandex_mdb_postgresql_cluster.main[0].id
  owner      = yandex_mdb_postgresql_user.app[0].name
  name       = var.postgres_db_name
}
