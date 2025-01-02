//declare const unsafeWindow: any;
declare const JSZip: any;
declare const saveAs: (blob: Blob, filename: string) => void;

interface Window {
  OverDrive: {
    mediaItems: Record<string, OverDriveMediaItem>;
  };
  ajax: {
    returnTitle: (id: string) => void;
  };
}

interface OverDriveMediaItem {
  id: string;
  otherFormats: OverDriveMediaItemType[];
  title: string;
  type: OverDriveMediaItemType;
}

interface OverDriveMediaItemType {
  id: string;
  name: string;
}