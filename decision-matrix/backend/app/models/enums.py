import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    analyst = "analyst"
    data_manager = "data_manager"
    viewer = "viewer"


class AccessLevel(str, enum.Enum):
    read = "read"
    write = "write"
    owner = "owner"


class WriteScope(str, enum.Enum):
    project = "project"
    infra = "infra"
