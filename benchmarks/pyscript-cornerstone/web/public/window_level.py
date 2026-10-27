import numpy as np


DEFAULT_PRESETS = {
    "Padrão": (127.5, 255.0),
    "Contraste": (127.5, 140.0),
}

MODALITY_PRESETS = {
    "CT": {
        "Tecido Mole": (110.0, 120.0),
        "Pulmão": (90.0, 200.0),
        "Osso": (150.0, 180.0),
    },
    "PT": {
        "PET Suave": (90.0, 140.0),
        "PET Alto": (140.0, 120.0),
    },
    "MG": {
        "Mamografia": (140.0, 110.0),
        "Microcalcificação": (180.0, 90.0),
    },
}


def get_presets_for_modality(modality):
    merged = dict(DEFAULT_PRESETS)
    key = f"{modality or ''}".strip().upper()
    merged.update(MODALITY_PRESETS.get(key, {}))
    return merged


def apply_window_level(array, center, width):
    data = np.asarray(array, dtype=np.float32)
    wl_width = max(1.0, float(width or 1.0))
    wl_center = float(center or 127.5)

    lower = wl_center - (wl_width / 2.0)
    upper = wl_center + (wl_width / 2.0)
    clipped = np.clip(data, lower, upper)
    normalized = (clipped - lower) / max(1e-6, upper - lower)
    return normalized * 255.0


def apply_orientation(array, flip_horizontal=False, flip_vertical=False, rotation=0):
    result = np.asarray(array)
    if flip_horizontal:
        result = np.fliplr(result)
    if flip_vertical:
        result = np.flipud(result)

    turns = int((rotation or 0) / 90) % 4
    if turns:
        result = np.rot90(result, k=-turns)
    return result
