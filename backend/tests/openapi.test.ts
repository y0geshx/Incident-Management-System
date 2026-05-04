import express from "express";
import request from "supertest";
import { createSwaggerUiHtml, openApiDocument } from "../src/openapi";

describe("OpenAPI document", () => {
  test("exports the core IMS paths", () => {
    expect(openApiDocument.openapi).toBe("3.0.3");
    expect(openApiDocument.paths).toHaveProperty("/signals");
    expect(openApiDocument.paths).toHaveProperty("/incidents/{id}/rca");
    expect(openApiDocument.paths).toHaveProperty("/health");
  });

  test("is served from the backend", async () => {
    const app = express();
    app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
    app.get("/api/docs", (_req, res) => res.type("html").send(createSwaggerUiHtml("/api/openapi.json")));

    const docsResponse = await request(app).get("/api/docs");
    const specResponse = await request(app).get("/api/openapi.json");

    expect(docsResponse.status).toBe(200);
    expect(docsResponse.headers["content-type"]).toContain("text/html");
    expect(docsResponse.text).toContain("SwaggerUIBundle");
    expect(docsResponse.text).toContain("/api/openapi.json");

    expect(specResponse.status).toBe(200);
    expect(specResponse.body.info.title).toContain("Incident Management System");
    expect(specResponse.body.paths["/incidents/{id}/signals"]).toBeDefined();
    expect(specResponse.body.components.schemas.WorkItem).toBeDefined();
  });
});