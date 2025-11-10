import { FileIcon, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageAttachmentProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

const MessageAttachment = ({ fileUrl, fileName, fileSize, fileType }: MessageAttachmentProps) => {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isImage = fileType?.startsWith("image/");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="mt-2 max-w-xs">
      {isImage ? (
        <div className="relative group">
          <img
            src={fileUrl}
            alt={fileName}
            className="rounded-lg max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(fileUrl, "_blank")}
          />
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
          <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            {fileSize && (
              <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
            )}
          </div>
          <Button size="icon" variant="ghost" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessageAttachment;
