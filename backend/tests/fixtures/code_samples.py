"""Reusable Java code samples for validator, AST matcher, and formatter tests."""

CLASS_WITH_CONDITIONALS = """class A {
    void m() {
        if (a) {
            doSomething();
        }
        if (b) {
            doOther();
        }
    }
}"""

CLASS_NO_METHODS = "class A { int x; }"

CLASS_MULTI_METHOD = """class A {
    void setup() { init(); }
    int calculate() { return 42; }
    void teardown() { cleanup(); }
}"""

NESTED_IF = """class A {
    void m() {
        if (a) {
            if (b) {
                doWork();
            }
        }
    }
}"""

FLATTENED_IF = """class A {
    void m() {
        if (!a) return;
        if (!b) return;
        doWork();
    }
}"""

UNCLOSED_BRACE = "class A { void m() { "

EMPTY_INPUT = ""

WHITESPACE_INPUT = "   \n  "

BARE_STATEMENT = "int x = 1;"

BARE_METHOD = "void m() { return; }"
