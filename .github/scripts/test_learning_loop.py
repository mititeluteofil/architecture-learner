"""Tests for learning_loop.py stack dispatch. Stdlib only: `python -m unittest` from .github/scripts."""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import learning_loop as ll  # noqa: E402

CI = {
    "java": ('test_glob: "/src/test/java/.+\\\\.(java|kt)$"\n  test_cmd: "mvn -B test"\n'
             "  setup: java\n  manifest: pom.xml"),
    "python": ("test_glob: '(^|/)tests/.+\\.py$'\n  test_cmd: 'uv run --directory {dir} pytest -q'\n"
               "  setup: python\n  manifest: pyproject.toml"),
    "node": ('test_glob: "\\\\.test\\\\.(ts|js)$"\n  test_cmd: "npm --prefix {dir} test"\n'
             "  setup: node\n  manifest: package.json"),
    "dotnet": ('test_glob: "Tests?/.+\\\\.cs$"\n  test_cmd: "dotnet test {dir}"\n'
               "  setup: dotnet\n  manifest: \"*.sln\""),
    "ruby": ('test_glob: "(^|/)spec/.+_spec\\\\.rb$"\n  test_cmd: "bundle exec rspec"\n'
             "  setup: ruby\n  manifest: Gemfile"),
}

STACK_YAML = """id: {id}
name: {id}
marker:
  comment: '# LEARNER: <hint>'   # a comment after a value
layout:
  manifest: x
ci:
  {ci}
tooling:
  test: whatever
"""


