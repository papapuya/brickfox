<?php
/**
 * CLI Scraper for Mediacom - Category/List Scraping (Multiple Pages)
 * Usage: php scrape-category-mediacom.php <categoryUrl> [startPage] [maxPages] [cookies] [userAgent]
 * Returns: JSON with array of product URLs found
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Get command line arguments
$categoryUrl = $argv[1] ?? '';
$startPage = (int)($argv[2] ?? 1);
$maxPages = (int)($argv[3] ?? 10);
$cookies = $argv[4] ?? '';
$userAgent = $argv[5] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

if (empty($categoryUrl)) {
    echo json_encode(['error' => 'Category URL is required'], JSON_PRETTY_PRINT);
    exit(1);
}

// Include dependencies
$vendorPath = __DIR__ . '/../../vendor/autoload.php';
if (file_exists($vendorPath)) {
    require $vendorPath;
} else {
    $vendorPath = __DIR__ . '/../../../vendor/autoload.php';
    if (file_exists($vendorPath)) {
        require $vendorPath;
    } else {
        echo json_encode(['error' => 'Composer vendor/autoload.php not found'], JSON_PRETTY_PRINT);
        exit(1);
    }
}

use Symfony\Component\DomCrawler\Crawler;

// Helper function: Get cached HTML
function getCached($filename, $use_include_path, $context, $cacheTime = 86400) {
    $cachePath = __DIR__ . '/cache/';
    if (!is_dir($cachePath)) {
        @mkdir($cachePath, 0755, true);
    }
    
    $cacheFile = md5($filename) . '.txt';

    if (file_exists($cachePath . $cacheFile) && filemtime($cachePath . $cacheFile) > (time() - $cacheTime)) {
        $html = file_get_contents($cachePath . $cacheFile);
        if ($html === false) {
            $html = '';
        }
    } else {
        $html = file_get_contents($filename, $use_include_path, $context);
        if ($html === false) {
            $html = '';
        } else {
            file_put_contents($cachePath . $cacheFile, $html);
        }
    }

    return $html;
}

// Create stream context
$cookieString = $cookies;
if (empty($cookieString)) {
    $cookieString = 'timezone=Europe/Berlin; cookie-preference=1; session-=' . substr(md5(time()), 0, 26) . ';';
}

$opts = array(
    "ssl" => array(
        "verify_peer" => false,
        "verify_peer_name" => false,
    ),
    'http' => array(
        'method' => "GET",
        'header' => "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n" .
            "Accept-language: de,en-US;q=0.7,en;q=0.3\r\n" .
            "Cookie: " . $cookieString . "\r\n" .
            "User-Agent: " . $userAgent . "\r\n"
    )
);

$context = stream_context_create($opts);

try {
    $allProductUrls = [];
    
    // Generate page URLs
    $pages = [];
    for ($i = $startPage; $i <= ($startPage + $maxPages - 1); $i++) {
        $glue = (strpos($categoryUrl, '?') !== false) ? '&' : '?';
        $pages[] = $categoryUrl . $glue . 'p=' . $i;
    }
    
    foreach ($pages as $pageUrl) {
        $html = getCached($pageUrl, false, $context);
        
        if (empty($html)) {
            continue;
        }
        
        $crawler = new Crawler($html);
        
        // Extract product links
        $products = $crawler->filter('.cms-element-product-listing-wrapper .product-box a.product-image-link')->each(function (Crawler $node, $i) {
            $href = trim($node->attr('href'));
            if (!empty($href)) {
                return $href;
            }
            return null;
        });
        
        $products = array_filter($products);
        $allProductUrls = array_merge($allProductUrls, $products);
        
        // If no products found, stop pagination
        if (empty($products)) {
            break;
        }
    }
    
    // Remove duplicates and make absolute URLs
    $allProductUrls = array_unique($allProductUrls);
    $baseUrl = parse_url($categoryUrl, PHP_URL_SCHEME) . '://' . parse_url($categoryUrl, PHP_URL_HOST);
    
    $result = [
        'productUrls' => array_values(array_map(function($url) use ($baseUrl) {
            if (strpos($url, 'http') === 0) {
                return $url;
            }
            return rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
        }, $allProductUrls)),
        'count' => count($allProductUrls),
        'pagesScraped' => count($pages)
    ];
    
    // Output JSON
    header('Content-Type: application/json');
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
    exit(1);
}


