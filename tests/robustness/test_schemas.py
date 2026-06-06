"""Verification tests for schemas.py changes.

Covers: Pydantic v2 ConfigDict, insights type annotation.
"""
import unittest
from datetime import datetime
from uuid import uuid4
from app.utils.schemas import ScopeAnchor, HistoryDetail, LogEntry
from app.utils.types import Role


class TestScopeAnchorClassAlias(unittest.TestCase):
    def test_scope_anchor_class_alias(self):
        """ScopeAnchor accepts 'class' as an alias for target_class."""
        anchor = ScopeAnchor(**{"class": "MyClass", "unit_type": "METHOD_UNIT"})
        self.assertEqual(anchor.target_class, "MyClass")


class TestHistoryDetailInsightsType(unittest.TestCase):
    def test_history_detail_insights_type(self):
        """HistoryDetail.insights is typed as Optional[str]."""
        detail = HistoryDetail(
            id=uuid4(),
            user_instruction="test",
            original_code="code",
            insights='[{"title": "T", "details": "D"}]',
            created_at=datetime.now(),
            logs=[LogEntry(role=Role.System, status="test", created_at=datetime.now())],
        )
        self.assertIsInstance(detail.insights, str)
