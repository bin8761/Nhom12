# Job Finder Frontend

Frontend application for the Job Finder platform - Nền tảng tìm việc làm hàng đầu Việt Nam.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Configure API URL in `.env`:
```
VITE_API_BASE_URL=http://localhost:4001/api
```

4. Start development server:
```bash
npm run dev
```

5. Open browser at `http://localhost:5173`

## Project Structure

```
fe/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Layout.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pages/          # Page components
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── VerifyEmail.tsx
│   │   └── Dashboard.tsx
│   ├── services/       # API services
│   │   ├── api.ts
│   │   └── authService.ts
│   ├── store/          # State management
│   │   └── authStore.ts
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── .env.example        # Environment variables template
├── tailwind.config.js  # Tailwind configuration
├── vite.config.ts      # Vite configuration
└── package.json

```

## Features

### ✅ Completed

- **Home Page** - Landing page with hero section and features
- **Authentication**
  - User registration (Candidate/Employer)
  - Login with email & password
  - Email verification with OTP
  - Protected routes
  - JWT token management
  - Auto-refresh tokens
- **Dashboard** - User dashboard based on role
- **UI Components** - Button, Input, Layout
- **Responsive Design** - Mobile-first approach

### 🚧 In Progress

- Job listings
- Job applications
- Profile management
- Employer features

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:4001/api` |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## API Integration

Frontend integrates with the Auth Service API:

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh tokens
- `POST /auth/logout` - Logout
- `POST /auth/verify-email` - Verify email with OTP
- `POST /auth/resend-verification` - Resend verification code
- `GET /auth/me` - Get current user

## Design System

Colors (Primary):
- 50: `#f0f9ff`
- 500: `#0ea5e9` (Main)
- 600: `#0284c7`
- 700: `#0369a1`

Typography:
- Font Family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

MIT
