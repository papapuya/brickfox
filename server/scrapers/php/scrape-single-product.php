<?php
/**
 * CLI Wrapper for PHP Scrapers
 * Usage: php scrape-single-product.php <supplier> <url> [selectors_json] [cookies] [userAgent]
 * 
 * Returns JSON with scraped product data
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Get command line arguments
$supplier = $argv[1] ?? '';
$url = $argv[2] ?? '';
$selectorsJson = $argv[3] ?? '{}';
$cookies = $argv[4] ?? '';
$userAgent = $argv[5] ?? '';

if (empty($supplier) || empty($url)) {
    echo json_encode(['error' => 'Missing required parameters: supplier and url']);
    exit(1);
}

// Determine which scraper to use
$scraperFile = __DIR__ . '/' . strtolower($supplier) . '.php';

if (!file_exists($scraperFile)) {
    echo json_encode(['error' => "Scraper not found for supplier: $supplier"]);
    exit(1);
}

// Parse selectors
$selectors = json_decode($selectorsJson, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    $selectors = [];
}

try {
    // Include the scraper file
    // We need to modify the scraper to work with a single URL
    // For now, we'll create a simple wrapper that extracts product data
    
    // Set up environment for the scraper
    $_GET['url'] = $url;
    $_GET['single'] = '1'; // Flag for single product mode
    
    // Capture output
    ob_start();
    
    // Include the scraper (this will execute it)
    // Note: The existing scrapers need to be modified to support single URL mode
    // For now, we'll create a minimal implementation
    
    $result = scrapeSingleProduct($url, $selectors, $cookies, $userAgent, $scraperFile);
    
    ob_end_clean();
    
    // Return JSON result
    header('Content-Type: application/json');
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
    exit(1);
}

/**
 * Scrape a single product URL
 * This is a simplified version that extracts key product data
 */
function scrapeSingleProduct($url, $selectors, $cookies, $userAgent, $scraperFile) {
    // For now, return a basic structure
    // The actual implementation should use the logic from mediacom.php or wentronic.php
    
    return [
        'articleNumber' => '',
        'productName' => '',
        'url' => $url,
        'note' => 'PHP scraper integration needs to be completed - use existing scraper logic'
    ];
}


