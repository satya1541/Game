# Overview

H4VX is a modern web application for hosting and sharing gaming-related files. Built as a full-stack React application with Express.js backend, it provides a platform for users to upload, categorize, and download various types of files including games, tools, scripts, archives, and configuration files. The application features a gaming-themed dark UI with statistics tracking, file categorization, search functionality, and a responsive design optimized for file sharing within gaming communities.

# User Preferences

Preferred communication style: Simple, everyday language.
AWS credentials are pre-configured in .env file - do not ask for AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Comprehensive component library built on Radix UI primitives with shadcn/ui styling
- **Styling**: Tailwind CSS with custom dark gaming theme featuring neon colors (cyan, purple, green)
- **State Management**: TanStack Query for server state management with custom query client configuration
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation resolvers

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **File Upload**: Multer middleware for handling multipart form data with disk storage
- **Storage Strategy**: Configurable storage interface with in-memory implementation for development
- **API Design**: RESTful endpoints for file operations, statistics, and downloads
- **Error Handling**: Centralized error middleware with structured error responses

## Data Layer
- **Database**: MySQL with native mysql2 driver
- **Schema**: Type-safe schema definitions with Zod validation
- **Connection**: Direct MySQL connection pool for optimal performance
- **File Storage**: Database-only storage using MySQL LONGBLOB fields for all file content

## Development Environment
- **Build System**: Vite for frontend development with HMR and React plugin
- **Type Safety**: Comprehensive TypeScript configuration with strict mode
- **Path Aliases**: Organized import paths for components, utilities, and shared code
- **Development Server**: Express server with Vite middleware integration for seamless full-stack development

## File Management System
- **Categories**: Predefined file categories (games, tools, scripts, archives, configs)
- **Upload Validation**: File type restrictions and size limits (500MB max)
- **Metadata Tracking**: Original filenames, file sizes, MIME types, and upload timestamps
- **Download Analytics**: Download count tracking with increment API
- **Search & Filter**: Category-based filtering and text search capabilities

# External Dependencies

## Database Services
- **MySQL**: Direct MySQL database connection with connection pooling
- **Configuration**: Hardcoded MySQL credentials for development environment

## UI Component Libraries
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Utility for creating variant-based component APIs
- **Tailwind CSS**: Utility-first CSS framework with custom design system

## Development Tools
- **Vite**: Modern build tool with fast HMR and optimized production builds
- **TypeScript**: Static type checking and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production server builds
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer plugins

## File Processing
- **Multer**: Middleware for handling multipart/form-data uploads
- **Node.js File System**: Native filesystem operations for file storage and retrieval
- **MIME Type Detection**: Built-in file type validation and categorization

## State Management
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: Runtime type validation and schema definition

## Recent Changes

## 2025-09-05: AWS S3 Migration & Admin Dashboard Optimization Completed
- **AWS S3 Integration**: Successfully migrated file storage from MySQL database to AWS S3 bucket for better scalability and performance
- **S3 Configuration**: Hardcoded AWS credentials (Access Key, Secret Key, Region: ap-south-2, Bucket: game.thynxai.cloud)
- **Database Schema Migration**: Updated MySQL schema to store S3 URLs and keys instead of LONGBLOB file content
- **S3 Service**: Created comprehensive S3Service for upload, download, delete, and file management operations
- **Storage Layer Update**: Modified MySQLStorage class to use S3 for file content while keeping metadata in database
- **API Routes Update**: Updated download endpoint to redirect to S3 URLs for optimal performance instead of proxying through server
- **Performance Benefits**: Files now served directly from S3 CDN, reducing server load and improving global download speeds
- **Scalability**: Removed database storage size limitations, now supporting unlimited file storage capacity
- **Cost Optimization**: Pay-per-use S3 pricing model instead of fixed database storage costs
- **Upload Limits Removed**: Eliminated all frontend upload restrictions (150MB file size limit, 10-file count limit)
- **Admin Dashboard Optimized**: Enhanced admin page with S3 storage metrics, file management features, and performance optimizations display
- **Compression References Removed**: Cleaned up all legacy compression field references for simplified S3-only architecture

## 2025-09-05: GitHub Import Setup Completed
- Successfully imported H4VX gaming file hosting platform from GitHub into Replit environment
- Fixed TypeScript compilation errors in server/routes.ts (removed invalid multer onError option)
- Verified frontend configuration allows all hosts for Replit proxy (allowedHosts: true in Vite config)
- Configured workflow for webview output type with proper port 5000 binding
- Set up deployment configuration for autoscale deployment target
- Tested application functionality - all core features working:
  - File upload/download system with MySQL database storage
  - Gaming-themed dark UI with proper styling and responsiveness  
  - API endpoints responding correctly (/api/stats, /api/folders, /api/files)
  - Background video and UI components loading properly
- Application now ready for production deployment and use

## 2025-09-04: Performance Optimizations & Database-Only Storage
- **Database-Only Storage**: Modified file storage system to store all uploaded files exclusively in MySQL database
- **Upload Performance**: Optimized concurrent file processing with smart compression strategy
- **Download Performance**: Added HTTP caching, ETag support, and optimized streaming for all file sizes
- **Database Optimization**: Increased connection pool to 50 connections for better concurrency
- **Frontend Optimization**: Added progress throttling, timeout handling, and optimized file sorting
- **Smart Compression**: Only compress beneficial file types (text/config) with size/time thresholds
- **Streaming**: Implemented 2MB chunk streaming for optimal download throughput
- **Caching**: Added 24-hour browser caching with immutable headers for downloads

## 2025-09-03: Replit Environment Setup
- Successfully configured the H4VX gaming file hosting platform to run in Replit environment
- Fixed workflow configuration for frontend web application with webview output type
- Verified MySQL database connection and schema initialization
- Configured deployment settings for autoscale deployment target
- Application now running successfully on port 5000 with proper host configuration
- Frontend properly configured with Vite dev server and proxy settings
- Backend API endpoints tested and functioning correctly

## Project Status
- ✅ Frontend: React application with Vite dev server running on port 5000
- ✅ Backend: Express.js API server with MySQL database integration
- ✅ Database: MySQL connection established with automatic schema initialization
- ✅ File Upload: Multer file upload system working with local filesystem storage
- ✅ Deployment: Configured for autoscale deployment with build and run scripts

# Deployment Platform
- **Replit**: Cloud development and hosting platform with integrated development environment
- **Environment Variables**: Secure configuration management for database connections and API keys
- **Port Configuration**: Frontend serves on port 5000 with allowedHosts: true for proxy compatibility
- **Deployment**: Autoscale deployment target with npm build and start scripts