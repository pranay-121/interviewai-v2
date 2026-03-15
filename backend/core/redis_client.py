import redis.asyncio as aioredis
from core.config import settings

class RedisClient:
    def __init__(self):
        self._client = None

    async def connect(self):
        self._client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

    async def disconnect(self):
        if self._client:
            await self._client.aclose()

    async def get(self, key: str):
        return await self._client.get(key)

    async def setex(self, key: str, seconds: int, value: str):
        await self._client.setex(key, seconds, value)

    async def set(self, key: str, value: str, ex: int = None):
        await self._client.set(key, value, ex=ex)

    async def delete(self, *keys: str):
        await self._client.delete(*keys)

    async def exists(self, key: str) -> bool:
        return bool(await self._client.exists(key))

redis_client = RedisClient()
