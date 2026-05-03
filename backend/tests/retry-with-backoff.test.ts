import { retryWithBackoff } from "../src/utils/retryWithBackoff";

describe("retryWithBackoff", () => {
  test("returns on first successful attempt", async () => {
    const operation = jest.fn(async () => "ok");

    const result = await retryWithBackoff(operation, {
      maxAttempts: 3,
      initialDelayMs: 1,
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test("retries transient failures and succeeds", async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error("temporary 1"))
      .mockRejectedValueOnce(new Error("temporary 2"))
      .mockResolvedValue("done");

    const result = await retryWithBackoff(operation, {
      maxAttempts: 4,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(result).toBe("done");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test("throws after max attempts", async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(new Error("permanent"));

    await expect(
      retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 1,
        maxDelayMs: 5,
      })
    ).rejects.toThrow("permanent");

    expect(operation).toHaveBeenCalledTimes(3);
  });
});
