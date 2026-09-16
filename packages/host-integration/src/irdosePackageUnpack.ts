import JSZip from "jszip";

interface IrdosePackageUnpackManifest {
  files: {
    ct_reference: { ct_name: string; filename: string };
    activity_maps: IrdoseActivityMapPackageFile[];
    targets: IrdoseTargetPackageFile[];
    dose_maps: IrdoseDoseMapPackageFile[];
  };
}

interface IrdoseActivityMapPackageFile {
  name: string;
  filename: string;
  post_injection_time_h?: number;
  unit?: string;
}

interface IrdoseTargetPackageFile {
  name: string;
  filename: string;
}

interface IrdoseDoseMapPackageFile {
  emission: string;
  filename: string;
}

export type IrdoseUnpackedFileSource = "ct_reference" | "activity_map" | "target" | "dose_map";

export interface IrdoseUnpackedFile {
  path: string;
  data: ArrayBuffer;
  source: IrdoseUnpackedFileSource;
  sourceName?: string;
  sourceFilename: string;
}

export interface IrdoseUnpackedStudyPackage {
  ctReference: {
    name: string;
    filename: string;
    files: IrdoseUnpackedFile[];
  };
  activityMaps: Array<{
    name: string;
    filename: string;
    postInjectionTimeH?: number;
    unit?: string;
    files: IrdoseUnpackedFile[];
  }>;
  targets: Array<{
    name: string;
    filename: string;
    files: IrdoseUnpackedFile[];
  }>;
  doseMaps: Array<{
    emission: string;
    filename: string;
    files: IrdoseUnpackedFile[];
  }>;
}

export class IrdosePackageUnpackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IrdosePackageUnpackError";
  }
}

export async function unpackIrdoseStudyPackage(
  manifest: IrdosePackageUnpackManifest,
  packageZip: ArrayBuffer,
): Promise<IrdoseUnpackedStudyPackage> {
  const zip = await JSZip.loadAsync(packageZip);
  return {
    ctReference: {
      name: manifest.files.ct_reference.ct_name,
      filename: manifest.files.ct_reference.filename,
      files: await unpackNestedZip({
        packageZip: zip,
        directory: "ct_reference",
        filename: manifest.files.ct_reference.filename,
        source: "ct_reference",
        sourceName: manifest.files.ct_reference.ct_name,
      }),
    },
    activityMaps: await Promise.all(manifest.files.activity_maps.map((file) => unpackActivityMap(zip, file))),
    targets: await Promise.all(manifest.files.targets.map((file) => unpackTarget(zip, file))),
    doseMaps: await Promise.all(manifest.files.dose_maps.map((file) => unpackDoseMap(zip, file))),
  };
}

async function unpackActivityMap(zip: JSZip, file: IrdoseActivityMapPackageFile): Promise<IrdoseUnpackedStudyPackage["activityMaps"][number]> {
  return {
    name: file.name,
    filename: file.filename,
    ...(file.post_injection_time_h !== undefined ? { postInjectionTimeH: file.post_injection_time_h } : {}),
    ...(file.unit ? { unit: file.unit } : {}),
    files: await unpackNestedZip({ packageZip: zip, directory: "activity_maps", filename: file.filename, source: "activity_map", sourceName: file.name }),
  };
}

async function unpackTarget(zip: JSZip, file: IrdoseTargetPackageFile): Promise<IrdoseUnpackedStudyPackage["targets"][number]> {
  return {
    name: file.name,
    filename: file.filename,
    files: await unpackNestedZip({ packageZip: zip, directory: "targets", filename: file.filename, source: "target", sourceName: file.name }),
  };
}

async function unpackDoseMap(zip: JSZip, file: IrdoseDoseMapPackageFile): Promise<IrdoseUnpackedStudyPackage["doseMaps"][number]> {
  return {
    emission: file.emission,
    filename: file.filename,
    files: await unpackNestedZip({ packageZip: zip, directory: "dose_maps", filename: file.filename, source: "dose_map", sourceName: file.emission }),
  };
}

interface NestedZipUnpackOptions {
  packageZip: JSZip;
  directory: string;
  filename: string;
  source: IrdoseUnpackedFileSource;
  sourceName: string;
}

async function unpackNestedZip({ packageZip, directory, filename, source, sourceName }: NestedZipUnpackOptions): Promise<IrdoseUnpackedFile[]> {
  const packagePath = normalizeZipPath(`${directory}/${filename}`);
  const entry = packageZip.file(packagePath);
  if (!entry) {
    throw new IrdosePackageUnpackError(`IRDose package is missing nested ZIP: ${packagePath}`);
  }

  const nestedZip = await JSZip.loadAsync(await entry.async("arraybuffer"));
  const prefix = normalizeZipPath(`${directory}/${filename.replace(/\.zip$/i, "")}`);
  const files: IrdoseUnpackedFile[] = [];
  const entries = Object.values(nestedZip.files).filter((nestedEntry) => !nestedEntry.dir);
  for (const nestedEntry of entries) {
    const innerPath = normalizeZipPath(nestedEntry.name);
    files.push({
      path: normalizeZipPath(`${prefix}/${innerPath}`),
      data: await nestedEntry.async("arraybuffer"),
      source,
      sourceName,
      sourceFilename: filename,
    });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeZipPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  const parts = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || parts.some((part) => !part || part === "." || part === "..")) {
    throw new IrdosePackageUnpackError(`Invalid IRDose package path: ${path}`);
  }
  return normalized;
}
