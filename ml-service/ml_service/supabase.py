from __future__ import annotations

from typing import Any
import httpx


Filter = tuple[str, str, Any]


class SupabaseRestClient:
    def __init__(self, base_url: str, service_role_key: str):
        self._base_url = base_url.rstrip("/")
        self._headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }
        self._client = httpx.Client(timeout=60)

    def close(self) -> None:
        self._client.close()

    def _build_filter_value(self, op: str, value: Any) -> str:
        if op == "in":
            joined = ",".join(str(item) for item in value)
            return f"in.({joined})"
        if isinstance(value, bool):
            return f"{op}.{'true' if value else 'false'}"
        return f"{op}.{value}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        response = self._client.request(
            method,
            f"{self._base_url}{path}",
            params=params,
            json=json,
            headers={**self._headers, **(headers or {})},
        )
        response.raise_for_status()
        if not response.content:
            return None
        return response.json()

    def select_rows(
        self,
        table: str,
        *,
        columns: str,
        filters: list[Filter] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": columns}
        for field, op, value in filters or []:
            params[field] = self._build_filter_value(op, value)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        data = self._request("GET", f"/rest/v1/{table}", params=params)
        return data or []

    def fetch_all_rows(
        self,
        table: str,
        *,
        columns: str,
        filters: list[Filter] | None = None,
        order: str | None = None,
        page_size: int = 1000,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0

        while True:
            params: dict[str, str] = {
                "select": columns,
                "limit": str(page_size),
                "offset": str(offset),
            }
            for field, op, value in filters or []:
                params[field] = self._build_filter_value(op, value)
            if order:
                params["order"] = order

            page = self._request("GET", f"/rest/v1/{table}", params=params) or []
            rows.extend(page)
            if len(page) < page_size:
                break
            offset += page_size

        return rows

    def upsert_rows(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        on_conflict: str | None = None,
    ) -> None:
        if not rows:
            return

        headers = {
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        params = {"on_conflict": on_conflict} if on_conflict else None
        self._request("POST", f"/rest/v1/{table}", params=params, json=rows, headers=headers)

    def rpc(self, function_name: str, payload: dict[str, Any]) -> Any:
        return self._request("POST", f"/rest/v1/rpc/{function_name}", json=payload)

    def patch_rows(
        self,
        table: str,
        updates: dict[str, Any],
        *,
        filters: list[Filter],
    ) -> None:
        params: dict[str, str] = {}
        for field, op, value in filters:
            params[field] = self._build_filter_value(op, value)
        headers = {
            "Prefer": "return=minimal",
        }
        self._request("PATCH", f"/rest/v1/{table}", params=params, json=updates, headers=headers)

    def fetch_profile(self, user_id: str) -> dict[str, Any] | None:
        rows = self.select_rows(
            "profiles",
            columns="id, year, major, interests, full_name",
            filters=[("id", "eq", user_id)],
            limit=1,
        )
        return rows[0] if rows else None

    def fetch_user_recommendation_profile(self, user_id: str) -> dict[str, Any] | None:
        rows = self.select_rows(
            "user_recommendation_profiles",
            columns=(
                "user_id, embedding, profile_embedding, behavior_embedding, "
                "interaction_weight_total, strategy, computed_at, last_event_at"
            ),
            filters=[("user_id", "eq", user_id)],
            limit=1,
        )
        return rows[0] if rows else None

    def fetch_user_applications(self, user_id: str) -> list[dict[str, Any]]:
        return self.select_rows(
            "user_applications",
            columns="club_id, status, application_source, applied_at",
            filters=[("user_id", "eq", user_id)],
        )

    def fetch_user_events(
        self,
        user_id: str,
        *,
        club_ids: list[str] | None = None,
        since_iso: str | None = None,
    ) -> list[dict[str, Any]]:
        filters: list[Filter] = [("user_id", "eq", user_id)]
        if club_ids:
            filters.append(("club_id", "in", club_ids))
        if since_iso:
            filters.append(("created_at", "gte", since_iso))
        return self.select_rows(
            "events",
            columns="club_id, event_type, metadata, created_at",
            filters=filters,
            order="created_at.desc",
        )

    def fetch_candidate_clubs(self, club_ids: list[str]) -> list[dict[str, Any]]:
        if not club_ids:
            return []
        return self.select_rows(
            "clubs",
            columns=(
                "id, name, category, tags, description, application_mode, "
                "recruiting_status, verified, target_years"
            ),
            filters=[("id", "in", club_ids)],
        )

    def fetch_candidate_stats(self, club_ids: list[str]) -> list[dict[str, Any]]:
        if not club_ids:
            return []
        return self.select_rows(
            "club_recommendation_stats",
            columns=(
                "club_id, views_30d, clicks_30d, follows_30d, applications_30d, "
                "native_applications_30d, next_deadline_at, active_deadline_count, updated_at"
            ),
            filters=[("club_id", "in", club_ids)],
        )

    def fetch_active_model(self) -> dict[str, Any] | None:
        rows = self.select_rows(
            "ml_model_versions",
            columns=(
                "version, embedding_model, ranker_version, artifact_manifest_url, "
                "training_window_start, training_window_end, status, metrics"
            ),
            filters=[("status", "eq", "active")],
            limit=1,
        )
        return rows[0] if rows else None
