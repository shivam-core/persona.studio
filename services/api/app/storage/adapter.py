"""Private storage adapter for artifacts and uploaded datasets."""

import os
import shutil
from pathlib import Path
from app.config import settings


class StorageAdapter:
    def __init__(self, base_dir: str | None = None):
        self.base_dir = Path(base_dir or settings.DATA_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        (self.base_dir / "uploads").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "artifacts").mkdir(parents=True, exist_ok=True)

    def get_upload_path(self, dataset_version_id: str, filename: str) -> Path:
        target_dir = self.base_dir / "uploads" / dataset_version_id
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir / filename

    def get_artifact_path(self, artifact_key: str) -> Path:
        target = self.base_dir / "artifacts" / artifact_key
        target.parent.mkdir(parents=True, exist_ok=True)
        return target

    def save_bytes(self, path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    def read_bytes(self, path: Path) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def remove_dataset_files(self, dataset_version_id: str) -> None:
        target_dir = self.base_dir / "uploads" / dataset_version_id
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)


storage = StorageAdapter()
