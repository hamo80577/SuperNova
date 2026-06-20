import { constants } from "node:fs";
import { access, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ImportFileStorageService {
  private readonly storageRoot: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.storageRoot = resolve(
      configService.get<string>("imports.storagePath") ?? "var/imports"
    );
  }

  async assertReadable(filePath: string) {
    const safePath = this.resolveSafePath(filePath);
    await access(safePath, constants.R_OK);
    return safePath;
  }

  async remove(filePath: string) {
    const safePath = this.resolveSafePath(filePath);

    try {
      await unlink(safePath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  }

  private resolveSafePath(filePath: string) {
    const resolvedPath = resolve(filePath);
    const storagePrefix = `${this.storageRoot}${sep}`;

    if (resolvedPath !== this.storageRoot && !resolvedPath.startsWith(storagePrefix)) {
      throw new Error("Import file path is outside IMPORT_STORAGE_PATH.");
    }

    return resolvedPath;
  }
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error;
}
