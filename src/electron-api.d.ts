export {};

declare global {
  interface Window {
    electronAPI?: {
      openFolderDialog?: () => Promise<any>;
      closeSplash?: () => Promise<any>;
      printCurrent?: (options?: any) => Promise<any>;
      printHTML?: (html: string, options?: any) => Promise<any>;
      printURL?: (url: string, options?: any) => Promise<any>;
      printPreviewCurrent?: (options?: any) => Promise<any>;
      printPreviewHtml?: (html: string, options?: any) => Promise<any>;
      printPreviewPdf?: (dataUrlOrBase64: string) => Promise<any>;
      getLicenseInfo?: () => Promise<
        { allowedPages?: string[] } | null | undefined
      >;
    };
  }
}
