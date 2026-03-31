from __future__ import annotations

import json
from typing import Any

from redis import Redis
from redis.exceptions import RedisError


class CacheClient:
    def __init__(self, redis_url: str | None):
        self._redis = Redis.from_url(redis_url, decode_responses=True) if redis_url else None

    @property
    def enabled(self) -> bool:
        return self._redis is not None

    def get_json(self, key: str) -> Any | None:
        if not self._redis:
            return None

        try:
            raw = self._redis.get(key)
        except RedisError:
            return None

        if not raw:
            return None

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        if not self._redis:
            return

        try:
            self._redis.set(key, json.dumps(value), ex=ttl_seconds)
        except RedisError:
            return
