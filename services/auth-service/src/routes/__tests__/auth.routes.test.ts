import request from "supertest";
import express from "express";
import authRouter from "../auth.routes";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

jest.mock("../../services/auth.service", () => ({
  login: jest.fn().mockResolvedValue({
    accessToken: "access",
    refreshToken: "refresh",
    tokenType: "Bearer",
    expiresIn: 900,
    refreshTokenExpiresIn: 2592000,
  }),
}));

describe("POST /api/auth/login", () => {
  it("returns tokens on success", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "password123", deviceId: "dev1" });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe("access");
  });
});
