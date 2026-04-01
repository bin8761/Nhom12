import bcrypt from "bcrypt";
import { login } from "../auth.service";
import { getPrismaClient } from "../../infra/prisma/prismaClient";

jest.mock("../../infra/prisma/prismaClient", () => ({
  getPrismaClient: jest.fn(),
}));

jest.mock("../../utils/tokenGenerator", () => ({
  generateAuthTokens: () => ({
    accessToken: "access",
    refreshToken: "refresh",
    accessTokenExpiresIn: 900,
    refreshTokenExpiresIn: 2592000,
    refreshTokenExpiresAt: new Date(Date.now() + 1000),
    refreshTokenJti: "jti",
  }),
}));

describe("auth.service login", () => {
  it("logs in valid user", async () => {
    (getPrismaClient as jest.Mock).mockReturnValue({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          email: "a@b.com",
          passwordHash: await bcrypt.hash("password123", 10),
          role: "CANDIDATE",
          status: "ACTIVE",
          emailVerified: true,
          approvalStatus: "APPROVED",
        }),
      },
      refreshToken: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    });

    const tokens = await login({
      email: "a@b.com",
      password: "password123",
      deviceId: "dev1",
    });

    expect(tokens.accessToken).toBe("access");
  });
});
