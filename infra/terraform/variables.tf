variable "environment" {
  description = "Environment name (dev/prod)."
  type        = string
}

variable "cloud_id" {
  description = "Yandex Cloud ID."
  type        = string
}

variable "folder_id" {
  description = "Yandex Cloud folder ID."
  type        = string
}

variable "sa_key_file" {
  description = "Path to service account authorized key JSON."
  type        = string
}

variable "zone" {
  description = "YC availability zone."
  type        = string
  default     = "ru-central1-a"
}

variable "vpc_cidr" {
  description = "CIDR range for VPC subnet."
  type        = string
  default     = "10.10.0.0/24"
}

variable "vm_name" {
  description = "VM instance name."
  type        = string
  default     = "decision-matrix-app"
}

variable "vm_cores" {
  type    = number
  default = 2
}

variable "vm_memory_gb" {
  type    = number
  default = 4
}

variable "vm_disk_gb" {
  type    = number
  default = 30
}

variable "ssh_public_key" {
  description = "Public key value for vm user."
  type        = string
}

variable "image_family" {
  description = "Base OS family from standard image catalog."
  type        = string
  default     = "ubuntu-2204-lts"
}

variable "vm_user" {
  type    = string
  default = "deploy"
}

variable "enable_managed_postgres" {
  type    = bool
  default = false
}

variable "postgres_version" {
  type    = string
  default = "16"
}

variable "postgres_db_name" {
  type    = string
  default = "sppr"
}

variable "postgres_username" {
  type    = string
  default = "sppr"
}

variable "postgres_password" {
  type      = string
  default   = ""
  sensitive = true
}

variable "postgres_disk_size_gb" {
  type    = number
  default = 20
}
