import qrcode from 'qrcode-generator';

/**
 * QR code modules for a short text (doc P2: the profile link). Error correction "M" survives a scratched or
 * partly covered screen without making the code dense. Pure: the drawing lives in `ui/QrCode`.
 */
export const qrMatrix = (text: string): boolean[][] => {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (__, col) => code.isDark(row, col)));
};

/**
 * Dark modules as horizontal runs per row ({ x, y, length }), so a 33x33 code draws as ~300 rectangles instead of
 * ~550 single squares.
 */
export const qrRuns = (matrix: boolean[][]) => {
  const runs: Array<{ x: number; y: number; length: number }> = [];
  matrix.forEach((row, y) => {
    let start = -1;
    row.forEach((dark, x) => {
      if (dark && start < 0) start = x;
      if ((!dark || x === row.length - 1) && start >= 0) {
        const end = dark ? x + 1 : x;
        runs.push({ x: start, y, length: end - start });
        start = -1;
      }
    });
  });
  return runs;
};
