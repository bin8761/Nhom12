import 'dotenv/config';
import jwt from 'jsonwebtoken';

const privateKey = process.env.JWT_PRIVATE_KEY;
if (!privateKey) {
  console.error('JWT_PRIVATE_KEY is required in .env to generate tokens');
  process.exit(1);
}

const issuer = process.env.JWT_ISSUER ?? 'auth-service';
const audience = process.env.JWT_AUDIENCE ?? 'job-finder-clients';

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

const generateToken = (sub: string, role: 'employer' | 'candidate') => {
  const payload = {
    sub,
    email: `${sub}@example.com`,
    role,
    emailVerified: true,
    deviceId: 'loadtest-device',
    tokenUse: 'access' as const,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    issuer,
    audience,
    expiresIn: TEN_YEARS_SECONDS,
  });
};

const employerToken = generateToken('employer-loadtest', 'employer');
const candidateToken = generateToken('candidate-loadtest', 'candidate');

console.log('Employer access token:\n', employerToken, '\n');
console.log('Candidate access token:\n', candidateToken, '\n');
