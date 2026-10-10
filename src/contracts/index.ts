import type { z } from "zod";
import * as S from "./schemas";

export * from "./schemas";
export * from "./pipeline";
export * from "./provider";

export type Confidence = z.infer<typeof S.ConfidenceSchema>;
export type Severity = z.infer<typeof S.SeveritySchema>;
export type DataSource = z.infer<typeof S.DataSourceSchema>;
export type DiagnosisStatus = z.infer<typeof S.DiagnosisStatusSchema>;
export type ImageQualityResult = z.infer<typeof S.ImageQualityResultSchema>;
export type ProviderOutput = z.infer<typeof S.ProviderOutputSchema>;
export type DiagnosisResult = z.infer<typeof S.DiagnosisResultSchema>;
export type RecommendationResult = z.infer<typeof S.RecommendationResultSchema>;
export type RiskResult = z.infer<typeof S.RiskResultSchema>;
export type Alert = z.infer<typeof S.AlertSchema>;
export type FarmerProfile = z.infer<typeof S.FarmerProfileSchema>;
export type ApiError = z.infer<typeof S.ApiErrorSchema>;
export type DiagnoseResponse = z.infer<typeof S.DiagnoseResponseSchema>;
