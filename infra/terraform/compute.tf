data "yandex_compute_image" "base" {
  family = var.image_family
}

resource "yandex_compute_instance" "app" {
  name        = "${var.environment}-${var.vm_name}"
  platform_id = "standard-v3"
  zone        = var.zone

  resources {
    cores  = var.vm_cores
    memory = var.vm_memory_gb
  }

  boot_disk {
    initialize_params {
      image_id = data.yandex_compute_image.base.id
      size     = var.vm_disk_gb
      type     = "network-ssd"
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.main.id
    nat                = true
    security_group_ids = [yandex_vpc_security_group.app.id]
  }

  metadata = {
    user-data = templatefile("${path.module}/../cloud-init/user-data.yaml", {
      vm_user = var.vm_user
    })
    ssh-keys = "${var.vm_user}:${var.ssh_public_key}"
  }
}
