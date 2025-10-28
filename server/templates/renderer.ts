import { ProductCopyPayload } from './types';
import { ProductCategoryConfig, TechnicalField } from './category-config';

export interface RenderOptions {
  productName: string;
  categoryConfig: ProductCategoryConfig;
  copy: ProductCopyPayload;
  layoutStyle?: 'mediamarkt' | 'minimal' | 'detailed';
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
  const { productName, categoryConfig, copy, layoutStyle = 'mediamarkt' } = options;
  
  const cleanProductName = cleanMarkdown(productName);

  const safetyNotice = cleanMarkdown(copy.safetyNotice || categoryConfig.safetyNotice);
  const packageContents = cleanMarkdown(copy.packageContents || 'Produkt wie beschrieben');
  const highlights = copy.productHighlights || categoryConfig.productHighlights;

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
      highlights,
      technicalSpecs,
      safetyNotice,
      packageContents,
    });
  }

  return renderMediaMarktLayout({
    productName: cleanProductName,
    narrative: cleanNarrative,
    uspBullets,
    highlights,
    technicalSpecs,
    safetyNotice,
    packageContents,
  });
}

function buildTechnicalSpecsTable(
  specs: Record<string, string>,
  fields: TechnicalField[]
): Array<{label: string, value: string}> {
  const result: Array<{label: string, value: string}> = [];

  for (const field of fields) {
    let value = specs[field.label] || specs[field.key];
    
    if (value && value !== 'Nicht angegeben' && value !== 'Nicht sichtbar') {
      value = cleanMarkdown(value);
      
      result.push({
        label: field.label,
        value: value
      });
    } else if (field.required && field.fallback) {
      result.push({
        label: field.label,
        value: cleanMarkdown(field.fallback)
      });
    }
  }

  return result;
}

function renderMediaMarktLayout(data: {
  productName: string;
  narrative: string;
  uspBullets: string[];
  highlights: string[];
  technicalSpecs: Array<{label: string, value: string}>;
  safetyNotice: string;
  packageContents: string;
}): string {
  const uspHtml = data.uspBullets
    .map(usp => `✅ ${usp}`)
    .join('<br />\n');

  const highlightsHtml = data.highlights
    .map(h => `<li>${h}</li>`)
    .join('\n');

  const techTableHtml = data.technicalSpecs.length > 0
    ? `<h4>Technische Daten:</h4>
<table border="0" summary="">
<tbody>
${data.technicalSpecs.map(spec => `<tr><td>${spec.label}:</td><td>${spec.value}</td></tr>`).join('\n')}
</tbody>
</table>

`
    : '';

  return `<h2>${data.productName}</h2>
<p>${data.narrative}<br /><br />
${uspHtml}</p>

<h3>Produkteigenschaften & Highlights</h3>
<ul>
${highlightsHtml}
</ul>

${techTableHtml}<p>${data.productName} steht für Qualität, Zuverlässigkeit und Langlebigkeit – ideal für den täglichen Einsatz.</p>

<h3>Sicherheitshinweise</h3>
<p>${data.safetyNotice}</p>

<h3>Lieferumfang</h3>
<p>${data.packageContents}</p>`;
}
