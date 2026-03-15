import io
from core.config import settings

class StorageService:
    _client = None

    @classmethod
    def _get_client(cls):
        if cls._client is None:
            from minio import Minio
            cls._client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
            if not cls._client.bucket_exists(settings.MINIO_BUCKET):
                cls._client.make_bucket(settings.MINIO_BUCKET)
        return cls._client

    @classmethod
    async def upload_resume(cls, user_id: str, content: bytes, filename: str) -> str:
        client = cls._get_client()
        key = f"resumes/{user_id}/{filename}"
        client.put_object(settings.MINIO_BUCKET, key,
                          data=io.BytesIO(content), length=len(content),
                          content_type="application/pdf")
        return key

    @classmethod
    async def extract_pdf_text(cls, content: bytes) -> str:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
