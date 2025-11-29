# Overview

H4VX is a modern web application for hosting and sharing gaming-related files. It provides a platform for users to upload, categorize, and download various types of files including games, tools, scripts, archives, and configuration files. The application features a gaming-themed dark UI with statistics tracking, file categorization, search functionality, and a responsive design optimized for file sharing within gaming communities. Its business vision is to become a central hub for gaming file exchange, offering a robust and user-friendly experience to foster vibrant gaming communities.

# Recent Changes

**November 26, 2025**
- Fixed dashboard to only show folders with uploaded files
  - Modified `/api/folders` endpoint to filter by category file count > 0
  - Empty predefined folders (Software, Video, Image, APK, etc.) no longer appear
  - Dashboard now dynamically shows only categories that have files uploaded
  - Updated FileGrid component to use `folder.fileCount` from API instead of recalculating
  - Added caching for folder endpoint (30 second TTL) for performance

**November 24, 2025**
- Implemented comprehensive preview feature for all previewable file types
  - Added eye icon preview button in grid view for all eligible files
  - **Image preview**: jpg, jpeg, png, gif, webp, bmp, svg, ico, tiff
  - **Video preview**: mp4, webm, ogg, avi, mkv, mov, flv, wmv, m4v, mpg, mpeg
  - **PDF preview**: Embedded PDF viewer using iframe
  - **Text file preview**: txt, md, log, json, xml, cfg, config, ini, sh, py, js, html, css
    - Syntax highlighting with monospace font in dark background
    - Content truncated at 100KB to prevent browser slowdown
    - Shows total file size if content exceeds limit
  - Created preview modal with inline viewer for all types
  - Added `/api/files/:id/preview` backend endpoint for images/videos/PDFs
  - Added `/api/files/:id/preview-text` backend endpoint for text files
  - "Download File" button in preview modal for easy access
  - Responsive modal layout with max-w-4xl and max-h-[90vh]
  - All previews use S3 presigned URLs with 10-minute expiry for security

- Fixed PIN verification flow for locked files
  - Added frontend PIN verification before attempting download
  - Users now get immediate error feedback if PIN is incorrect (in the dialog)
  - No more JSON error responses in new tabs
  - PIN is verified with backend via `/api/files/:id/verify-pin` endpoint
  - Only saves to localStorage after successful verification
  - Unlock animation and download proceed automatically after successful verification

**November 11, 2025**
- Comprehensive performance optimization for instant, zero-lag responsiveness
  - Removed VideoTransition component that appeared when clicking folders
  - Optimized ALL CSS transitions to ≤150ms (buttons: 100ms, other elements: 150ms)
  - Added GPU acceleration hints (translateZ(0), will-change properties)
  - Implemented hardware acceleration (backface-visibility: hidden, perspective: 1000px)
  - Added smooth scrolling globally for fluid navigation
  - Removed mobile tap delay with touch-action: manipulation
  - Reduced hover transforms for smoother performance (translateY: -2px instead of -4px)
  - Fixed all components to enforce ≤150ms transition policy:
    * Buttons (ui/button.tsx): 100ms transitions
    * Cards (ui/card.tsx): 150ms transitions with reduced scale
    * File grid (file-grid.tsx): 100-150ms instant response
    * Upload zone (upload-zone.tsx): 150ms transitions
    * Search filter (search-filter.tsx): 150ms transitions
    * Dialogs (custom-confirmation-dialog.tsx, custom-popup.tsx): 150ms transitions
    * Glass effects (index.css): 150ms transitions
- Created comprehensive AWS EC2 + PM2 deployment guide
  - Step-by-step instructions for production deployment
  - PM2 process manager configuration with ecosystem.config.cjs
  - NGINX reverse proxy setup
  - SSL/HTTPS configuration
  - Automatic restart on server reboot

**November 10, 2025**
- Removed AWS Secrets Manager dependency
  - Simplified credential management to use .env files exclusively
  - Updated S3Service to read AWS credentials directly from environment variables
  - Removed secrets-service.ts and @aws-sdk/client-secrets-manager package
  - Created .env.example file to document required environment variables
  - Added .env to .gitignore to prevent credential leaks

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
  - Credentials are managed through environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME)
  - See .env.example for required configuration

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