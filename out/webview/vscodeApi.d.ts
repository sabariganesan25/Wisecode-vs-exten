interface VsCodeApi {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
}
export declare function getVsCodeApi(): VsCodeApi;
export declare function postMessage(message: any): void;
export {};
//# sourceMappingURL=vscodeApi.d.ts.map