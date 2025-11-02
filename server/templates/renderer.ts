import { ProductCopyPayload } from './types';
import { ProductCategoryConfig, TechnicalField } from './category-config';

export interface RenderOptions {
  productName: string;
  categoryConfig: ProductCategoryConfig;
  copy: ProductCopyPayload;
  layoutStyle?: 'mediamarkt' | 'minimal' | 'detailed';
  technicalDataTable?: string; // Original HTML table from supplier website
  safetyWarnings?: string; // 1:1 safety warnings from supplier (without icons)
  pdfManualUrl?: string; // PDF manual URL for reference
}

function cleanMarkdown(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // Entferne "- **" am Anfang
  cleaned = cleaned.replace(/^-\s*\*\*/gm, '');
  
  // Entferne alle ** (bold markers)
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Entferne alle * (italic markers)
  cleaned = cleaned.replace(/\*/g, '');
  
  // Entferne führende/folgende Leerzeichen
  cleaned = cleaned.trim();
  
  return cleaned;
}

export function renderProductHtml(options: RenderOptions): string {
  const { productName, categoryConfig, copy, layoutStyle = 'mediamarkt', technicalDataTable, safetyWarnings, pdfManualUrl } = options;
  
  const cleanProductName = cleanMarkdown(productName);

  // USE AI-GENERATED SAFETY WARNINGS (based on supplier warnings if available)
  const safetyNotice = cleanMarkdown(copy.safetyNotice || categoryConfig.safetyNotice);
  const packageContents = cleanMarkdown(copy.packageContents || 'Produkt wie beschrieben');

  // Use original HTML table if available, otherwise build from specs
  const technicalSpecs = buildTechnicalSpecsTable(
    copy.technicalSpecs,
    categoryConfig.technicalFields
  );

  const cleanNarrative = cleanMarkdown(copy.narrative);
  const uspBullets = copy.uspBullets.map(usp => cleanMarkdown(usp)).slice(0, 5);
  while (uspBullets.length < 5) {
    const remainingTemplates = categoryConfig.uspTemplates.filter(
      template => !uspBullets.includes(template)
    );
    if (remainingTemplates.length > 0) {
      uspBullets.push(remainingTemplates[0]);
    } else {
      break;
    }
  }

  if (layoutStyle === 'mediamarkt') {
    return renderMediaMarktLayout({
      productName: cleanProductName,
      narrative: cleanNarrative,
      uspBullets,
      technicalSpecs,
      safetyNotice,
      packageContents,
      technicalDataTable, // Pass original HTML table
      pdfManualUrl, // Pass PDF URL for reference
    });
  }

  return renderMediaMarktLayout({
    productName: cleanProductName,
    narrative: cleanNarrative,
    uspBullets,
    technicalSpecs,
    safetyNotice,
    packageContents,
    technicalDataTable, // Pass original HTML table
    pdfManualUrl, // Pass PDF URL for reference
  });
}

function buildTechnicalSpecsTable(
  specs: Record<string, string>,
  fields: TechnicalField[]
): Array<{label: string, value: string}> {
  const result: Array<{label: string, value: string}> = [];

  // 1:1 ÜBERNAHME: Alle Felder aus specs übernehmen (nicht nur vordefinierte!)
  for (const [label, value] of Object.entries(specs)) {
    if (value && value !== 'Nicht angegeben' && value !== 'Nicht sichtbar' && value !== '-') {
      result.push({
        label: label,
        value: cleanMarkdown(value)
      });
    }
  }

  // Falls keine Specs vorhanden, füge required Felder mit Fallbacks hinzu
  if (result.length === 0) {
    for (const field of fields) {
      if (field.required && field.fallback) {
        result.push({
          label: field.label,
          value: cleanMarkdown(field.fallback)
        });
      }
    }
  }

  console.log(`📊 Technische Daten: ${result.length} Felder 1:1 übernommen`);
  return result;
}

function renderMediaMarktLayout(data: {
  productName: string;
  narrative: string;
  uspBullets: string[];
  technicalSpecs: Array<{label: string, value: string}>;
  safetyNotice: string;
  packageContents: string;
  technicalDataTable?: string; // Original HTML table from supplier
  pdfManualUrl?: string; // PDF manual URL for reference
}): string {
  const uspHtml = data.uspBullets
    .map(usp => `✅ ${usp}`)
    .join('<br />\n');

  // Build technical specs table with left-aligned values
  const techTableHtml = data.technicalSpecs.length > 0
    ? `<h4>Technische Daten:</h4>
<table border="0" summary="" style="border-collapse: collapse; width: 100%; max-width: 600px;">
<tbody>
${data.technicalSpecs.map(spec => `<tr>
  <td style="padding: 4px 12px 4px 0; text-align: right; vertical-align: top; font-weight: 600; white-space: nowrap;">${spec.label}</td>
  <td style="padding: 4px 0 4px 8px; text-align: left; vertical-align: top;">${spec.value}</td>
</tr>`).join('\n')}
</tbody>
</table>

`
    : '';

  // 1:1 SICHERHEITSHINWEISE: Entferne nur Icons, übernehme Text unverändert
  const safetyHtml = data.safetyNotice 
    ? `<h3>Sicherheitshinweise</h3>
<p>${data.safetyNotice.replace(/⚠️/g, '').replace(/[🔥⚡☢️]/g, '').trim()}</p>

`
    : '';

  // PDF-Hinweis (optional, falls vorhanden)
  const pdfHtml = data.pdfManualUrl
    ? `<p><strong>📄 Bedienungsanleitung:</strong> <a href="${data.pdfManualUrl}" target="_blank">Download PDF</a></p>

`
    : '';

  return `<h2>${data.productName}</h2>
<p>${data.narrative}</p>
<br />

<p>${uspHtml}</p>
<br />

${techTableHtml}${techTableHtml ? '<br />\n' : ''}${safetyHtml}${safetyHtml ? '<br />\n' : ''}${pdfHtml}${pdfHtml ? '<br />\n' : ''}<h3>Lieferumfang</h3>
<p>${data.packageContents}</p>`;
}
