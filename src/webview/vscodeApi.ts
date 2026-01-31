// VS Code Webview API wrapper
// This must be called only once per webview session

interface VsCodeApi {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Acquire the API once and cache it
let vscodeApi: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi {
    if (!vscodeApi) {
        vscodeApi = acquireVsCodeApi();
    }
    return vscodeApi;
}

export function postMessage(message: any): void {
    getVsCodeApi().postMessage(message);
}
