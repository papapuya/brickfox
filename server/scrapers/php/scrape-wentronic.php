<?php
/**
 * CLI Scraper for Wentronic - Single Product URL
 * Usage: php scrape-wentronic.php <url> [selectors_json] [cookies] [userAgent]
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
    // Default cookie for Wentronic
    $cookieString = 'timezone=Europe/Berlin; cookie-preference=1;';
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

    // Check availability status
    $productsLieferstatus = $crawler->filter('.product-configurator span.js-availability-product__status')->each(function (Crawler $nodeLiefer, $i) {
        $text = trim(strip_tags($nodeLiefer->html()));
        if (preg_match('/demnächst/i', $text)) {
            return 'demnächst';
        }
        if (preg_match('/anfrage/i', $text)) {
            return 'anfrage';
        }
        if (preg_match('/eol/i', $text)) {
            return 'eol';
        }
        return 'ja';
    });

    if (is_array($productsLieferstatus) && sizeof($productsLieferstatus) > 0) {
        foreach ($productsLieferstatus as $value_liefer) {
            if (preg_match('/eol/i', $value_liefer)) {
                echo json_encode(['error' => 'Product is EOL (End of Life)'], JSON_PRETTY_PRINT);
                exit(1);
            }
            if ($value_liefer != 'ja' && $value_liefer != 'demnächst') {
                echo json_encode(['error' => 'Product only available on request'], JSON_PRETTY_PRINT);
                exit(1);
            }
        }
    }

    // Article Number / SKU
    $articleID = $crawler->filter('.product-configurator__identify .product-identify__item')->each(function (Crawler $nodeLiefer, $i) {
        return preg_replace('/Artikel: |EAN: /', '', trim(strip_tags($nodeLiefer->text())));
    });

    if (isset($articleID[0])) {
        $articleIDValue = trim($articleID[0]);
        $result['articleNumber'] = 'WTD-' . $articleIDValue;
        $result['manufacturerArticleNumber'] = $articleIDValue;
    } else {
        echo json_encode(['error' => 'No article number found'], JSON_PRETTY_PRINT);
        exit(1);
    }

    // EAN
    if (isset($articleID[1])) {
        $result['ean'] = trim($articleID[1]);
    }

    // Product Name
    $name = $crawler->filter('.product-info .product-detail .product-detail__title')->each(function (Crawler $node, $i) {
        return trim(strip_tags($node->text()));
    });
    
    if (isset($name[0])) {
        $result['productName'] = $name[0];
    }

    // Product Name Addon
    $name2 = $crawler->filter('.product-info .product-detail .product-detail__designated')->each(function (Crawler $node, $i) {
        return trim(strip_tags($node->text()));
    });
    
    if (isset($name2[0])) {
        $result['productName'] .= ' - ' . $name2[0];
    }

    // Variant addons
    $nameAddon = $crawler->filter('.variant-configurator__item .is--selected')->each(function (Crawler $node, $i) {
        $return = $node->text();
        if (empty($return)) {
            $return = $node->filter('div')->each(function (Crawler $nodeDiv, $i) {
                return ucfirst($nodeDiv->attr('class'));
            });
            if (isset($return[0])) {
                $return = $return[0];
            }
        }
        return trim(strip_tags($return));
    });

    if (is_array($nameAddon) && sizeof($nameAddon) > 1) {
        foreach ($nameAddon as $value_addon) {
            if (!empty($value_addon) && $value_addon != 'Bulk') {
                $result['productName'] .= ' - ' . $value_addon;
            }
        }
    }

    // Images
    $images = $crawler->filter('.gallery--slider__inner .image-gallery__image')->each(function (Crawler $node, $i) {
        $src = trim($node->attr('src'));
        if (!empty($src)) {
            if (strpos($src, 'http') === 0) {
                return $src;
            }
            return 'https://www.wentronic.com' . $src;
        }
        return null;
    });
    
    $result['images'] = array_values(array_filter(array_unique($images)));

    // Price (EK and VK)
    $priceEK = $crawler->filter('.product-configurator__price .price--unit')->each(function (Crawler $node, $i) {
        $priceText = trim(strip_tags($node->text()));
        // Extract price number
        preg_match('/[\d,]+/', $priceText, $matches);
        if (isset($matches[0])) {
            return str_replace(',', '.', $matches[0]);
        }
        return '';
    });
    
    if (isset($priceEK[0]) && !empty($priceEK[0])) {
        $result['ekPrice'] = str_replace('.', ',', $priceEK[0]);
        $result['price'] = $result['ekPrice'];
    }

    // Technical data
    $articleData = $crawler->filter('.technical--accordion .item--content')->filter('.item--children.grid')->each(function (Crawler $node, $i) {
        return $node->filter('div.col')->each(function ($td, $i) {
            return trim($td->text());
        });
    });

    $articleDataFormated = [];
    if (is_array($articleData) && sizeof($articleData) > 0) {
        foreach ($articleData as $value_data) {
            if (isset($value_data[0]) && isset($value_data[1])) {
                $articleDataFormated[$value_data[0]] = $value_data[1];
            }
        }
    }

    // Extract weight from technical data
    if (isset($articleDataFormated['Gewicht'])) {
        $result['weight'] = preg_replace('/[^0-9,]/', '', $articleDataFormated['Gewicht']);
    }

    // Description
    $description = $crawler->filter('.product-info .product-detail .product-detail__description')->each(function (Crawler $node, $i) {
        return trim($node->html());
    });
    
    if (isset($description[0])) {
        $result['description'] = trim($description[0]);
    }

    // Manufacturer
    $result['manufacturer'] = 'WENTRONIC';

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


