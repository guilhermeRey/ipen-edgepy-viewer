"""Summarize a complete new collection; never substitute or discard failed runs."""

import argparse
from collections import Counter
import csv
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

PIPELINES = [("pyscript", "Python/PyScript (pydicom)", "#0072B2", "o"),
             ("cornerstone", "Cornerstone (configuração do produto)", "#D55E00", "D")]


def read_measurements(path):
    runs = json.loads(path.read_text())
    phases = Counter(run["phase"] for run in runs)
    if phases != {"fixture": 2, "rehearsal": 6, "measured": 20}:
        raise ValueError("Require two fixture runs, six rehearsals and twenty measured runs")
    if any(run["status"] != "ok" or run["validation_errors"] for run in runs):
        raise ValueError("Collection contains failed or incorrect runs; no success summary")
    rows = []
    for run in runs:
        if run["phase"] != "measured":
            continue
        observations = [obs for obs in run["observations"]
                        if obs["operation_id"] == "decode-all" and obs["metric"] == "decode_all_ms"]
        if len(observations) != 1:
            raise ValueError(f"Missing or duplicated decode observation: {run['run_id']}")
        obs = observations[0]
        if (obs["status"] != "ok" or obs["unit"] != "ms"
                or not all(math.isfinite(obs[key]) for key in ("start", "end", "value"))
                or obs["value"] <= 0
                or not math.isclose(obs["end"] - obs["start"], obs["value"], abs_tol=1e-6)):
            raise ValueError(f"Invalid timing observation: {run['run_id']}")
        rows.append({"run_id": run["run_id"], "size": run["size"], "block": run["block"],
                     "pipeline": run["pipeline"], "decode_all_ms": obs["value"]})
    expected = {(size, block, pipeline) for size in (32, 123) for block in range(1, 6)
                for pipeline, *_ in PIPELINES}
    if {(r["size"], r["block"], r["pipeline"]) for r in rows} != expected:
        raise ValueError("Require five distinct complete pairs for each image count")
    if len({r["run_id"] for r in runs}) != len(runs):
        raise ValueError("Duplicated run identifiers")
    return rows


def summarize(rows):
    summaries = []
    for size in (32, 123):
        by_pipeline = {pipeline: {r["block"]: r["decode_all_ms"] for r in rows
                                  if r["size"] == size and r["pipeline"] == pipeline}
                       for pipeline, *_ in PIPELINES}
        ratio = statistics.median(by_pipeline["cornerstone"][b] / by_pipeline["pyscript"][b]
                                  for b in range(1, 6))
        summaries.append({
            "size": size, "metric": "decode_all_ms", "pairs": 5,
            **{p: {"median_ms": statistics.median(v.values()), "min_ms": min(v.values()),
                   "max_ms": max(v.values())} for p, v in by_pipeline.items()},
            "median_paired_ratio_c_over_p": ratio, "paired_reduction_percent": 100 * (1 - ratio),
        })
    return summaries


def plot(rows, output):
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11,
                         "svg.hashsalt": "edgepy-leitura-dicom-portable-1"})
    figure, axis = plt.subplots(figsize=(7.6, 4.7))
    maximum = max(row["decode_all_ms"] for row in rows)
    for group, size in enumerate((32, 123)):
        for index, (pipeline, _label, color, marker) in enumerate(PIPELINES):
            selected = sorted((r for r in rows if r["size"] == size and r["pipeline"] == pipeline),
                              key=lambda r: r["block"])
            values = [r["decode_all_ms"] for r in selected]
            center = group + (-0.17 if index == 0 else 0.17)
            axis.vlines(center, min(values), max(values), color=color, alpha=0.5)
            axis.scatter([center + (i - 2) * 0.027 for i in range(5)], values,
                         marker=marker, facecolors="white", edgecolors=color, s=40, zorder=3)
            median = statistics.median(values)
            axis.hlines(median, center - 0.1, center + 0.1, color=color, linewidth=2.5, zorder=4)
            axis.text(center, max(values) + maximum * 0.04, f"{median:.1f}".replace(".", ","),
                      ha="center", color=color, weight="bold")
    axis.set(ylabel="Tempo de leitura e decodificação (ms)", ylim=(0, maximum * 1.2), xlim=(-0.5, 1.5))
    axis.set_xticks([0, 1], ["32 imagens", "123 imagens"])
    axis.set_axisbelow(True)
    axis.grid(axis="y", color="#dddddd", linewidth=0.7)
    axis.spines[["top", "right"]].set_visible(False)
    handles = [Line2D([], [], color=color, marker=marker, markerfacecolor="white", label=label)
               for _pipeline, label, color, marker in PIPELINES]
    figure.legend(handles=handles, loc="upper center", frameon=False, fontsize=10)
    figure.text(0.5, 0.035, "Nova coleta: cinco execuções por condição; traços e números: medianas.",
                ha="center", fontsize=9)
    figure.subplots_adjust(left=0.12, right=0.98, bottom=0.16, top=0.82)
    for extension in ("png", "svg"):
        figure.savefig(output / f"leitura-dicom.{extension}", dpi=200,
                       metadata={"Date": None} if extension == "svg" else None, facecolor="white")
    plt.close(figure)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("results", type=Path, help="Directory containing runs.json and environment.json")
    folder = parser.parse_args().results.resolve()
    rows = read_measurements(folder / "runs.json")
    summary = summarize(rows)
    environment = json.loads((folder / "environment.json").read_text())
    with (folder / "measurements.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    provenance = {"kind": "new_collection", "measured_runs": len(rows), "summary": summary,
                  "runs_sha256": hashlib.sha256((folder / "runs.json").read_bytes()).hexdigest(),
                  "analysis_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  "python": sys.version.split()[0], "matplotlib": matplotlib.__version__}
    (folder / "summary.json").write_text(json.dumps(provenance, indent=2) + "\n")
    plot(rows, folder)
    lines = ["# Leitura DICOM — nova coleta", "",
             f"Início (UTC): {environment['created_at_utc']}. Navegador: {environment['browser']['product']}.", "",
             "28 execuções válidas: duas verificações sintéticas, seis preparatórias e vinte medidas.", "",
             "| Imagens | Python: mediana [mín.–máx.] ms | Cornerstone: mediana [mín.–máx.] ms | Razão C/P pareada |",
             "|---|---|---|---|"]
    for item in summary:
        def interval(pipeline):
            values = item[pipeline]
            return f"{values['median_ms']:.2f} [{values['min_ms']:.2f}–{values['max_ms']:.2f}]"
        lines.append(f"| {item['size']} | {interval('pyscript')} | {interval('cornerstone')} | {item['median_paired_ratio_c_over_p']:.3f} |")
    lines += ["", "Os tempos pertencem a esta execução e não substituem os resultados históricos da dissertação.",
              "As cinco repetições são técnicas, não pacientes independentes. Extremos não são intervalos de confiança.",
              "Download e inicialização Python ficam fora da medição; a primeira leitura Cornerstone pode iniciar seu worker.",
              "As operações de Canvas posteriores, preservadas em runs.json, não medem o renderizador nativo Cornerstone.",
              "", "Dados: Mackin et al. (2017), CC-Radiomics-Phantom, TCIA, CC BY 3.0.",
              "https://doi.org/10.7937/K9/TCIA.2017.zuzrml5b", ""]
    (folder / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
