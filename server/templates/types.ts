export interface ProductCopyPayload {
  narrative: string;
  uspBullets: string[];
  technicalSpecs: Record<string, string>;
  safetyNotice?: string;
  packageContents?: string;
  productHighlights?: string[];
}

export interface GenerateDescriptionInput {
  extractedData: any;
  categoryId: string;
  layoutId?: string;
  customAttributes?: {
    exactProductName?: string;
    articleNumber?: string;
    customAttributes?: Array<{key: string, value: string, type: string}>;
  };
}
