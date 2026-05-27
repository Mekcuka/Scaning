output "vm_external_ip" {
  description = "Public IP of app VM."
  value       = yandex_compute_instance.app.network_interface[0].nat_ip_address
}

output "vm_name" {
  value = yandex_compute_instance.app.name
}

output "registry_id" {
  value = yandex_container_registry.main.id
}

output "registry_name" {
  value = yandex_container_registry.main.name
}

output "postgres_fqdn" {
  description = "Managed PostgreSQL host FQDN (when enabled)."
  value = var.enable_managed_postgres ? (
    yandex_mdb_postgresql_cluster.main[0].host[0].fqdn
  ) : null
}
