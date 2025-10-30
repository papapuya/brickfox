import { ProductCopyPayload } from './types';
import { ProductCategoryConfig, TechnicalField } from './category-config';

export interface RenderOptions {
  productName: string;
  categoryConfig: ProductCategoryConfig;
  copy: ProductCopyPayload;
  layoutStyle?: 'mediamarkt' | 'minimal' | 'detailed';
  technicalDataTable?: string; // Original HTML table from supplier website
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
  const { productName, categoryConfig, copy, layoutStyle = 'mediamarkt', technicalDataTable } = options;
  
  const cleanProductName = cleanMarkdown(productName);

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
}): string {
  const uspHtml = data.uspBullets
    .map(usp => `✅ ${usp}`)
    .join('<br />\n');

  // Use original HTML table if available (1:1 from supplier website)
  const techTableHtml = data.technicalDataTable
    ? `<h4>Technische Daten:</h4>
${data.technicalDataTable}

`
    : data.technicalSpecs.length > 0
    ? `<h4>Technische Daten:</h4>
<table border="0" summary="">
<tbody>
${data.technicalSpecs.map(spec => `<tr><td>${spec.label}:</td><td>${spec.value}</td></tr>`).join('\n')}
</tbody>
</table>

`
    : '';

  // SICHERHEITSHINWEISE: Ohne Icons vom Lieferanten übernehmen
  const safetyHtml = data.safetyNotice 
    ? `<h3>Sicherheitshinweise</h3>
<p>${data.safetyNotice.replace(/⚠️/g, '').replace(/[🔥⚡☢️]/g, '').trim()}</p>

`
    : '';

  return `<h2>${data.productName}</h2>
<p>${data.narrative}</p>

<p>${uspHtml}</p>

${techTableHtml}${safetyHtml}<h3>Lieferumfang</h3>
<p>${data.packageContents}</p>`;
}
