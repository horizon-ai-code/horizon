"""Tests for AgentService static helpers and exception."""
import unittest

from app.modules.agent_service import InterruptedError


class TestInterruptedError(unittest.TestCase):
    def test_is_exception_subclass(self):
        self.assertTrue(issubclass(InterruptedError, Exception))

    def test_can_be_raised_and_caught(self):
        with self.assertRaises(InterruptedError):
            raise InterruptedError()

    def test_message_preserved(self):
        with self.assertRaises(InterruptedError) as ctx:
            raise InterruptedError("stop signal")
        self.assertIn("stop", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
