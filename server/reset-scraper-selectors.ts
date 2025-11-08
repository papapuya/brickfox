/**
 * Script to reset scraper selectors to clean state
 * Removes all technical data selectors (now handled by GPT)
 * Run with: tsx server/reset-scraper-selectors.ts
 */

import { supabaseAdmin } from './supabase';

// Technical data fields that should be removed (now handled by GPT)
// Includes both ANSMANN and Nitecore specific fields
const TECHNICAL_DATA_FIELDS = [
  // ANSMANN technical fields
  'nominalspannung',
  'nominalkapazitaet',
  'maxEntladestrom',
  'laenge',
  'breite',
  'hoehe',
  'gewicht',
  'zellenchemie',
  'energie',
  'farbe',
  // Nitecore technical fields
  'length',
  'bodyDiameter',
  'headDiameter',
  'weightWithoutBattery',
  'totalWeight',
  'powerSupply',
  'led1',
  'led2',
  'spotIntensity',
  'maxLuminosity',
  'maxBeamDistance',
];

// Minimal selectors that should be kept (basic product data)
const KEEP_SELECTORS = [
  'productName',
  'articleNumber',
  'productCode',
  'ean',
  'manufacturer',
  'price',
  'priceGross',
  'rrp',
  'ekPrice',
  'vkPrice',
  'description',
  'longDescription',
  'images',
  'weight',
  'dimensions',
  'category',
];

async function resetScraperSelectors() {
  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exit(1);
  }

  try {
    // Get all suppliers
    const { data: suppliers, error: findError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, selectors');

    if (findError) {
      console.error('❌ Error finding suppliers:', findError);
      process.exit(1);
    }

    if (!suppliers || suppliers.length === 0) {
      console.log('⚠️ No suppliers found.');
      process.exit(0);
    }

    console.log(`📋 Found ${suppliers.length} supplier(s)`);
    console.log('\n🔄 Resetting selectors...\n');

    let updatedCount = 0;

    for (const supplier of suppliers) {
      const existingSelectors = (supplier.selectors as Record<string, string>) || {};
      
      // Create clean selectors object: keep only basic selectors, remove technical data selectors
      const cleanSelectors: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(existingSelectors)) {
        // Keep basic selectors
        if (KEEP_SELECTORS.includes(key)) {
          cleanSelectors[key] = value;
        }
        // Remove technical data selectors (now handled by GPT)
        else if (!TECHNICAL_DATA_FIELDS.includes(key)) {
          // Keep other custom selectors that are not technical data
          cleanSelectors[key] = value;
        }
      }

      // Update supplier with clean selectors
      const { error: updateError } = await supabaseAdmin
        .from('suppliers')
        .update({
          selectors: cleanSelectors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplier.id);

      if (updateError) {
        console.error(`❌ Error updating supplier ${supplier.name}:`, updateError);
        continue;
      }

      const removedCount = Object.keys(existingSelectors).length - Object.keys(cleanSelectors).length;
      console.log(`✅ ${supplier.name}:`);
      console.log(`   - Kept ${Object.keys(cleanSelectors).length} selector(s)`);
      console.log(`   - Removed ${removedCount} technical data selector(s)`);
      
      updatedCount++;
    }

    console.log(`\n✅ Successfully reset ${updatedCount} supplier(s)!`);
    console.log('\n💡 Technical data (Spannung, Kapazität, etc.) will now be extracted by GPT from raw HTML text.');
    console.log('   No CSS selectors needed for technical specifications anymore.');

  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
resetScraperSelectors()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

