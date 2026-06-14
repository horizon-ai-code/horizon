"""Verification tests for schemas.py changes.

Covers: Pydantic v2 ConfigDict, insights type annotation,
        ASTMutationDetails scope field for ADD_DECLARATION.
"""

import unittest
from datetime import datetime
from uuid import uuid4

from app.utils.schemas import ASTMutation, ASTMutationDetails, HistoryDetail, LogEntry, ScopeAnchor
from app.utils.types import DeclarationScope, MutationAction, Role


class TestScopeAnchorClassAlias(unittest.TestCase):
    def test_scope_anchor_class_alias(self):
        """ScopeAnchor accepts 'class' as an alias for target_class."""
        anchor = ScopeAnchor(**{"class": "MyClass", "unit_type": "METHOD_UNIT"})  # type: ignore
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


class TestMutationDetailsScope(unittest.TestCase):
    def test_scope_field_exists(self):
        """ASTMutationDetails accepts scope: DeclarationScope."""
        details = ASTMutationDetails(
            type="boolean",
            scope=DeclarationScope.LOCAL,
            value="true",
        )
        self.assertEqual(details.scope, DeclarationScope.LOCAL)

    def test_scope_nullable(self):
        """ASTMutationDetails scope is None by default."""
        details = ASTMutationDetails(type="boolean")
        self.assertIsNone(details.scope)

    def test_mutation_with_add_declaration(self):
        """Full mutation using ADD_DECLARATION with scope."""
        details = ASTMutationDetails(
            type="boolean",
            scope=DeclarationScope.LOCAL,
            body_abstract="Declare local boolean variable",
        )
        mutation = ASTMutation(
            action=MutationAction.ADD_DECLARATION,
            target="isMatch",
            details=details,
        )
        self.assertEqual(mutation.action, MutationAction.ADD_DECLARATION)
        self.assertEqual(mutation.details.scope, DeclarationScope.LOCAL)
