"""Generate offline, byte-level pixel and controlled window references."""
from pathlib import Path
import hashlib
import json
import struct
import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, CTImageStorage

ROOT = Path(__file__).resolve().parents[1]
sha = lambda data: hashlib.sha256(data).hexdigest()


def reference(path):
    ds = pydicom.dcmread(path)
    assert ds.file_meta.TransferSyntaxUID == ExplicitVRLittleEndian
    assert ds.BitsAllocated == 16 and ds.HighBit == ds.BitsStored - 1
    assert ds.SamplesPerPixel == 1 and int(ds.get('NumberOfFrames', 1)) == 1
    # Independent of pydicom's pixel decoder: manually interpret native words.
    words = struct.unpack('<' + 'H' * (ds.Rows * ds.Columns), ds.PixelData)
    mask, sign = (1 << ds.BitsStored) - 1, 1 << (ds.BitsStored - 1)
    values = [((v & mask) - (1 << ds.BitsStored) if ds.PixelRepresentation and v & sign else v & mask) for v in words]
    raw = np.asarray(values, dtype='<i4').reshape(ds.Rows, ds.Columns)
    np.testing.assert_array_equal(raw, ds.pixel_array)
    scaled = raw.astype(np.float32) * np.float32(ds.RescaleSlope) + np.float32(ds.RescaleIntercept)
    gray = np.floor(np.clip((scaled - np.float32(-160)) / np.float32(400), 0, 1) * np.float32(255)).astype(np.uint8)
    rgba = np.empty((*raw.shape, 4), dtype=np.uint8)
    rgba[..., :3] = gray[..., None]
    rgba[..., 3] = 255
    return {'sop_instance_uid': str(ds.SOPInstanceUID), 'shape': list(raw.shape),
            'raw_i32_sha256': sha(raw.tobytes()), 'rgba_sha256': sha(rgba.tobytes())}


def fixtures():
    folder = ROOT / 'data/fixtures'
    folder.mkdir(parents=True, exist_ok=True)
    records = []
    for index, (signed, values, slope, intercept) in enumerate([
        (0, [0, 1, 864, 865, 1023, 1024, 1064, 1065, 1263, 1264, 1265, 1400, 2000, 3000, 4094, 4095], 1, -1024),
        (1, [-2048, -1024, -281, -280, -279, -1, 0, 40, 519, 520, 521, 800, 1023, 1500, 2046, 2047], .5, -20),
    ]):
        uid = f'1.2.826.0.1.3680043.10.543.20260923.{index + 1}'
        meta = FileMetaDataset()
        meta.TransferSyntaxUID = ExplicitVRLittleEndian
        meta.MediaStorageSOPClassUID = CTImageStorage
        meta.MediaStorageSOPInstanceUID = uid
        meta.ImplementationClassUID = '1.2.826.0.1.3680043.10.543'
        ds = FileDataset('', {}, file_meta=meta, preamble=b'\0' * 128)
        ds.SOPInstanceUID, ds.SOPClassUID = uid, CTImageStorage
        ds.SeriesInstanceUID = '1.2.826.0.1.3680043.10.543.20260923.10'
        ds.StudyInstanceUID = '1.2.826.0.1.3680043.10.543.20260923.20'
        ds.Modality, ds.Rows, ds.Columns = 'CT', 4, 4
        ds.BitsAllocated, ds.BitsStored, ds.HighBit = 16, 12, 11
        ds.PixelRepresentation, ds.SamplesPerPixel = signed, 1
        ds.PhotometricInterpretation = 'MONOCHROME2'
        ds.RescaleSlope, ds.RescaleIntercept = slope, intercept
        ds.PixelSpacing, ds.ImageOrientationPatient = [1, 1], [1, 0, 0, 0, 1, 0]
        ds.ImagePositionPatient = [0, 0, index]
        ds.PixelData = struct.pack('<' + ('h' if signed else 'H') * 16, *values)
        path = folder / f'known-{index}.dcm'
        ds.save_as(path, enforce_file_format=True)
        np.testing.assert_array_equal(ds.pixel_array.ravel(), values)
        result = reference(path)
        # Additional scalar known-value check independent of the NumPy vector expression.
        expected = bytearray()
        for value in values:
            gray = int(255 * max(0, min(1, (value * slope + intercept + 160) / 400)))
            expected.extend([gray, gray, gray, 255])
        assert sha(expected) == result['rgba_sha256']
        records.append({'relative_path': str(path.relative_to(ROOT)), 'sha256': sha(path.read_bytes()),
                        'rows': 4, 'columns': 4, 'rescale_slope': slope, 'rescale_intercept': intercept,
                        **result, 'known_stored_values': values})
    return records


def window_hashes(path):
    ds = pydicom.dcmread(path)
    scaled = ds.pixel_array.astype(np.float32) * np.float32(ds.RescaleSlope) + np.float32(ds.RescaleIntercept)
    hashes = []
    for index in range(40):
        center, width = 40 + index, 400 + index * 4
        lower = np.float32(center - width / 2)
        gray = np.floor(np.clip((scaled - lower) / np.float32(width), 0, 1) * np.float32(255)).astype(np.uint8)
        rgba = np.empty((*gray.shape, 4), dtype=np.uint8)
        rgba[..., :3] = gray[..., None]
        rgba[..., 3] = 255
        hashes.append(sha(rgba.tobytes()))
    return hashes


if __name__ == '__main__':
    manifest = json.loads((ROOT / 'manifests/dataset.json').read_text())
    result = {'pydicom': pydicom.__version__, 'numpy': np.__version__,
              'contract': 'int32le stored; float32 rescale; C40 W400 floor uint8 RGBA',
              'instances': [reference(ROOT / entry['relative_path']) for entry in manifest['instances']],
              'fixtures': fixtures()}
    result['instances'][0]['window_rgba_sha256'] = window_hashes(ROOT / manifest['instances'][0]['relative_path'])
    result['fixtures'][0]['window_rgba_sha256'] = window_hashes(ROOT / result['fixtures'][0]['relative_path'])
    frozen = json.loads((ROOT / 'manifests/reference.json').read_text())
    for field in ('instances', 'fixtures'):
        if result[field] != frozen[field]:
            raise ValueError(f'Recomputed {field} differ from the frozen numerical reference')
    (ROOT / 'data/reference.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f"Verified {len(result['instances'])} public images and {len(result['fixtures'])} known-value fixtures")
