from pycom_agent import AgentDescriptor, AgentResult, PycomAgent


class ViewerContextSummaryAgent(PycomAgent):
    def describe(self):
        return AgentDescriptor(
            name="viewer-context-summary",
            version="0.1.0",
            capabilities=("viewer-context", "diagnostics"),
            display_name="Viewer Context Summary",
            description="Summarizes the active EdgePy Viewer context.",
            requires_human_validation=False,
        )

    def process(self, context, input):
        study = context.get("study") or {}
        fusion = context.get("fusionContext") or {}
        return AgentResult(
            type="viewer-context-summary",
            result={
                "studyUid": study.get("uid"),
                "activeScanId": context.get("activeScanId"),
                "activeSeriesUid": context.get("activeSeriesUid"),
                "activeSliceIndex": context.get("activeSliceIndex"),
                "fusionStatus": fusion.get("status"),
                "visibleLayerCount": len(context.get("visibleLayers") or []),
                "input": input,
            },
        )


agent = ViewerContextSummaryAgent()


def describe():
    return agent.describe().to_dict()


def process(context, input):
    return agent.process(context, input).to_dict()
