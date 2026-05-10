import { useState, useRef } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ImageCropModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (file: File) => Promise<void>;
  aspect?: number;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropModal({ isOpen, onOpenChange, imageSrc, onCropComplete, aspect = 4 / 5 }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  async function handleConfirm() {
    const image = imgRef.current;
    if (!image || !completedCrop) return;

    setIsProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const OUT_W = 1080;
      const OUT_H = Math.round(OUT_W / aspect);
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2d context");

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        OUT_W,
        OUT_H
      );

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("Canvas is empty");

      const file = new File([blob], "cropped_proof.webp", { type: "image/webp" });
      await onCropComplete(file);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full" aria-describedby="crop-modal-description">
        <DialogHeader>
          <DialogTitle>Sesuaikan Gambar Bukti Pembayaran</DialogTitle>
        </DialogHeader>
        <p id="crop-modal-description" className="text-xs text-muted-foreground hidden">Potong gambar ke rasio 4:5 Portrait (1080×1350)</p>
        <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl max-h-[60vh] overflow-auto">
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
            >
              <img ref={imgRef} src={imageSrc} alt="Crop preview" onLoad={onImageLoad} className="max-w-full h-auto max-h-[50vh] object-contain" />
            </ReactCrop>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Batal</Button>
          <Button onClick={handleConfirm} disabled={!completedCrop || isProcessing}>
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Simpan & Unggah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}