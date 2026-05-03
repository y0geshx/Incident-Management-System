import { generateSampleIncidents, SAMPLE_SIGNALS } from "../scripts/sample-data";

describe("Sample Data Integration", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.API_URL;

  beforeEach(() => {
    process.env.API_URL = "http://localhost:3001/api";
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ count: SAMPLE_SIGNALS.length }),
      }) as unknown as Promise<Response>
    );
  });

  afterEach(() => {
    process.env.API_URL = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("sends the full sample signal batch to the API", async () => {
    await generateSampleIncidents();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${process.env.API_URL}/signals/batch`,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signals: SAMPLE_SIGNALS }),
      })
    );
  });

  test("exports a non-empty sample payload", () => {
    expect(SAMPLE_SIGNALS).toBeInstanceOf(Array);
    expect(SAMPLE_SIGNALS).toHaveLength(8);
    expect(SAMPLE_SIGNALS[0]).toMatchObject({
      componentId: expect.any(String),
      errorCode: expect.any(String),
      severity: expect.any(String),
    });
  });
});
