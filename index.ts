#!/usr/bin/env bun

import { Application } from './src/application';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('\n💥 Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('\n💥 Unhandled Promise Rejection:', reason);
    process.exit(1);
});

// Start the application
Application.run().catch((error) => {
    console.error('\n💥 Application Error:', error);
    process.exit(1);
});