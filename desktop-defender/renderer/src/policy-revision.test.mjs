import assert from "node:assert/strict";
import test from "node:test";
import { createPolicyRevision } from "./policy-revision.mjs";

test("policy edits made during a save remain distinguishable from its snapshot", () => {
  const revision = createPolicyRevision();
  revision.edit();
  const submittedRevision = revision.capture();

  revision.edit();

  assert.equal(revision.isCurrent(submittedRevision), false);
  assert.equal(revision.isCurrent(revision.capture()), true);
});
