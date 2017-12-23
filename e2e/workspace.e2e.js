import { expect } from "chai";
import testUtils from "./utils";

describe("application launch", () => {
  beforeEach(testUtils.beforeEach);
  afterEach(testUtils.afterEach);

  it("runs", function() {
    return this.app.client.element("hexed-workspace").then(workspace => {
      // Just expect it to exist at present.
    });
  });
});
