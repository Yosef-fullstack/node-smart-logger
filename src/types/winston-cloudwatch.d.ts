// src/types/winston-cloudwatch.d.ts
declare module 'winston-cloudwatch' {
    import winston from 'winston';

    interface CloudWatchTransportOptions {
        logGroupName: string;
        logStreamName: string;
        awsRegion: string;
        messageFormatter?: (info: any) => string;
        format?: winston.Logform.Format;
    }
}

