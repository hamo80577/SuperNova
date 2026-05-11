import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const TEMPORARY_PASSWORD_PREFIX = "SN";

@Injectable()
export class TemporaryPasswordService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  generate() {
    return `${TEMPORARY_PASSWORD_PREFIX}-${randomBytes(12).toString("base64url")}`;
  }

  encrypt(temporaryPassword: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(temporaryPassword, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url")
    ].join(".");
  }

  decrypt(ciphertext: string) {
    const [ivValue, tagValue, encryptedValue] = ciphertext.split(".");

    if (!ivValue || !tagValue || !encryptedValue) {
      throw new Error("Temporary password ciphertext is invalid.");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.getEncryptionKey(),
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
  }

  private getEncryptionKey() {
    const configuredKey =
      this.configService.get<string>("auth.temporaryPasswordEncryptionKey") ??
      this.configService.getOrThrow<string>("auth.jwtSecret");

    return createHash("sha256").update(configuredKey).digest();
  }
}
