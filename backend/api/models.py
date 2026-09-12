"""Request validation mirrors the existing JSON contracts; wire keys stay unchanged."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SupplierId = Annotated[str, Field(pattern=r"^sup_[0-9]{3}$")]


class ContractModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Event(ContractModel):
    id: Annotated[str, Field(pattern=r"^evt_[0-9]{3}$")]
    type: Literal["weather", "financial", "compliance", "geopolitical"]
    description: str
    affected_location: str
    severity: Literal["low", "medium", "high"]
    timestamp: str

    @field_validator("timestamp")
    @classmethod
    def timestamp_is_datetime(cls, value: str) -> str:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00").replace("z", "+00:00"))
        if parsed.tzinfo is None or "t" not in value.lower():
            raise ValueError("timestamp must be an ISO 8601 date-time with a timezone")
        return value


class AnalysisResult(ContractModel):
    event: Event
    directly_affected: list[SupplierId]
    cascading_affected: list[SupplierId]
    risk_summary: str
    draft_report: str

    @model_validator(mode="after")
    def affected_sets_do_not_overlap(self):
        if set(self.directly_affected) & set(self.cascading_affected):
            raise ValueError("directly_affected and cascading_affected must not overlap")
        return self


class AnalyzeRequest(ContractModel):
    event_id: Annotated[str, Field(pattern=r"^evt_[0-9]{3}$")]


class DraftRequest(ContractModel):
    analysis_result: AnalysisResult
