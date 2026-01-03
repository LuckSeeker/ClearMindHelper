# ClearMindHelper

A web application designed to help users track alcohol consumption during social events, estimate their blood alcohol content (BAC), and receive alerts when approaching their personal risk threshold for experiencing a blackout.

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

ClearMindHelper addresses a critical gap in personal safety awareness: users often don't know how much alcohol they can consume before losing control and experiencing memory loss. The application provides real-time tracking of consumption, immediate BAC estimation using the Widmark formula, and intelligent alert systems to warn users before and after exceeding their personal risk threshold.

### Key Features (MVP)

- **User Authentication**: Email and password-based registration and login
- **Personalized Profile**: Height, weight, and gender data for accurate BAC calculations
- **Party Management**: Start, manage, and close drinking sessions
- **Drink Logging**: Record alcohol consumption with volume (ml) and ABV (%) for each drink
- **Real-Time BAC Calculation**: Immediate BAC estimation using the Widmark formula
- **Smart Alerts**:
  - Single notification when approaching the threshold
  - Repeated alerts every 5 minutes after exceeding the threshold (default: 1.6‰)
- **Input Validation**: Warnings for unrealistic consumption rates or quantities
- **Party History**: Complete record of past sessions with analytics
- **Adaptive Thresholds**: Automatic adjustment based on user's drinking history and blackout occurrences

### Target Metrics

- Response time: <2 seconds from drink entry to updated BAC display and alert
- BAC calculation accuracy: ±0.1‰

## Tech Stack

### Frontend

- **Astro 5** - Web framework for fast, content-focused sites
- **React 19** - Interactive components
- **TypeScript 5** - Static typing for improved code quality
- **Tailwind CSS 4** - Utility-first CSS framework
- **Shadcn/ui** - Accessible, customizable UI components
- **Lucide React** - Icon library

### Backend & Database

- **Supabase** - Backend-as-a-service with PostgreSQL, authentication, and APIs

### Development Tools

- **ESLint** - Code quality and style consistency
- **Prettier** - Code formatting
- **TypeScript ESLint** - TypeScript-specific linting
- **Husky** - Git hooks for automated checks

### DevOps & Hosting

- **GitHub Actions** - CI/CD pipeline
- **DigitalOcean** - Hosting via Docker containers

## Getting Started Locally

### Prerequisites

- **Node.js 22.14.0** or higher (see [.nvmrc](./.nvmrc))
- **npm** or **yarn** for package management

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/LuckSeeker/ClearMindHelper.git
   cd ClearMindHelper
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the root directory with your Supabase credentials and other required configurations:

   ```
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

### Project Structure

```
src/
├── components/          # Astro and React components
│   └── ui/             # Shadcn/ui components
├── layouts/            # Astro page layouts
├── pages/              # Astro pages and API endpoints
├── lib/                # Services and utility functions
├── db/                 # Supabase clients and type definitions
├── types.ts            # Shared TypeScript types
├── assets/             # Static internal assets
└── styles/             # Global CSS and Tailwind configuration
public/                 # Public static assets
```

## Available Scripts

### Development

- **`npm run dev`** - Start the development server with hot reload

### Production

- **`npm run build`** - Build the project for production
- **`npm run preview`** - Preview the production build locally

### Code Quality

- **`npm run lint`** - Check code for linting errors
- **`npm run lint:fix`** - Automatically fix linting issues
- **`npm run format`** - Format code using Prettier
- **`npm run astro`** - Run Astro CLI commands directly

## Project Scope

### Included in MVP

✅ User registration and authentication  
✅ User profile management (height, weight, gender)  
✅ Drink tracking and logging during parties  
✅ Real-time BAC calculation (Widmark formula)  
✅ Alert system for threshold warnings  
✅ Party history and analytics  
✅ Input validation and safety warnings  
✅ Adaptive user-specific thresholds  
✅ Event telemetry and analytics logging

### Out of Scope (Future Iterations)

❌ Mobile native application  
❌ Hangover prediction and alerts  
❌ Additional consumption factors (food, water intake)  
❌ Device integrations (smartwatches, breathalyzers)  
❌ Age verification  
❌ Hangover tracking post-party

## Project Status

**Status**: 🚀 **In Active Development**

- [x] Requirements and user stories defined (18 user stories)
- [x] Tech stack selected and initialized
- [x] Project structure established
- [ ] Authentication system implementation
- [ ] Core BAC calculation engine
- [ ] Alert and notification system
- [ ] Party management features
- [ ] Analytics and history tracking
- [ ] Testing and quality assurance
- [ ] Production deployment

### 18 Defined User Stories

This project is guided by 18 comprehensive user stories (US-001 to US-018) covering all MVP features, from user registration to threshold customization. See [.ai/prd.md](./.ai/prd.md) for complete user story details and acceptance criteria.

## License

This project is currently under development. License information will be added upon project completion.

---

**Questions or Contributions?**

For detailed information about the project requirements, see [Product Requirements Document](./.ai/prd.md).

For technical stack details, see [Tech Stack Documentation](./.ai/tech-stack.md).
