declare module 'winston' {
    export interface Transports {
        Console: any;
        File: any;
        CloudWatch: any;
    }

    export interface Logger {
        [key: string]: any;
    }

    export const transports: Transports;

    export function createLogger(options: any): Logger;
    export function addColors(colors: Record<string, string>): void;

    export const format: {
        (options?: any): any;
        combine(...formats: any[]): any;
        timestamp(options?: any): any;
        colorize(options?: any): any;
        printf(fn: (info: any) => string): any;
        json(): any;
        errors(options?: any): any;
    };

    export namespace Logform {
        interface Format {}
    }
}