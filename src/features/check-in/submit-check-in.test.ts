import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkInErrorMessage } from "./submit-check-in.ts";

describe("check-in errors (K2 / SOS-137)", () => {
  it("names the hour limit and the sign-in requirement", () => {
    assert.equal(checkInErrorMessage({ code: "PT429" }), "You checked in here recently.");
    assert.equal(
      checkInErrorMessage({ message: "You checked in here in the last hour" }),
      "You checked in here recently.",
    );
    assert.equal(checkInErrorMessage({ status: 429 }), "You checked in here recently.");
    assert.equal(
      checkInErrorMessage({ code: "42501", message: "Sign in with your @umich.edu account to check in" }),
      "Sign in with your @umich.edu account to check in.",
    );
  });

  it("keeps a generic message for anything else", () => {
    assert.equal(checkInErrorMessage({ code: "22023", message: "visited_at must be within the last 24 hours" }), "Couldn't check in. Try again in a moment.");
    assert.equal(checkInErrorMessage(null), "Couldn't check in. Try again in a moment.");
  });
});