def write(root, rel, text=""):
    path = os.path.join(root, *rel.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


class Fixture(unittest.TestCase):
    with_ci = True

    def setUp(self):
        self.root = tempfile.mkdtemp()
        self._old_root = ll.ROOT
        ll.ROOT = self.root
        for stack, ci in CI.items():
            body = STACK_YAML.format(id=stack, ci=ci) if self.with_ci else STACK_YAML.split("ci:")[0] + "tooling:\n  test: x\n"
            write(self.root, f"stacks/{stack}/stack.yaml", body)
            write(self.root, f"stacks/{stack}/achievements.json", json.dumps(
                {"definitions": [{"id": f"{stack}-only", "scope": "stack", "stack": stack, "xp": 10}]}))

    def tearDown(self):
        ll.ROOT = self._old_root
        shutil.rmtree(self.root, ignore_errors=True)


class YamlSubset(unittest.TestCase):
    def test_nested_quotes_and_comments(self):
        data = ll.parse_yaml_subset(STACK_YAML.format(id="python", ci=CI["python"]))
        self.assertEqual(data["marker"]["comment"], "# LEARNER: <hint>")
        self.assertEqual(data["ci"]["test_cmd"], "uv run --directory {dir} pytest -q")
        self.assertEqual(data["ci"]["test_glob"], r"(^|/)tests/.+\.py$")
        self.assertEqual(data["tooling"]["test"], "whatever")

    def test_double_quoted_escape(self):
        data = ll.parse_yaml_subset('ci:\n  test_glob: "\\\\.test\\\\.ts$"\n')
        self.assertEqual(data["ci"]["test_glob"], r"\.test\.ts$")

    def test_tolerates_lists_flow_and_block_scalars(self):
        data = ll.parse_yaml_subset("a:\n  - x\n  - y\nb: { k: v }\nc: |\n  line1\n  line2\nd: 1\n")
        self.assertEqual(data["c"], "line1\nline2")
        self.assertEqual(data["d"], "1")
        self.assertEqual(data["b"], "{ k: v }")


class StackDetection(Fixture):
    def test_each_stack_from_path(self):
        cases = {
            "java": "projects/p2-x/java/src/test/java/com/acme/LoanTest.java",
            "python": "projects/p2-x/python/tests/test_loan.py",
            "node": "projects/p2-x/node/src/loan.test.ts",
            "dotnet": "projects/p2-x/dotnet/LoanTests/LoanTests.cs",
            "ruby": "projects/p2-x/ruby/spec/loan_spec.rb",
        }
        for stack, path in cases.items():
            with self.subTest(stack=stack):
                self.assertEqual(ll.detect_stack(path), (stack, f"projects/p2-x/{stack}"))
                self.assertTrue(ll.is_test_file(stack, path), path)
        self.assertFalse(ll.is_test_file("python", "projects/p2-x/python/src/loan.py"))
        self.assertFalse(ll.is_test_file("ruby", "projects/p2-x/ruby/lib/loan.rb"))

    def test_legacy_p1_path_is_java(self):
        path = "projects/p1-loan-core-java8/src/test/java/nl/acme/MoneyTest.java"
        self.assertEqual(ll.detect_stack(path), ("java", "projects/p1-loan-core-java8"))
        self.assertTrue(ll.is_test_file("java", path))
        self.assertEqual(ll.module_of(path), "projects/p1-loan-core-java8")

    def test_non_project_path(self):
        self.assertIsNone(ll.detect_stack("curriculum/day-by-day/day-01.md"))
        self.assertIsNone(ll.detect_stack("projects/readme.md"))

    def test_java_name_convention_only_for_java(self):
        self.assertFalse(ll.is_test_file("java", "projects/p2/java/src/test/java/a/Helper.java"))
        self.assertTrue(ll.is_test_file("java", "projects/p2/java/src/test/java/a/LoanProperties.java"))

    def test_stacks_and_setups_of_diff(self):
        stacks = ll.stacks_of_paths(["projects/p1-loan-core-java8/src/main/A.java",
                                     "projects/p2/python/src/a.py", "README.md"])
        self.assertEqual(stacks, ["java", "python"])
        self.assertEqual(ll.setups_for(stacks), ["java", "python"])

    def test_manifest_glob_and_plain(self):
        write(self.root, "projects/p2/dotnet/Loan.sln")
        write(self.root, "projects/p2/python/pyproject.toml")
        self.assertTrue(ll.has_manifest("projects/p2/dotnet", ll.stack_ci("dotnet")["manifest"]))
        self.assertTrue(ll.has_manifest("projects/p2/python", "pyproject.toml"))
        self.assertFalse(ll.has_manifest("projects/p2/node", "package.json"))

    def test_test_command_templates(self):
        cmd = ll.test_command("python", "projects/p2/python", ["test_loan"], set())
        self.assertEqual(cmd, ["bash", "-lc", "uv run --directory projects/p2/python pytest -q"])
        self.assertEqual(ll.test_command("ruby", "projects/p2/ruby", [], set())[2], "bundle exec rspec")


class MissingCiBlock(Fixture):
    with_ci = False

    def test_java_falls_back_to_maven_defaults(self):
        path = "projects/p2-x/java/src/test/java/com/acme/LoanTest.java"
        self.assertEqual(ll.stack_ci("java"), ll.JAVA_CI_DEFAULT)
        self.assertTrue(ll.is_test_file("java", path))
        self.assertEqual(ll.setups_for(["java"]), ["java"])

    def test_other_stacks_have_no_tests_and_no_command(self):
        self.assertFalse(ll.is_test_file("python", "projects/p2-x/python/tests/test_a.py"))
        self.assertIsNone(ll.test_command("python", "projects/p2-x/python", ["t"], set()))
        self.assertEqual(ll.setups_for(["python"]), [])

    def test_no_stacks_dir_at_all(self):
        shutil.rmtree(os.path.join(self.root, "stacks"))
        self.assertEqual(ll.detect_stack("projects/p1-loan-core-java8/src/test/java/XTest.java")[0], "java")
        self.assertTrue(ll.is_test_file("java", "projects/p1-loan-core-java8/src/test/java/XTest.java"))


class JavaRegression(Fixture):
    """Exactly the argv the pre-polyglot script built."""

    @staticmethod
    def old_command(module, tests, registered):
        base_cmd = ["mvn", "-B", "-ntp", "test", f"-Dtest={','.join(tests)}",
                    "-Dsurefire.failIfNoSpecifiedTests=false", "-DfailIfNoTests=false"]
        return base_cmd + (["-pl", module, "-am"] if module in registered else ["-f", f"{module}/pom.xml"])

    def test_registered_and_fallback(self):
        for module in ("projects/p1-loan-core-java8", "projects/p2-x/java"):
            for registered in ({module}, set()):
                tests = ["AaaTest", "BbbIT"]
                self.assertEqual(ll.test_command("java", module, tests, registered),
                                 self.old_command(module, tests, registered))

    def test_known_literal(self):
        self.assertEqual(
            ll.test_command("java", "projects/p1-loan-core-java8", ["MoneyTest"], set()),
            ["mvn", "-B", "-ntp", "test", "-Dtest=MoneyTest", "-Dsurefire.failIfNoSpecifiedTests=false",
             "-DfailIfNoTests=false", "-f", "projects/p1-loan-core-java8/pom.xml"])


class RunTestsExitCodes(unittest.TestCase):
    class P:
        def __init__(self, rc, out=""):
            self.returncode, self.stdout, self.stderr = rc, out, ""

    def test_pass_locked_and_build_error(self):
        self.assertEqual(ll.exit_code_cases(["t"], self.P(0))[0]["status"], "passed")
        self.assertEqual(ll.exit_code_cases(["t"], self.P(1, "Failed: LEARNER: implement"))[0]["status"], "locked")
        self.assertEqual(ll.exit_code_cases(["t"], self.P(2, "ImportError")), [])


class GamificationData(Fixture):
    def test_levels_prefer_global_levels(self):
        write(self.root, "progress/rules.json", json.dumps({
            "levels": [{"id": "L1", "name": "Old", "min": 0, "max": None}],
            "global_levels": [{"id": "L1", "name": "A", "min": 0, "max": 9}, {"id": "L2", "name": "B", "min": 10, "max": None}]}))
        self.assertEqual(ll.load_levels(), [("L1", "A", 0), ("L2", "B", 10)])

    def test_levels_fall_back_to_levels_then_builtin(self):
        write(self.root, "progress/rules.json", json.dumps({"levels": [{"id": "L1", "name": "Old", "min": 0, "max": None}]}))
        self.assertEqual(ll.load_levels(), [("L1", "Old", 0)])
        os.remove(os.path.join(self.root, "progress", "rules.json"))
        self.assertEqual(ll.load_levels(), ll.FALLBACK_LEVELS)

    def test_achievement_union_and_total(self):
        base = [
            {"id": "c1", "scope": "common"}, {"id": "c2", "scope": "common"},
            {"id": "ps", "scope": "per-stack"}, {"id": "poly", "scope": "polyglot"},
            {"id": "java-only", "scope": "stack", "stack": "java"},  # duplicate of the pack definition
        ]
        write(self.root, "progress/achievements.json", json.dumps({"definitions": base}))
        defs = ll.achievement_definitions()
        self.assertEqual(len(defs), 4 + 5)  # 4 non-dup base + 5 pack definitions (java-only counted once)
        self.assertEqual(ll.achievements_total(defs, ["java"]), 2 + 1 + 1 * 1 + 1)
        self.assertEqual(ll.achievements_total(defs, ["java", "python"]), 2 + 1 + 1 * 2 + 2)

    def test_stacks_in_play_from_sessions_else_config(self):
        self.assertEqual(ll.stacks_in_play({"stacks": "java, python"}), ["java", "python"])
        write(self.root, "progress/sessions/session-01.json", json.dumps({"stack": "ruby"}))
        self.assertEqual(ll.stacks_in_play({"stacks": "java"}), ["ruby"])

    def test_real_repo_total_is_derived(self):
        ll.ROOT = self._old_root
        repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        ll.ROOT = repo
        defs = ll.achievement_definitions()
        ids = [(d["id"], d.get("stack")) for d in defs]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreater(ll.achievements_total(defs, ["java"]), 0)


class ConfigTolerance(Fixture):
    def test_unknown_keys_and_stack_outputs(self):
        write(self.root, ".github/learning-path.yml",
              "pace: steady\nmasterplan: loan-servicing\nstack: python\nstacks: java,python  # in play\nfuture_key: 1\n")
        old = ll.CONFIG_FILE
        ll.CONFIG_FILE = os.path.join(self.root, ".github", "learning-path.yml")
        try:
            cfg = ll.load_config()
        finally:
            ll.CONFIG_FILE = old
        self.assertEqual(cfg["masterplan"], "loan-servicing")
        self.assertEqual(cfg["stack"], "python")
        self.assertEqual(ll.configured_stacks(cfg), ["java", "python"])
        self.assertEqual(cfg["future_key"], "1")


if __name__ == "__main__":
    unittest.main()
