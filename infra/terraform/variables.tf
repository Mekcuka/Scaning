variable "environment" {
  type        = string
  description = "Environment name (dev/prod)."
}

variable "cloud_id" {
  type        = string
  description = "Yandex Cloud ID."
}

variable "folder_id" {
  type        = string
  description = "Yandex Cloud folder ID."
}

variable "sa_key_file" {
  type        = string
  description = "Path to service account authorized key JSON."
}

variable "zone" {
  type        = string
  description = "YC availability zone."
  default     = "ru-central1-a"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR range for VPC subnet."
  default     = "10.10.0.0/24"
}

variable "vm_name" {
  type        = string
  description = "VM instance name."
  default     = "decision-matrix-app"
}

variable "vm_cores" {
  type        = number
  default     = 2
}

variable "vm_memory_gb" {
  type        = number
  default     = 4
}

variable "vm_disk_gb" {
  type        = number
  default     = 30
}

variable "ssh_public_key" {
  type        = string
  description = "Public key value for vm user."
}

variable "image_family" {
  type        = string
  description = "Base OS family from standard image catalog."
  default     = "ubuntu-2204-lts"
}

variable "vm_user" {
  type        = string
  default     = "deploy"
}

variable "enable_managed_postgres" {
  type        = bool
  default     = false
}

variable "postgres_version" {
  type        = string
  default     = "16"
}

variable "postgres_db_name" {
  type        = string
  default     = "sppr"
}

variable "postgres_username" {
  type        = string
  default     = "sppr"
}

variable "postgres_password" {
  type        = string
  sensitive   = true
  default     = ""
}

variable "postgres_disk_size_gb" {
  type        = number
  default     = 20
}
