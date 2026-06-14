import unittest
from pydantic import ValidationError
from app.utils.types import DeclarationScope, HaltRequest, MutationAction


class TestTypes(unittest.TestCase):
    def test_halt_request_valid(self):
        """Test that HaltRequest can be instantiated with valid data."""
        data = {"type": "halt"}
        halt_req = HaltRequest(**data)
        self.assertEqual(halt_req.type, "halt")

    def test_halt_request_invalid_type(self):
        """Test that HaltRequest fails with an invalid type."""
        data = {"type": "not_halt"}
        with self.assertRaises(ValidationError):
            HaltRequest(**data)

    def test_halt_request_missing_type(self):
        """Test that HaltRequest fails if 'type' is missing."""
        data = {}
        with self.assertRaises(ValidationError):
            HaltRequest(**data)

    def test_mutation_action_has_new_types(self):
        """Verify ADD_DECLARATION and SPLIT_BODY are valid MutationAction values."""
        self.assertEqual(MutationAction.ADD_DECLARATION.value, "ADD_DECLARATION")
        self.assertEqual(MutationAction.SPLIT_BODY.value, "SPLIT_BODY")
        # Verify backward compat — old types still exist
        self.assertEqual(MutationAction.ADD_FIELD.value, "ADD_FIELD")

    def test_mutation_action_from_string(self):
        """Verify new types can be constructed from string."""
        self.assertEqual(MutationAction("ADD_DECLARATION"), MutationAction.ADD_DECLARATION)
        self.assertEqual(MutationAction("SPLIT_BODY"), MutationAction.SPLIT_BODY)

    def test_declaration_scope_values(self):
        """Test DeclarationScope enum values."""
        self.assertEqual(DeclarationScope.LOCAL.value, "local")
        self.assertEqual(DeclarationScope.FIELD.value, "field")
        self.assertEqual(DeclarationScope.STATIC_FINAL.value, "static_final")

    def test_declaration_scope_from_string(self):
        """Test DeclarationScope construction from string."""
        self.assertEqual(DeclarationScope("local"), DeclarationScope.LOCAL)
        self.assertEqual(DeclarationScope("field"), DeclarationScope.FIELD)
        self.assertEqual(DeclarationScope("static_final"), DeclarationScope.STATIC_FINAL)


if __name__ == '__main__':
    unittest.main()
