"""Human-readable permission denial messages (Russian)."""

from fastapi import HTTPException, status

from app.models import Project, User
from app.models.enums import AccessLevel, UserRole, WriteScope

ROLE_LABELS_RU: dict[str, str] = {
    UserRole.admin.value: "администратор",
    UserRole.analyst.value: "аналитик",
    UserRole.data_manager.value: "менеджер данных",
    UserRole.viewer.value: "наблюдатель",
}


def _user_role(user: User) -> UserRole:
    try:
        return UserRole(user.role)
    except ValueError:
        return UserRole.viewer


def _is_owner(user: User, project: Project) -> bool:
    return project.user_id == user.id

ROLE_LABELS_RU: dict[str, str] = {
    UserRole.admin.value: "администратор",
    UserRole.analyst.value: "аналитик",
    UserRole.data_manager.value: "менеджер данных",
    UserRole.viewer.value: "наблюдатель",
}


def role_label(role: UserRole | str) -> str:
    value = role.value if isinstance(role, UserRole) else role
    return ROLE_LABELS_RU.get(value, value)


def deny_role_required(user: User, *allowed: UserRole) -> None:
    current = _user_role(user)
    if current in allowed:
        return
    allowed_text = ", ".join(role_label(r) for r in allowed)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            f"Недоступно для роли «{role_label(current)}». "
            f"Требуется: {allowed_text}."
        ),
    )


def deny_project_access(
    user: User,
    project: Project,
    *,
    min_access: AccessLevel,
    write_scope: WriteScope = WriteScope.project,
) -> None:
    role = _user_role(user)

    if min_access == AccessLevel.read:
        if role == UserRole.viewer and project.visibility != "published":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Проект не опубликован. Наблюдатель может просматривать "
                    "только опубликованные проекты."
                ),
            )
        if project.visibility == "private" and not _is_owner(user, project) and role not in (
            UserRole.admin,
            UserRole.data_manager,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Проект закрыт (private). Просмотр доступен только владельцу, "
                    "администратору и менеджеру данных."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет прав на просмотр этого проекта.",
        )

    if min_access == AccessLevel.write:
        if role == UserRole.viewer:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Роль «наблюдатель» — только просмотр. Редактирование недоступно.",
            )
        if role == UserRole.data_manager and write_scope == WriteScope.project:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Менеджер данных может изменять карту и импорт инфраструктуры. "
                    "Настройки, POI и ставки проекта — только у владельца или администратора."
                ),
            )
        if role == UserRole.analyst and not _is_owner(user, project):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Это чужой проект. Аналитик может редактировать только свои проекты "
                    "(или опубликованные — только просмотр)."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения этого проекта.",
        )

    if min_access == AccessLevel.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удалять или передавать проект может только владелец или администратор.",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Недостаточно прав для этого действия.",
    )
