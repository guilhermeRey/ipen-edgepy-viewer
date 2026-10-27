import numpy as np


class NumpyRgbaSliceMapper:
    """Converte arrays 2D normalizados (0-255) para payload RGBA."""

    def to_rgba(self, normalized_slice) -> tuple[bytes, int, int]:
        array = np.asarray(normalized_slice)
        if array.ndim != 2:
            raise ValueError("to_rgba espera um array 2D.")

        gray = np.clip(array, 0, 255).astype(np.uint8)
        height, width = gray.shape

        rgba = np.empty((height, width, 4), dtype=np.uint8)
        rgba[..., 0] = gray
        rgba[..., 1] = gray
        rgba[..., 2] = gray
        rgba[..., 3] = 255
        return rgba.tobytes(), width, height
