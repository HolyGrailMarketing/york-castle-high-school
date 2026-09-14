import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import type { CopyLabel } from '../../types';

/**
 * One printable barcode label.
 *
 * The bars are real Code 128, drawn as SVG by JsBarcode. Printing the barcode
 * string as text would look right on screen and be completely unreadable to the
 * scanner at the counter, which is the only thing these labels exist for.
 *
 * Code 128 rather than Code 39: it encodes "YCHS-000123" in noticeably fewer
 * bars, so the label stays legible at the width of an address label, and every
 * keyboard-wedge scanner sold reads it by default.
 *
 * SVG rather than canvas: it prints at the printer's resolution rather than the
 * screen's, and a barcode printed at screen resolution is a barcode that
 * misreads.
 */
const BarcodeLabel = ({ label }: { label: CopyLabel }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, label.barcode, {
        format: 'CODE128',
        // The human-readable line matters: when a label is scuffed and will not
        // scan, someone has to be able to type it in.
        displayValue: true,
        fontSize: 11,
        textMargin: 0,
        height: 26,
        width: 1.3,
        margin: 0,
      });
    } catch {
      // A barcode that cannot be encoded must not take the whole sheet down.
      // The title and copy number below are still printed.
    }
  }, [label.barcode]);

  return (
    <div className="lib-label">
      <div className="lib-label-title">{label.title}</div>
      <svg ref={svgRef} className="lib-label-svg" aria-label={`Barcode ${label.barcode}`} />
      <div className="lib-label-meta">{label.subject} · copy {label.copyNumber}</div>
    </div>
  );
};

export default BarcodeLabel;
