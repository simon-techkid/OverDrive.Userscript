//declare const unsafeWindow: any;
declare const JSZip: any;
declare const saveAs: (blob: Blob, filename: string) => void;

interface Window {
  OverDrive: {
    mediaItems: Record<string, any>;
  };
  ajax: {
    returnTitle: (id: string) => void;
  };
}