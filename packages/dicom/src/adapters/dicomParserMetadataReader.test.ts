import { describe, expect, it } from "vitest";
import { DicomParserMetadataReader } from "./dicomParserMetadataReader";
import { readRtstructContourMetadata } from "./rtstructContourReader";

describe("DicomParserMetadataReader", () => {
  it("reads RTSTRUCT ROI and contour summary metadata", async () => {
    const metadata = await new DicomParserMetadataReader().readMetadata(rtstructBytes());

    expect(metadata).toMatchObject({
      modality: "RTSTRUCT",
      seriesInstanceUid: "rt-series",
      rtstruct: {
        structureCount: 1,
        contourCount: 1,
        pointCount: 4,
        structures: [
          {
            roiNumber: 1,
            name: "Liver",
            contourCount: 1,
            pointCount: 4,
            referencedSopInstanceUids: ["sop-1"],
            contours: [
              {
                pointCount: 4,
                referencedSopInstanceUids: ["sop-1"],
              },
            ],
          },
        ],
      },
    });
  });

  it("reads RTSTRUCT contour points on demand", async () => {
    const metadata = await readRtstructContourMetadata(rtstructBytes());

    expect(metadata?.structures[0]?.contours?.[0]?.points).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  });
});

function rtstructBytes(): ArrayBuffer {
  return arrayBufferFromBytes(concatBytes(
    new Uint8Array(128),
    asciiBytes("DICM"),
    element({ group: 0x0002, tag: 0x0010, vr: "UI", value: "1.2.840.10008.1.2.1" }),
    element({ group: 0x0008, tag: 0x0060, vr: "CS", value: "RTSTRUCT" }),
    element({ group: 0x0020, tag: 0x000e, vr: "UI", value: "rt-series" }),
    sequence(0x3006, 0x0020, [item([element({ group: 0x3006, tag: 0x0022, vr: "IS", value: "1" }), element({ group: 0x3006, tag: 0x0026, vr: "LO", value: "Liver" })])]),
    sequence(0x3006, 0x0039, [
      item([
        element({ group: 0x3006, tag: 0x0084, vr: "IS", value: "1" }),
        sequence(0x3006, 0x0040, [
          item([
            element({ group: 0x3006, tag: 0x0046, vr: "IS", value: "4" }),
            element({ group: 0x3006, tag: 0x0050, vr: "DS", value: "0\\0\\0\\1\\0\\0\\1\\1\\0\\0\\1\\0" }),
            sequence(0x3006, 0x0016, [item([element({ group: 0x0008, tag: 0x1155, vr: "UI", value: "sop-1" })])]),
          ]),
        ]),
      ]),
    ]),
  ));
}

function sequence(group: number, tag: number, items: readonly Uint8Array[]): Uint8Array {
  return explicitLongElement({ group, tag, vr: asciiBytes("SQ"), value: concatBytes(...items) });
}

function item(elements: readonly Uint8Array[]): Uint8Array {
  const body = concatBytes(...elements);
  return concatBytes(uint16(0xfffe), uint16(0xe000), uint32(body.length), body);
}

interface DataElementInput {
  group: number;
  tag: number;
  vr: string;
  value: string;
}

interface ExplicitElementInput {
  group: number;
  tag: number;
  vr: Uint8Array;
  value: Uint8Array;
}

function element({ group, tag, vr, value }: DataElementInput): Uint8Array {
  return explicitShortElement({ group, tag, vr: asciiBytes(vr), value: asciiValue(vr, value) });
}

function explicitShortElement({ group, tag, vr, value }: ExplicitElementInput): Uint8Array {
  return concatBytes(uint16(group), uint16(tag), vr, uint16(value.length), value);
}

function explicitLongElement({ group, tag, vr, value }: ExplicitElementInput): Uint8Array {
  return concatBytes(uint16(group), uint16(tag), vr, uint16(0), uint32(value.length), value);
}

function asciiValue(vr: string, value: string): Uint8Array {
  if (vr === "UI") {
    return asciiBytes(`${value}\0`);
  }
  return asciiBytes(value.length % 2 === 0 ? value : `${value} `);
}

function asciiBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function concatBytes(...chunks: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}
