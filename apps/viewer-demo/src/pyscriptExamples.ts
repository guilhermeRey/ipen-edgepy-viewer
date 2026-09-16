export interface PyScriptEditorExample {
  id: string;
  label: string;
  description: string;
  includeDose: boolean;
  code: string;
}

export const PYSCRIPT_EDITOR_EXAMPLES: readonly PyScriptEditorExample[] = [
  {
    id: "threshold-mask",
    label: "Threshold mask",
    description: "Calcula estatísticas do slice atual e cria uma máscara 2D temporária.",
    includeDose: false,
    code: `# edgepy_image_values is a typed array transferred to this PyScript worker.
if edgepy_image_values is None:
    raise ValueError("No active image slice is available.")

values = [float(value) for value in edgepy_image_values]
minimum = min(values)
maximum = max(values)
threshold = minimum + (maximum - minimum) * 0.65
mask = [1.0 if value >= threshold else 0.0 for value in values]

result = {
    "type": "image-mask",
    "status": "completed",
    "summary": {
        "width": edgepy_input["image"]["width"],
        "height": edgepy_input["image"]["height"],
        "minimum": minimum,
        "maximum": maximum,
        "mean": sum(values) / len(values),
        "threshold": threshold,
        "selectedPixels": sum(mask),
    },
    "overlay": {
        "id": "pyscript-threshold",
        "label": "PyScript threshold",
        "color": "#2be3d2",
        "opacity": 0.55,
        "width": edgepy_input["image"]["width"],
        "height": edgepy_input["image"]["height"],
        "sliceIndex": edgepy_input["image"]["sliceIndex"],
        "values": mask,
    },
}`,
  },
  {
    id: "image-summary",
    label: "Image summary",
    description: "Resume pixels e contexto do slice ativo sem alterar o viewport.",
    includeDose: false,
    code: `if edgepy_image_values is None:
    raise ValueError("No active image slice is available.")

values = [float(value) for value in edgepy_image_values]
result = {
    "type": "image-summary",
    "status": "completed",
    "summary": {
        "study": edgepy_context["study"]["label"],
        "sliceIndex": edgepy_input["image"]["sliceIndex"],
        "pixelCount": len(values),
        "minimum": min(values),
        "maximum": max(values),
        "mean": sum(values) / len(values),
    },
}`,
  },
  {
    id: "dose-statistics",
    label: "Dose statistics",
    description: "Lê o volume MHD/RAW visível e calcula estatísticas dentro do worker PyScript.",
    includeDose: true,
    code: `import math

if edgepy_dose_values is None:
    raise ValueError("No MHD/RAW dose volume is available.")

finite = []
positive_count = 0
for item in edgepy_dose_values:
    value = float(item)
    if math.isfinite(value):
        finite.append(value)
        if value > 0:
            positive_count += 1

result = {
    "type": "dose-statistics",
    "status": "completed",
    "summary": {
        "label": edgepy_input["doseVolume"]["label"],
        "dimensions": edgepy_input["doseVolume"]["dimensions"],
        "valueCount": len(edgepy_dose_values),
        "finiteCount": len(finite),
        "positiveCount": positive_count,
        "minimum": min(finite) if finite else None,
        "maximum": max(finite) if finite else None,
        "mean": sum(finite) / len(finite) if finite else None,
    },
}`,
  },
];
