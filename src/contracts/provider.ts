/**
 * Provider-independent diagnosis boundary. Owner of implementations: Joy.
 * Implementations MAY return anything; the pipeline treats the result as
 * untrusted and validates it with ProviderOutputSchema.
 */
export interface DiagnosisProviderInput {
  imageBytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface DiagnosisProvider {
  readonly name: string;
  /** "mock_demo" providers MUST return source-labelled demo data. */
  readonly source: "live" | "mock_demo";
  diagnose(input: DiagnosisProviderInput): Promise<unknown>;
}

export interface ImageQualityChecker {
  check(input: DiagnosisProviderInput): Promise<unknown>; // validated with ImageQualityResultSchema
}
