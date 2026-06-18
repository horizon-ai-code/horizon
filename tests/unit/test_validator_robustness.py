import unittest

from app.modules.validator import RefactorVerifier, Validator


class TestValidatorRobustness(unittest.TestCase):
    def setUp(self):
        self.validator = Validator()

    def test_extract_multiple_constants(self):
        # Case: Extracting 3 magic numbers into 3 constants at once
        orig = """
        public class Config {
            public void setup() {
                int timeout = 5000;
                int retries = 3;
                String mode = "DEBUG";
            }
        }
        """
        refac = """
        public class Config {
            public static final int TIMEOUT = 5000;
            public static final int RETRIES = 3;
            public static final String MODE = "DEBUG";
            
            public void setup() {
                int timeout = TIMEOUT;
                int retries = RETRIES;
                String mode = MODE;
            }
        }
        """
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]

        success, msg = RefactorVerifier.verify_extract_constant(orig_ast, refac_ast)
        self.assertTrue(success, f"Expected success for multiple constants, got: {msg}")

    def test_extract_method_with_helper_enum(self):
        # Case: Refactoring a method by adding an enum and a helper method
        # This often fails Tier 2-B Boundary check if target_scope is only "getStatusMessage"
        orig = """
        public class OrderTracker {
            public String getStatusMessage(int s) {
                if (s == 0) return "Placed";
                return "Unknown";
            }
        }
        """
        refac = """
        public class OrderTracker {
            private enum Status {
                PLACED("Placed");
                private String msg;
                Status(String m) { this.msg = m; }
                public String getMsg() { return msg; }
            }
            public String getStatusMessage(int s) {
                if (s == 0) return Status.PLACED.getMsg();
                return "Unknown";
            }
        }
        """
        # Manual boundary check simulation
        finding = self.validator.verify_boundary(orig, refac, ["getStatusMessage"])
        self.assertIsNone(finding, f"Expected no boundary violation for adding helper structures, got: {finding.error_report.message if finding else ''}")

    def test_extract_variable_multiple(self):
        # Case: Extracting multiple variables
        orig = "class A { void m() { doX(a.b(), c.d()); } }"
        refac = "class A { void m() { Object b = a.b(); Object d = c.d(); doX(b, d); } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_extract_variable(orig_ast, refac_ast)
        self.assertTrue(success, f"Expected success for multiple variables, got: {msg}")

if __name__ == "__main__":
    unittest.main()
