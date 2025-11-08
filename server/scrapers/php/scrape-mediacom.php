<?php
/**
 * CLI Scraper for Mediacom - Single Product URL
 * Usage: php scrape-mediacom.php <url> [selectors_json] [cookies] [userAgent]
 * Returns: JSON with product data
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Get command line arguments
$url = $argv[1] ?? '';
$selectorsJson = $argv[2] ?? '{}';
$cookies = $argv[3] ?? '';
$userAgent = $argv[4] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

if (empty($url)) {
    echo json_encode(['error' => 'URL is required'], JSON_PRETTY_PRINT);
    exit(1);
}

// Include dependencies
$vendorPath = __DIR__ . '/../../vendor/autoload.php';
if (file_exists($vendorPath)) {
    require $vendorPath;
} else {
    // Try parent directory
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

// Create stream context with cookies
$cookieString = $cookies;
if (empty($cookieString)) {
    // Default cookie for Mediacom
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
    // Fetch HTML
    $html = getCached($url, false, $context);
    
    if (empty($html)) {
        echo json_encode(['error' => 'Failed to fetch HTML from URL'], JSON_PRETTY_PRINT);
        exit(1);
    }

    $crawler = new Crawler($html);

    // Extract product data
    $result = [
        'articleNumber' => '',
        'manufacturerArticleNumber' => '',
        'productName' => '',
        'ean' => '',
        'price' => '',
        'images' => [],
        'weight' => '',
        'description' => '',
        'url' => $url
    ];

    // Article Number / SKU
    $articleID = $crawler->filter('.product-detail-ordernumber[itemprop="sku"]')->each(function (Crawler $node, $i) {
        return trim(strip_tags($node->text()));
    });
    
    if (isset($articleID[0])) {
        $result['articleNumber'] = 'MCIT-' . $articleID[0];
        $result['manufacturerArticleNumber'] = $articleID[0];
    }

    // Try alternative selector
    if (empty($result['articleNumber'])) {
        $articleIDAll = $crawler->filter('.product-detail-ordernumber')->each(function (Crawler $node, $i) {
            return trim(strip_tags($node->text()));
        });
        
        if (isset($articleIDAll[0])) {
            $result['articleNumber'] = 'MCIT-' . $articleIDAll[0];
            $result['manufacturerArticleNumber'] = $articleIDAll[0];
        }
        
        if (isset($articleIDAll[1])) {
            $result['manufacturerArticleNumber'] = $articleIDAll[1];
        }
    }

    // EAN
    $ean = $crawler->filter('.product-detail-ordernumber-container > .product-detail-ordernumber')->each(function (Crawler $node, $i) {
        return trim(strip_tags($node->text()));
    });
    
    if (isset($ean[0])) {
        $result['ean'] = end($ean);
    }

    // Fallback: Search for 13-digit EAN in HTML
    if (empty($result['ean'])) {
        $eanMatches = [];
        preg_match('/"\d{13,13}"/i', $html, $eanMatches);
        if (isset($eanMatches[0])) {
            $result['ean'] = trim($eanMatches[0], '"');
        }
    }

    // Product Name
    $name = $crawler->filter('.product-detail-name[itemprop="name"]')->each(function (Crawler $node, $i) {
        return trim(strip_tags($node->text()));
    });
    
    if (isset($name[0])) {
        $name = $name[0];
        $name = preg_replace('/[\r\n]{1,}/', "", $name);
        $name = preg_replace('/\s{2,}/', " ", $name);
        $result['productName'] = trim($name);
    }

    // Images
    $images = $crawler->filter('.gallery-slider-image')->each(function (Crawler $node, $i) {
        $src = trim($node->attr('src'));
        if (!empty($src)) {
            return $src;
        }
        return null;
    });
    
    $images = array_filter($images);
    $images = array_values($images);
    
    // Fallback: Use article number for image URL
    if (empty($images) && !empty($result['manufacturerArticleNumber'])) {
        $images = ['https://importimages.laptopakku.eu/MediaCom/' . $result['manufacturerArticleNumber'] . '.jpg'];
    }
    
    $result['images'] = array_unique($images);

    // Price
    $price = $crawler->filter('meta[itemprop="price"]')->each(function (Crawler $node, $i) {
        return trim($node->attr('content'));
    });
    
    if (isset($price[0])) {
        $priceValue = trim($price[0]);
        // Convert to German format (comma instead of dot)
        $priceValue = str_replace('.', ',', $priceValue);
        $result['price'] = $priceValue;
    }

    // Weight
    $htmlGewicht = $html;
    $gewichtMatches = [];
    preg_match('/gewicht:\s*([\d]{1,})\s*g/i', $htmlGewicht, $gewichtMatches);
    
    if (isset($gewichtMatches[1])) {
        $result['weight'] = trim($gewichtMatches[1]);
    }

    // Description
    $description = $crawler->filter('.product-detail-description, [itemprop="description"]')->each(function (Crawler $node, $i) {
        return trim($node->text());
    });
    
    if (isset($description[0])) {
        $result['description'] = trim($description[0]);
    }

    // Manufacturer
    $result['manufacturer'] = 'MEDIACOM';

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


