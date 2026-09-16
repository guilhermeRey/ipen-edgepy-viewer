import math

from pycom_agent import AgentDescriptor, AgentResult, PycomAgent


class DoseStatisticsAgent(PycomAgent):
    def describe(self):
        return AgentDescriptor(
            name="dose-statistics",
            version="0.1.0",
            capabilities=("dose-volume", "mhd-raw", "statistics"),
            display_name="Dose Statistics",
            description="Computes basic statistics from a real MHD/RAW dose volume.",
            requires_human_validation=True,
        )

    def process(self, context, input):
        dose_volume = (input or {}).get("doseVolume") or {}
        if not dose_volume:
            return AgentResult(
                type="dose-statistics",
                status="error",
                result={"message": "No MHD/RAW dose volume was provided."},
            )

        try:
            from builtins import edgepy_dose_values
        except ImportError:
            from js import edgepy_dose_values

        stats = dose_statistics(edgepy_dose_values)
        return AgentResult(
            type="dose-statistics",
            result={
                "label": dose_volume.get("label"),
                "dimensions": dose_volume.get("dimensions"),
                "spacing": dose_volume.get("spacing"),
                "offset": dose_volume.get("offset"),
                "valueCount": dose_volume.get("valueCount"),
                **stats,
            },
            warnings=("Experimental result; validate before clinical use.",),
        )


def dose_statistics(values):
    count = int(values.length)
    finite_count = 0
    positive_count = 0
    total = 0.0
    min_value = math.inf
    max_value = -math.inf
    sample = []
    stride = max(1, count // 100000)

    for index in range(count):
        value = float(values[index])
        if not math.isfinite(value):
            continue
        finite_count += 1
        total += value
        min_value = min(min_value, value)
        max_value = max(max_value, value)
        if value > 0:
            positive_count += 1
        if index % stride == 0:
            sample.append(value)

    sample.sort()
    return {
        "finiteCount": finite_count,
        "positiveCount": positive_count,
        "min": min_value if finite_count else None,
        "max": max_value if finite_count else None,
        "mean": total / finite_count if finite_count else None,
        "sampledP50": percentile(sample, 0.50),
        "sampledP95": percentile(sample, 0.95),
        "sampledP99": percentile(sample, 0.99),
    }


def percentile(values, fraction):
    if not values:
        return None
    index = round((len(values) - 1) * fraction)
    return values[max(0, min(len(values) - 1, index))]


agent = DoseStatisticsAgent()


def describe():
    return agent.describe().to_dict()


def process(context, input):
    return agent.process(context, input).to_dict()
