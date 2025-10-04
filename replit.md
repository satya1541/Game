# Overview

H4VX is a modern web application for hosting and sharing gaming-related files. It provides a platform for users to upload, categorize, and download various types of files including games, tools, scripts, archives, and configuration files. The application features a gaming-themed dark UI with statistics tracking, file categorization, search functionality, and a responsive design optimized for file sharing within gaming communities. Its business vision is to become a central hub for gaming file exchange, offering a robust and user-friendly experience to foster vibrant gaming communities.

# Recent Changes

**September 30, 2025**
- Successfully configured for Replit environment with webview output type on port 5000
- Fixed text visibility issue in header stats display by improving color contrast
  - Changed stats labels from `text-muted-foreground` to `text-slate-700` (light mode) and `text-slate-200` (dark mode)
  - Increased font weight to `font-semibold` for better readability
  - Verified WCAG AA contrast compliance
- Deployment configuration set up for autoscale with npm build and start scripts
- Vite dev server configured with host "0.0.0.0" and strictPort for Replit proxy compatibility
- Video transition component updated:
  - Replaced video file from 4K (3840x2160) to 1080p (1920x1080) for better performance
  - Updated video source to use `sachiro-dark-nights.1920x1080_1759228053157.mp4`
  - Set transition duration to 3 seconds with smooth fade-out
  - Added smooth fade-in/fade-out transitions for fluid user experience
  - Implemented video preloading to prevent black screen delays

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool.
- **UI Components**: Comprehensive component library built on Radix UI primitives with shadcn/ui styling.
- **Styling**: Tailwind CSS with a custom dark gaming theme featuring neon colors (cyan, purple, green). The theme has been recently updated to an aquatic theme with animated swimming fish, orange-red and light blue colors, and deep ocean blues for dark mode, applied consistently across all UI elements.
- **State Management**: TanStack Query for server state management with custom query client configuration.
- **Routing**: Wouter for lightweight client-side routing.
- **Form Handling**: React Hook Form with Zod validation resolvers.

## Backend Architecture
- **Runtime**: Node.js with Express.js framework.
- **Language**: TypeScript with ES modules.
- **File Upload**: Multer middleware for handling multipart form data.
- **API Design**: RESTful endpoints for file operations, statistics, and downloads.
- **Error Handling**: Centralized error middleware with structured error responses and secure CORS handling.

## Data Layer
- **Database**: MySQL with native `mysql2` driver.
- **Schema**: Type-safe schema definitions with Zod validation.
- **Connection**: Direct MySQL connection pool for optimal performance.
- **File Storage**: Primary storage for file metadata, with actual file content stored in AWS S3.

## File Management System
- **Categories**: Predefined file categories (games, tools, scripts, archives, configs).
- **Upload Validation**: File type restrictions and size limits (removed for S3 storage).
- **Metadata Tracking**: Original filenames, file sizes, MIME types, and upload timestamps.
- **Download Analytics**: Download count tracking with increment API.
- **Search & Filter**: Category-based filtering and text search capabilities.

# External Dependencies

## Cloud Services
- **AWS S3**: For scalable and performant file content storage.
- **AWS Secrets Manager**: For secure management and retrieval of AWS credentials using secret name 'game/aws/credentials' and encryption key 'aws/secretsmanager'.

## Database Services
- **MySQL**: Direct MySQL database connection with connection pooling.

## UI Component Libraries
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives.
- **Lucide React**: Icon library for consistent iconography.
- **Class Variance Authority**: Utility for creating variant-based component APIs.
- **Tailwind CSS**: Utility-first CSS framework with custom design system.

## Development Tools
- **Vite**: Modern build tool for frontend development with HMR and optimized production builds.
- **TypeScript**: Static type checking.
- **ESBuild**: Fast JavaScript bundler for production server builds.
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer plugins.

## File Processing
- **Multer**: Middleware for handling multipart/form-data uploads.
- **Node.js File System**: Native filesystem operations.

## State Management
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates.
- **React Hook Form**: Performant form library.
- **Zod**: Runtime type validation and schema definition.