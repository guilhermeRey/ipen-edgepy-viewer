"""Download the public TCIA phantom and verify all files against the frozen manifest."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    manifest = json.loads((ROOT / "manifests/dataset.json").read_text())
    data = ROOT / "data"
    data.mkdir(exist_ok=True)
    archive_path = data / "series.zip"
    url = manifest["source"]["archive_url"]
    cached = archive_path.exists()
    if not cached:
        print(f"Downloading TCIA series: {url}", flush=True)
        request = urllib.request.Request(url, headers={"User-Agent": "EdgePy-reproducibility/1.0"})
        partial = data / "series.zip.part"
        with urllib.request.urlopen(request, timeout=180) as response, partial.open("wb") as output:
            shutil.copyfileobj(response, output)
        partial.replace(archive_path)
    expected = {entry["sha256"]: entry for entry in manifest["instances"]}
    if len(expected) != 123:
        raise ValueError("The frozen protocol requires 123 distinct DICOM files")
    found = set()
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip() is not None:
            raise ValueError("Downloaded ZIP failed its CRC check")
        for member in archive.infolist():
            if member.is_dir():
                continue
            raw = archive.read(member)
            if raw[128:132] != b"DICM":
                continue
            digest = sha256(raw)
            if digest not in expected or digest in found:
                raise ValueError(f"Unexpected or duplicate DICOM file: {member.filename}")
            entry = expected[digest]
            if len(raw) != entry["file_bytes"]:
                raise ValueError(f"Incorrect size: {member.filename}")
            destination = ROOT / entry["relative_path"]
            if not destination.resolve().is_relative_to(data.resolve()):
                raise ValueError("Manifest path is outside data/")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(raw)
            found.add(digest)
    if found != set(expected):
        raise ValueError(f"Missing DICOM files: {len(expected) - len(found)}")
    record = {
        "acquired_at_utc": datetime.now(timezone.utc).isoformat(),
        "archive_url": url,
        "archive_sha256": sha256(archive_path.read_bytes()),
        "archive_bytes": archive_path.stat().st_size,
        "cached_archive": cached,
        "verified_instances": len(found),
        "dataset_manifest_sha256": sha256((ROOT / "manifests/dataset.json").read_bytes()),
        "doi": manifest["doi"],
        "license": manifest["license"],
    }
    (data / "acquisition.json").write_text(json.dumps(record, indent=2) + "\n")
    print("Verified 123 original DICOM files against the historical SHA-256 manifest.")


if __name__ == "__main__":
    main()
