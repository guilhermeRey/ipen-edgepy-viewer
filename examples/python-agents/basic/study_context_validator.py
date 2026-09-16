from pycom_agent import AgentDescriptor, AgentResult, PycomAgent


class StudyContextValidatorAgent(PycomAgent):
    def describe(self):
        return AgentDescriptor(
            name="study-context-validator",
            version="0.1.0",
            capabilities=("viewer-context", "validation"),
            display_name="Study Context Validator",
            description="Validates basic fields from the current EdgePy Viewer snapshot.",
            requires_human_validation=False,
        )

    def process(self, context, input):
        study = context.get("study") or {}
        fusion = context.get("fusionContext") or {}
        checks = {
            "hasStudyUid": bool(study.get("uid")),
            "hasActiveSeries": bool(context.get("activeSeriesUid")),
            "hasFusionStatus": bool(fusion.get("status")),
            "activeSliceIndex": context.get("activeSliceIndex"),
            "visibleLayerCount": len(context.get("visibleLayers") or []),
        }
        return AgentResult(
            type="study-context-validation",
            status="ok" if checks["hasStudyUid"] and checks["hasActiveSeries"] and checks["hasFusionStatus"] else "warning",
            result=checks,
            metadata={"input": input},
        )


agent = StudyContextValidatorAgent()
