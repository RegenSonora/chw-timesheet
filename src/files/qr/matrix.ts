// QR modules for a payload, drawn by the PDF writer as filled squares.
import qrcode from 'qrcode-generator';

/** True where a module is dark; rows top to bottom. Byte mode, error correction M, smallest size that fits. */
export function qrMatrix(text: string): boolean[][] {
  if (!/^[\x20-\x7e]*$/.test(text)) throw new RangeError('QR payload must be printable ASCII');
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
