"""Regression checks for accepting complete paired evidence only."""

import json
from pathlib import Path
import tempfile
import unittest

from analyze import read_measurements, summarize


class AnalysisContract(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / "runs.json"
        self.runs = [{"run_id": f"fixture-{i}", "phase": "fixture", "status": "ok", "validation_errors": []} for i in range(2)]
        self.runs += [{"run_id": f"rehearsal-{i}", "phase": "rehearsal", "status": "ok", "validation_errors": []} for i in range(6)]
        for size in (32, 123):
            for block in range(1, 6):
                for pipeline, multiplier in (("pyscript", 2), ("cornerstone", 1)):
                    value = size * block * multiplier
                    self.runs.append({"run_id": f"{size}-{block}-{pipeline}", "phase": "measured",
                                      "status": "ok", "validation_errors": [], "size": size,
                                      "block": block, "pipeline": pipeline,
                                      "observations": [{"operation_id": "decode-all", "metric": "decode_all_ms",
                                                        "status": "ok", "unit": "ms", "start": 10,
                                                        "end": 10 + value, "value": value}]})

    def read(self):
        self.path.write_text(json.dumps(self.runs))
        return read_measurements(self.path)

    def test_complete_pairs_have_known_medians_and_ratios(self):
        result = summarize(self.read())
        self.assertEqual(result[0]["pyscript"]["median_ms"], 192)
        self.assertEqual(result[0]["cornerstone"]["median_ms"], 96)
        self.assertEqual(result[1]["median_paired_ratio_c_over_p"], 0.5)

    def test_incomplete_collection_is_rejected(self):
        self.runs.pop()
        with self.assertRaises(ValueError):
            self.read()

    def test_failed_measurement_is_not_silently_excluded(self):
        self.runs[-1]["status"] = "incorrect"
        with self.assertRaises(ValueError):
            self.read()

    def test_failed_fixture_invalidates_collection(self):
        self.runs[0]["validation_errors"] = [{"field": "raw_i32_sha256"}]
        with self.assertRaises(ValueError):
            self.read()

    def test_duplicate_pair_does_not_replace_missing_pair(self):
        self.runs[-1]["block"] = 4
        with self.assertRaises(ValueError):
            self.read()

    def test_invalid_clock_interval_is_rejected(self):
        self.runs[-1]["observations"][0]["end"] = 11
        with self.assertRaises(ValueError):
            self.read()


if __name__ == "__main__":
    unittest.main()
