// Graceful shutdown variables
let isShuttingDown = false;
let cloudWatchTransport: any = null;

/**
 * Set CloudWatch transport for graceful shutdown
 * @param transport CloudWatch transport instance
 */
export function setCloudWatchTransport(transport: any): void {
    cloudWatchTransport = transport;
}

/**
 * Graceful shutdown function
 */
export async function shutdownLogger(): Promise<void> {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    // Flush any pending logs
    if (cloudWatchTransport) {
        try {
            // Wait for CloudWatch transport to flush
            await new Promise(resolve => {
                if (cloudWatchTransport && typeof cloudWatchTransport.kthxbye === 'function') {
                    cloudWatchTransport.kthxbye(resolve);
                } else {
                    resolve(null);
                }
            });
        } catch (error) {
            console.error('Error flushing CloudWatch logs:', error);
        }
    }

    console.log('Logger shutdown complete');
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await shutdownLogger();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await shutdownLogger();
    process.exit(0);
});
