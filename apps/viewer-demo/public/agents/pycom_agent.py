from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class AgentDescriptor:
    name: str
    version: str
    capabilities: Sequence[str] = field(default_factory=tuple)
    display_name: str = ""
    description: str = ""
    requires_human_validation: bool = True
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self):
        payload = {
            "name": self.name,
            "version": self.version,
            "capabilities": list(self.capabilities or ()),
            "requiresHumanValidation": self.requires_human_validation,
        }
        if self.display_name:
            payload["displayName"] = self.display_name
        if self.description:
            payload["description"] = self.description
        if self.metadata:
            payload["metadata"] = dict(self.metadata)
        return payload


@dataclass(frozen=True)
class AgentResult:
    type: str
    status: str = "ok"
    result: Any = None
    metadata: Mapping[str, Any] = field(default_factory=dict)
    warnings: Sequence[str] = field(default_factory=tuple)

    def to_dict(self):
        payload = {
            "type": self.type,
            "status": self.status,
            "result": self.result,
        }
        if self.metadata:
            payload["metadata"] = dict(self.metadata)
        if self.warnings:
            payload["warnings"] = list(self.warnings)
        return payload


class PycomAgent(ABC):
    @abstractmethod
    def describe(self) -> AgentDescriptor:
        raise NotImplementedError

    @abstractmethod
    def process(self, context: Mapping[str, Any], input: Any) -> AgentResult | Mapping[str, Any]:
        raise NotImplementedError


def to_plain(value):
    if hasattr(value, "to_dict"):
        return to_plain(value.to_dict())
    if isinstance(value, Mapping):
        return {key: to_plain(item) for key, item in value.items()}
    if isinstance(value, tuple) or isinstance(value, list):
        return [to_plain(item) for item in value]
    return value
