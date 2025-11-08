/**
 * Script to setup ANSMANN supplier selectors
 * Run with: tsx server/setup-ansmann-selectors.ts
 */

import { supabaseAdmin } from './supabase';

interface ANSMANNSelectors {
  // Basis-Daten
  productName: string;
  articleNumber: string;
  ean: string;
  manufacturer: string;
  
  // Preise
  price: string;
  
  // Medien
  images: string;
  
  // Beschreibungen
  description: string;
  longDescription: string;
  
  // ANSMANN Technische Daten
  nominalspannung?: string;
  nominalkapazitaet?: string;
  maxEntladestrom?: string;
  laenge?: string;
  breite?: string;
  hoehe?: string;
  gewicht?: string;
  zellenchemie?: string;
  energie?: string;
  farbe?: string;
}

const ANSMANN_SELECTORS: ANSMANNSelectors = {
  // Basis-Daten - typische Magento/ANSMANN Selektoren
  productName: 'h1.page-title, .product-name, h1',
  articleNumber: '.product-code, .sku, [itemprop="sku"]',
  ean: '.ean-code, [data-ean], .gtin',
  manufacturer: '.manufacturer, .brand, [itemprop="brand"]',
  
  // Preise
  price: '.price, .price-box .price, [data-price-type="finalPrice"]',
  
  // Medien
  images: '.product-image img, .gallery-image img, .fotorama__img',
  
  // Beschreibungen
  description: '.product-description, .short-description',
  longDescription: '.product-info-description, .product-description-full',
  
  // ANSMANN Technische Daten
  // Diese werden normalerweise aus Tabellen extrahiert, aber können auch direkt selektiert werden
  // Die automatische Tabellenerkennung sollte diese finden, aber hier sind direkte Selektoren als Fallback
  nominalspannung: '', // Wird automatisch aus Tabellen extrahiert
  nominalkapazitaet: '', // Wird automatisch aus Tabellen extrahiert
  maxEntladestrom: '', // Wird automatisch aus Tabellen extrahiert
  laenge: '', // Wird automatisch aus Tabellen extrahiert
  breite: '', // Wird automatisch aus Tabellen extrahiert
  hoehe: '', // Wird automatisch aus Tabellen extrahiert
  gewicht: '', // Wird automatisch aus Tabellen extrahiert
  zellenchemie: '', // Wird automatisch aus Tabellen extrahiert
  energie: '', // Wird automatisch aus Tabellen extrahiert
  farbe: '', // Wird automatisch aus Tabellen extrahiert
};

async function setupANSMANNSelectors() {
  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exit(1);
  }

  try {
    // Find ANSMANN supplier
    const { data: suppliers, error: findError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, selectors')
      .ilike('name', '%ansmann%');

    if (findError) {
      console.error('❌ Error finding ANSMANN supplier:', findError);
      process.exit(1);
    }

    if (!suppliers || suppliers.length === 0) {
      console.log('⚠️ No ANSMANN supplier found. Please create one first in the UI.');
      console.log('   Then run this script again to update the selectors.');
      process.exit(0);
    }

    const ansmannSupplier = suppliers[0];
    console.log(`✅ Found ANSMANN supplier: ${ansmannSupplier.name} (${ansmannSupplier.id})`);

    // Merge existing selectors with ANSMANN selectors (don't overwrite custom selectors)
    const existingSelectors = (ansmannSupplier.selectors as Record<string, string>) || {};
    const mergedSelectors = {
      ...ANSMANN_SELECTORS,
      ...existingSelectors, // Keep existing custom selectors
    };

    // Update supplier with merged selectors
    const { data: updatedSupplier, error: updateError } = await supabaseAdmin
      .from('suppliers')
      .update({
        selectors: mergedSelectors,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ansmannSupplier.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating supplier:', updateError);
      process.exit(1);
    }

    console.log('✅ Successfully updated ANSMANN supplier selectors!');
    console.log('\n📋 Configured selectors:');
    console.log(JSON.stringify(mergedSelectors, null, 2));
    console.log('\n💡 Note: Technical specifications (nominalspannung, etc.) are automatically extracted from tables.');
    console.log('   If you need direct selectors, you can add them manually in the supplier profile.');

  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
setupANSMANNSelectors()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });


