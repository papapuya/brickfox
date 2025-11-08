<?php
set_time_limit(0);
require 'vendor/autoload.php';

$AkkuDomCrawler = new AkkuDomCrawler();

use Symfony\Component\DomCrawler\Crawler;

$username = 'pixiAKU'; // Your pixi database
$password = 'jQYHhSvncHgmew_AKU'; // Your API password
$uri = 'https://api.pixi.eu/soap/pixiAKU/'; // Enpoint of your API
$location = 'https://api.pixi.eu/soap/pixiAKU/'; // if your uri is differend from the endpoint location should be added and uri corrected

$options = new Pixi\API\Soap\Options($username, $password, $uri, $location);
$options->allowSelfSigned(); // if the certificate is self signed

$soapClient = new \Pixi\API\Soap\Client(null, $options->getOptions());


/*Pixi TEST*/
/*
$allSupplier = $soapClient->pixiGetItemSuppliers(array('ItemNrSuppl' => '10232'))->getResultSet();
echo "<pre>";
print_r($allSupplier);
echo "</pre>";
$allSupplier = $soapClient->pixiGetItemInfo(array('ItemNrSuppl' => '10232'))->getResultSet();
echo "<pre>";
print_r($allSupplier);
echo "</pre>";
$allSupplier = $soapClient->pixiItemSearch(array('RowCount' => '999999', 'SupplNr' => '7001'))->getResultSet();
echo "<pre>";
print_r($allSupplier);
echo "</pre>";
die();
*/
/*Pixi TEST*/

//$response = $soapClient->pixiGetShops()->getResultSet();

$pixiSupplier = '7002';
$p_group_path = 'INTERN##||##Import##||##WENTRONIC';
$p_group_pathGiven = 'INTERN##||##Import##||##WENTRONIC';
//$p_group_pathGiven = 'Kabel, TV, Musik und Zubehör | Computerzubehör | Verschiedenes';

/*
$allSupplier = modCachPixiCall64('pixiGetSuppliers', array());
echo "<pre>";
print_r($allSupplier);
echo "</pre>";
die();
*/
$csvData = [];
$csvContent = csv_to_array('syncCSV/Wentronic.csv', ';', '"');
if (is_array($csvContent) && sizeof($csvContent) > 0) {
	foreach ($csvContent as $key => $value) {
		$csvData[trim($value['Artikelnummer'])] = $value;
	}
}

$allItemssupplierItemNrSuppl = [];
//$allItemssupplier = $soapClient->pixiItemSearch(array('SupplNr' => $pixiSupplier, 'ShowOnlyItemsForExactSupplier' => '1'))->getResultSet();
$allItemssupplier = modCachPixiCall64('pixiItemSearch', array('RowCount' => '999999', 'SupplNr' => $pixiSupplier, 'ShowOnlyItemsForExactSupplier' => '1'));
if (is_array($allItemssupplier) && sizeof($allItemssupplier) > 0) {
	foreach ($allItemssupplier as $key => $value) {
		if (isset($value['ItemNrSuppl'])) {
			$allItemssupplierItemNrSuppl[$value['ItemNrSuppl']] = $value;
		}
	}
}

//$url_to_check = 'https://www.wentronic.de/de/Search/index/sSearch/%2A%2A%2A/followSearch/9915/ffRefKey/wDYD1zxDn/ffSort/Contribution_Margin_Grouped_desc/sPerPage/48?&sCat=***&sTemplate=';
//$url_to_check = 'https://www.wentronic.de/de/search?sSearch=MFi+Kabel+f%C3%BCr+Apple+iPhone%2FiPad+Wei%C3%9F';
//$url_to_check = 'https://www.wentronic.de/de/batterien/blei-akkus/?=%2A&l=table&followSearch=9841&ffSort=_desc&n=48';
//$url_to_check = 'https://www.wentronic.de/de/licht/leuchten/lupenleuchten/';
//$url_to_check = 'https://www.wentronic.de/de/licht/leuchten/taschenlampen-und3-laternen/';
//$url_to_check = 'https://www.wentronic.de/de/search?sSearch=lichterkette';
//$url_to_check = 'https://www.wentronic.de/de/search/index/sSearch/%2A%2A%2A/sCat/Demn%C3%A4chst/ffFilter|Soon|1/1?ffSort=PublishDate_desc';
//$url_to_check = 'https://www.wentronic.de/de/Search/index/sSearch/%2A%2A%2A/followSearch/9915/ffRefKey/MXcsWQWOZ/sPerPage/48/ffFilter%7CNew%7C1/1?sCat=***&ffSort=PublishDate_desc';
//$url_to_check = 'https://www.wentronic.de/de/search?sSearch=dunkle+jahreszeit&sTemplate=table&sPerPage=48&ffSort=1&loggedIn=1';
//$url_to_check = 'https://www.wentronic.com/de/search?q=LED-Baustrahler+mit+Standfu%C3%9F';
//$url_to_check = 'https://www.wentronic.com/de/campaign/Herbst %26 Winterbeleuchtung_325';
$url_to_check = 'https://www.wentronic.com/de/wentronic/hauptkatalog-global-online-&-print/netzwerk/lichtwellenleiter-(lwl)?sort=popularity';

$cookieSet = 'p00o74fll5mvp8nlml4egatr3v';

// Create a stream
$opts = array(
  'http'=>array(
    'method'=>"GET",
    'header'=>"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n".
    		  "Accept-language: de,en-US;q=0.7,en;q=0.3\r\n" .
              "Cookie: _ga=GA1.2.1938315660.1584443551; www-wentronic-com=".$cookieSet."; COOKIES_ACCEPTED=all; _gid=GA1.2.958529076.1607325784; _gat_UA-45004220-4=1"."\r\n"
  )
);

$context = stream_context_create($opts);

$pageStart = 1;
$pagesMax = 1;
//$pagesMax = 277;
$pages = [];


for ($i = $pageStart; $i <= $pagesMax; $i++) {
	$glue = '?';
	if (preg_match('/\?/', $url_to_check)) {
		$glue = '&';
	}

	$pages[] = $url_to_check.$glue.'page='.$i;
}

$filename = 'brick_'.substr(hash('sha1', $url_to_check),-8).'.csv';

if (is_array($pages) && sizeof($pages) == 0) {
	$pages = array($url_to_check);
}

$images_max = 0;
$media_max = 0;

$i_gesamt = 0;

$csvInhalt = [];
$csvInhalt[0] = [
	'p_item_number' => 'p_item_number',
	'p_group_path[de]' => 'p_group_path[de]',
	'p_brand' => 'p_brand',
	'p_status' => 'p_status',
	'p_name[de]' => 'p_name[de]',
	'p_tax_class' => 'p_tax_class',
	'p_never_out_of_stock' => 'p_never_out_of_stock',
	'p_condition' => 'p_condition',
	'v_item_number' => 'v_item_number',
	'v_ean' => 'v_ean',
	'v_manufacturers_item_number' => 'v_manufacturers_item_number',
	'v_status' => 'v_status',
	'v_classification' => 'v_classification',
	'v_price[Eur]' => 'v_price[Eur]',
	'v_delivery_time[de]' => 'v_delivery_time[de]',
	'v_supplier[Eur]' => 'v_supplier[Eur]',
	'v_supplier_item_number' => 'v_supplier_item_number',
	'v_purchase_price' => 'v_purchase_price',
	'v_never_out_of_stock[standard]' => 'v_never_out_of_stock[standard]',
	'v_weight' => 'v_weight',
	'p_country' => 'p_country',
	'v_customs_tariff_number' => 'v_customs_tariff_number',
	'v_customs_tariff_text' => 'v_customs_tariff_text',
	//'v_name[de]' => 'v_name[de]',
	'p_description[de]' => 'p_description[de]',
	'p_attributes[OTTOMARKET_GEFAHRGUT][de]' => 'p_attributes[OTTOMARKET_GEFAHRGUT][de]',
	'v_attributes[OTTOMARKET_GEFAHRGUT][de]' => 'v_attributes[OTTOMARKET_GEFAHRGUT][de]',
];

$variantenInhalt = [];
$allProducts = [];
foreach ($pages as $key_page => $value_page) {
	$crawler = new Crawler(getCached($value_page, false, $context));

	$products = $crawler->filter('.products-listing-section .product-card__container a.product-card__overlay')->each(function (Crawler $node, $i) {
		global $images_max, $media_max, $allItemssupplierItemNrSuppl, $context, $soapClient, $p_group_path, $p_group_pathGiven, $pixiSupplier, $i_gesamt, $AkkuDomCrawler, $variantenInhalt, $csvData;
		$href = 'https://www.wentronic.com'.$node->attr('href');

		$i_gesamt++;

		$akkuReturn = [];

		$crawlerProd = new Crawler(getCached($href, false, $context));

		//auf varianten prüfen.
		$articleVariant = $crawlerProd->filter('.variant-configurator .custom-input-list--label')->each(function (Crawler $node, $i) {
			if (preg_match('/Blister/i', $node->text()) || preg_match('/polybag/i', $node->text()) || preg_match('/retail/i', $node->text()) || preg_match('/cable tag/i', $node->text())) {
				return '';
			}
			return 'https://www.wentronic.com'.trim($node->attr('href'));
		});

		$articleVariant = array_unique($articleVariant);

		if (is_array($articleVariant) && sizeof($articleVariant) > 1) {

			echo "<pre>Varianten Überspringen:<br>";
			print_r($href);
			echo "</pre>";
			
			$akkuReturn[] = 'Varianten Artikel Überspringen';
			return $akkuReturn;

			foreach ($articleVariant as $key_variant => $value_variant) {
				//alle Varianten durch und neue holen
				$crawlerProd = new Crawler(getCached($value_variant, false, $context));
				//auf varianten prüfen.
				$articleVariantProd = $crawlerProd->filter('a.variations-anchor')->each(function (Crawler $node, $i) {
					return $node->attr('href');
				});
				$articleVariant = array_merge($articleVariant, $articleVariantProd);
			}
		}

		$articleVariant = array_unique($articleVariant);
		$articleVariant = array_filter($articleVariant);

		if (is_array($articleVariant) && sizeof($articleVariant) > 1) {
			$sha1 = mb_strtoupper('WTD-'.substr(hash('sha1', $href),-8));			
			foreach ($articleVariant as $key_variant => $value_variant) {
				$crawlerProd = new Crawler(getCached($value_variant, false, $context));
				$akkuReturn[] = $AkkuDomCrawler->checkOneProduct($crawlerProd, $value_variant);
				if (isset($akkuReturn[sizeof($akkuReturn)-1]['p_item_number'])) {
					$variantenInhalt[$akkuReturn[sizeof($akkuReturn)-1]['p_item_number']] = $sha1;
				}
			}
		} else {
			$akkuReturn[] = $AkkuDomCrawler->checkOneProduct($crawlerProd, $href);
		}

		/*echo "<pre>";
		print_r($akkuReturn);
		echo "</pre>";
		echo "<pre>";
		print_r($articleVariant);
		echo "</pre>";
		die();*/

		return $akkuReturn;    	
	});

	if (is_array($products) && sizeof($products) > 0) {
		foreach ($products as $key_prod => $value_prod) {
			$allProducts = array_merge($allProducts, $value_prod);
		}
	}
	

	

	/*echo "<pre>";
	print_r($allProducts);
	echo "</pre>";
	echo "<pre>";
	print_r($images_max);
	echo "</pre>";

	die();*/
}

for ($i = 1; $i <= $images_max; $i++) {
	$csvInhalt[0]['p_image['.$i.']'] = 'p_image['.$i.']';
}

for ($i = 1; $i <= $media_max; $i++) {
	$csvInhalt[0]['p_media['.$i.'][pdf]'] = 'p_media['.$i.'][pdf]';
	$csvInhalt[0]['p_media_name['.$i.']'] = 'p_media_name['.$i.']';
}

if (is_array($variantenInhalt) && sizeof($variantenInhalt) > 0) {
	$csvInhalt[0]['v_options[Kabellänge][de]'] = 'v_options[Kabellänge][de]';
}

if (is_array($allProducts) && sizeof($allProducts) > 0) {
	foreach ($allProducts as $key => $value) {
		if (!isset($value['p_item_number'])) {
			continue;
		}
		
		if (isset($variantenInhalt[$value['p_item_number']])) {
			$value['p_item_number'] = $variantenInhalt[$value['p_item_number']];
			$value['name'] = preg_replace('# - (.*)$#i', '', $value['name']);
		}

		if (isset($value['beschreibung']) && $value['beschreibung']!='') {
			$value['beschreibung'] = '<div class="wtdDesc">'.$value['beschreibung'].'</div>';
		}

		if (isset($_GET['showHTML'])) {
			print_r('<h1>'.$value['name'].'</h1>');
			print_r('<h3>'.$value['p_item_number'].'</h3>');
			print_r('<h4>'.$value['priceEK'].' | '.$value['priceVK'].'</h4>');
			print_r('<h5>Gewicht: '.$value['weight'].'</h5>');
			print_r('<h5>p_country: '.$value['p_country'].'</h5>');
			print_r('<h5>v_customs_tariff_number: '.$value['v_customs_tariff_number'].'</h5>');
			print_r('<h5>v_customs_tariff_text: '.$value['v_customs_tariff_text'].'</h5>');
			echo '<div style="border: 1px solid #000000;">';
			print_r($value['beschreibung']);
			echo "</div>";
			for ($i = 1; $i <= $images_max; $i++) {
				if (isset($value['images'][$i-1])) {
					echo '<img src="'.$value['images'][$i-1].'" style="width: 12%;" />';
				}
			}
			echo "<hr>";
			flush();
			ob_flush();
		}

		$csvInhalt[$key+1] = [
			'p_item_number' => $value['p_item_number'],
			'p_group_path[de]' => $value['kategorie'],
			'p_brand' => $value['manufacturer'],
			'p_status' => '1',
			'p_name[de]' => $value['name'],
			'p_tax_class' => '1',
			'p_never_out_of_stock' => '1',
			'p_condition' => 'editDesc',
			'v_item_number' => $value['v_manufacturers_item_number'],
			'v_ean' => $value['ean'],
			'v_manufacturers_item_number' => $value['mpn'],
			'v_status' => '1',
			'v_classification' => 'X',
			'v_price[Eur]' => number_format($value['priceVK'],2 ,'.', ''),
			'v_delivery_time[de]' => '3-5 Tage',
			'v_supplier[Eur]' => $pixiSupplier,
			'v_supplier_item_number' => $value['mpn'],
			'v_purchase_price' => number_format($value['priceEK'],2 ,'.', ''),
			'v_never_out_of_stock[standard]' => '1',
			'v_weight' => $value['weight'],
			'p_country' => $value['p_country'],
			'v_customs_tariff_number' => $value['v_customs_tariff_number'],
			'v_customs_tariff_text' => $value['v_customs_tariff_text'],
			//'v_name[de]' => $value['v_name_de'],
			'p_description[de]' => $value['beschreibung'],
			'p_attributes[OTTOMARKET_GEFAHRGUT][de]' => 'Produkt fällt nicht unter die Gefahrgutvorschriften.',
			'v_attributes[OTTOMARKET_GEFAHRGUT][de]' => 'Produkt fällt nicht unter die Gefahrgutvorschriften.'
		];

		for ($i = 1; $i <= $images_max; $i++) {
			$csvInhalt[$key+1][] = isset($value['images'][$i-1])?$value['images'][$i-1]:'';
		}

		for ($i = 1; $i <= $media_max; $i++) {
			$media_file = isset($value['media'][$i-1])?$value['media'][$i-1]:'';
			$media_name = preg_replace('/#/','_',urldecode(basename($media_file)));
			$csvInhalt[$key+1]['p_media['.$i.'][pdf]'] = $media_file;
			$csvInhalt[$key+1]['p_media_name['.$i.']'] = $media_name;
		}

		if (is_array($variantenInhalt) && sizeof($variantenInhalt) > 0) {
			$csvInhalt[$key+1]['v_options[Kabellänge][de]'] = trim(preg_replace('#Kabellänge: |Verpackungstyp: Cable Tag - #i', '', $value['v_name_de']));
		}
	}
}

$file = fopen($filename,"w");

foreach ($csvInhalt as $line) {
	fputcsv($file, $line, ';');
}

fclose($file);

echo "<pre>";
print_r($csvInhalt);
echo "</pre>";


echo "<pre>";
print_r('CSV Erstellt '.(sizeof($csvInhalt)-1));
echo "</pre>";
echo "<pre>";
print_r('gesamt: '.$i_gesamt);
echo "</pre>";


if (isset($_GET['showHTML'])) {
	?>
	<style type="text/css">
	.clearfix {
		clear: both;
	}
.product--properties {
}
.product--properties.downloads .article--property--name {
 font-weight:300
}
.product--properties.downloads .article--property--value a {
 color:#b71e3b
}
.article--properties {
 border-bottom:1px solid #e9e7e7;
 border-top:none;
 display:block;
}
.article--properties:last-child {
 border:none
}
.article--properties--head {
 border-bottom:1px solid #bcbcbc;
 border-top:none;
 color:#464749;
 font-weight:700;
 margin-top:15px;
 margin-top:1.5rem;
}
.article--properties--head:first-child {
 margin-top:0px;
 margin-top:0rem
}
.article--property--name {
 display:block;
 float:left;
 font-weight:600;
 width:100%
}
@media screen and (min-width:48em) {
 .article--property--name {
  width:41.6667%
 }
}
.article--property--value {
 display:block;
 float:left;
 font-weight:300;
 width:100%
}
@media screen and (min-width:48em) {
 .article--property--value {
  width:58.3333%
 }
}
	</style>
	<?php
}

function getCached($filename, $use_include_path, $context, $cacheTime = 86400) {
	$cachePath = getcwd().'/cache/';
    $cacheFile = md5($filename).'.txt';

    if (file_exists($cachePath.$cacheFile) && filemtime($cachePath.$cacheFile) > (time() - $cacheTime)) {
    	$html = file_get_contents($cachePath.$cacheFile);
    	if ($html === false) {
    		$html = '';
    	}
    } else {
    	$html = file_get_contents($filename, $use_include_path, $context);
    	if ($html === false) {
    		$html = '';
    	}
    	file_put_contents($cachePath.$cacheFile,$html);
    }	

	return $html;
}

function getCached64($filename, $use_include_path, $context, $cacheTime = 86400) {
	$cachePath = getcwd().'/cache/';
    $cacheFile = '64_'.md5($filename).'.txt';

    if (file_exists($cachePath.$cacheFile) && filemtime($cachePath.$cacheFile) > (time() - $cacheTime)) {
    	$html = base64_decode(file_get_contents($cachePath.$cacheFile));
    } else {
    	$html = file_get_contents($filename, $use_include_path, $context);
    	file_put_contents($cachePath.$cacheFile,base64_encode($html));
    }	

	return $html;
}

function modCachPixiCall64($call, $args, $cacheTime = 86400) {
	global $soapClient;
	$cachePath = getcwd().'/cache/';
	$cacheFile = '64pixi_'.md5($call.serialize($args)).'.txt';

	if (file_exists($cachePath.$cacheFile) && filemtime($cachePath.$cacheFile) > (time() - $cacheTime)) {
		$resultset = unserialize(base64_decode(file_get_contents($cachePath.$cacheFile)));
	} else {
		$result = $soapClient->$call($args);
		$resultset = $result->getResultset();
		file_put_contents($cachePath.$cacheFile,base64_encode(serialize($resultset)));
	}

	return $resultset;
}

function round_to($number, $step = 1, $sub = 0) {
    $number += $sub; // damit auch richtig gerundet wird
    if($step == 0 || $step == 1) return round($number) - $sub;
 
    return (round($number / $step) * $step) - $sub;
}


/**
 * 
 */
class AkkuDomCrawler
{
	
	function __construct()
	{
		# code...
	}

	public function checkOneProduct($crawlerProd, $akkuUrl) {
		global $images_max, $media_max, $allItemssupplierItemNrSuppl, $context, $soapClient, $p_group_path, $p_group_pathGiven, $pixiSupplier, $i_gesamt, $href, $csvData;

		//lieferstatus checken
		$productsLieferstatus = $crawlerProd->filter('.product-configurator span.js-availability-product__status')->each(function (Crawler $nodeLiefer, $i) {
			$text = trim(strip_tags($nodeLiefer->html()));
			if (preg_match('/demnächst/i', $text)) {
				//return $text;
			}
			if (preg_match('/anfrage/i', $text)) {
				return $text;
			}
			if (preg_match('/eol/i', $text)) {
				return $text;
			}
			return 'ja';
		});

		if (is_array($productsLieferstatus) && sizeof($productsLieferstatus) > 0) {
			foreach ($productsLieferstatus as $key_liefer => $value_liefer) {
				if (preg_match('/eol/i', $value_liefer)) {
					echo "<pre>EOL<br>";
					print_r($akkuUrl);
					echo "</pre>";
					
					return 'EOL';
				}
				if ($value_liefer != 'ja') {
					echo "<pre>Nur auf Anfrage<br>";
					print_r($akkuUrl);
					echo "</pre>";
					
					return 'Nur auf anfrage';
				}
			}
		}

		$articleID = $crawlerProd->filter('.product-configurator__identify .product-identify__item')->each(function (Crawler $nodeLiefer, $i) {
			return preg_replace('/Artikel: |EAN: /', '', trim(strip_tags($nodeLiefer->text())));
		});

		if (isset($articleID[1])) {
			$ean = trim($articleID[1]);
		}else {
			$ean = '';
		}

		if (empty($ean) && isset($csvData['articleID']['EAN-Code']) && !empty($csvData['articleID']['EAN-Code'])) {
			$ean = $csvData['articleID']['EAN-Code'];
		}

		if (isset($articleID[0])) {
			$articleID = trim($articleID[0]);
		}else{
			echo "<pre>No Artikel-Nr.:<br>";
			print_r($akkuUrl);
			echo "</pre>";
			return 'No Artikel-Nr.: '.$akkuUrl;
		}

		/*set old ean to pixi*/
		if (!empty($ean) && isset($_GET['fixEcoEAN'])) {
			$itemEanSet = false;
			$checkArtNr = 'WTD-'.$articleID;

			if (isset($allItemssupplierItemNrSuppl[$articleID])) {
				$allSupplier = modCachPixiCall64('pixiGetItemSuppliers', array('ItemKey' => $allItemssupplierItemNrSuppl[$articleID]['ItemKey']));
			} else {
				$allSupplier = modCachPixiCall64('pixiGetItemSuppliers', array('ItemNrSuppl' => $articleID));
			}
			
			if (is_array($allSupplier) && sizeof($allSupplier) > 1) {
				foreach ($allSupplier as $key_all_supplier => $value_all_supplier) {
					if (isset($value_all_supplier['SupplNr']) && $value_all_supplier['SupplNr'] == $pixiSupplier && isset($value_all_supplier['EANUPC']) && $value_all_supplier['EANUPC'] != $ean && isset($value_all_supplier['ItemNrSuppl']) && $value_all_supplier['ItemNrSuppl'] == $articleID) {
						$itemEanSet = true;
						$itemItemNrSuppl = modCachPixiCall64('pixiGetItemInfo', array('ItemNrSuppl' => $articleID));
						$setArray = array(
							'ItemKey' => $itemItemNrSuppl[0]['ItemKey'],
							'SupplNr' => $pixiSupplier,
							'EAN' => $ean
						);
						if (isset($_GET['writeDB'])) {
							$result_supplier_set = $soapClient->pixiSetItemSupplier($setArray);
                            $result_supplier_set_set = $result_supplier_set->getResultset();
                            echo "<pre>oben<br>";
							print_r($result_supplier_set_set);
							echo "</pre>";
						} else {
							echo "<pre>oben<br>";
							print_r($setArray);
							echo "</pre>";
							echo "<pre>";
							print_r($articleID);
							echo "</pre>";
							//die('fsdf');
						}
					}
				}
			}

			if (!$itemEanSet) {
				$itemItemNrSuppl = modCachPixiCall64('pixiGetItemInfo', array('ItemNrSuppl' => $articleID));

				if (is_array($itemItemNrSuppl) && sizeof($itemItemNrSuppl) == 0) {
					$itemItemNrSuppl = modCachPixiCall64('pixiGetItemInfo', array('ItemNrSuppl' => $checkArtNr));
				}

				if (isset($itemItemNrSuppl[0]['ItemKey'])) {
					$allSupplier = modCachPixiCall64('pixiGetItemSuppliers', array('ItemKey' => $itemItemNrSuppl[0]['ItemKey']));
					if (is_array($allSupplier) && sizeof($allSupplier) > 1) {
						foreach ($allSupplier as $key_all_supplier => $value_all_supplier) {
							if (isset($value_all_supplier['SupplNr']) && $value_all_supplier['SupplNr'] == $pixiSupplier && isset($value_all_supplier['EANUPC']) && $value_all_supplier['EANUPC'] != $ean && isset($value_all_supplier['ItemNrSuppl']) && $value_all_supplier['ItemNrSuppl'] == $articleID) {
								$itemEanSet = true;
								$setArray = array(
									'ItemKey' => $itemItemNrSuppl[0]['ItemKey'],
									'SupplNr' => $pixiSupplier,
									'EAN' => $ean
								);
								if (isset($_GET['writeDB'])) {
									$result_supplier_set = $soapClient->pixiSetItemSupplier($setArray);
									$result_supplier_set_set = $result_supplier_set->getResultset();
									echo "<pre>unten<br>";
									print_r($result_supplier_set_set);
									echo "</pre>";
								} else {
									echo "<pre>unten<br>";
									print_r($setArray);
									echo "</pre>";
									echo "<pre>";
									print_r($articleID);
									echo "</pre>";
									//die('fsdf');
								}
							}
						}
					}
				}
			}			
		}
		/*set old ean to pixi*/

		if (isset($allItemssupplierItemNrSuppl[$articleID])) {
			echo "<pre>".'In Pixi allItemssupplierItemNrSuppl '.$articleID;
			echo "</pre>";
			return 'In Pixi '.$articleID;
		}

		if (!empty($ean)) {
			//$allEan = $soapClient->pixiItemSearch(array('EANUPC' => $ean))->getResultSet();
			$allEan = modCachPixiCall64('pixiItemSearch', array('RowCount' => '999999', 'EANUPC' => $ean));
			if (isset($allEan[0]['ItemKey'])) {
				echo "<pre>".'In Pixi EAN '.$ean;
				echo "</pre>";
				//die();
				return 'In Pixi EAN '.$ean;
			}
		}

		$name = $crawlerProd->filter('.product-info .product-detail .product-detail__title')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (isset($name[0])) {
			$name = $name[0];
		}

		$name2 = $crawlerProd->filter('.product-info .product-detail .product-detail__designated')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (isset($name2[0])) {
			$name = $name.' - '.$name2[0];
		}

		$nameOriginal = $name;

		$nameAddon = $crawlerProd->filter('.variant-configurator__item .is--selected')->each(function (Crawler $node, $i) {
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
		//if (is_array($nameAddon) && sizeof($nameAddon) > 0) {
			foreach ($nameAddon as $key_addon => $value_addon) {
				if (!empty($value_addon) && $value_addon != 'Bulk') {
					$name .= ' - '.$value_addon;
				}
			}
		}

		$v_name_de = '';
		$nameAddonVariante = $crawlerProd->filter('.variant-configurator__list .variant-configurator__item')->each(function (Crawler $node, $i) {
			$nameAddonText = $node->filter('.js-variant__title.variant__title')->each(function (Crawler $nodeLabel, $i) {
				return preg_replace('/:$/', '', trim(strip_tags($nodeLabel->text())));	
			});
			$nameAddonValue = $node->filter('.custom-input-list--group.is--selected a')->each(function (Crawler $nodeLabel, $i) {
				return preg_replace('/\./', ',', trim(strip_tags($nodeLabel->text())));	
			});
			if (is_array($nameAddonValue) && empty($nameAddonValue[0])) {
				//$nameAddonValue = $node->filter('.variations-anchor .active div')->each(function (Crawler $nodeLabel, $i) {
					//return ucfirst(trim(strip_tags($nodeLabel->attr('class'))));	
				//});
			}
			
			return array('nameAddonText'=>$nameAddonText, 'nameAddonValue' => $nameAddonValue);
		});

		if (is_array($nameAddonVariante) && sizeof($nameAddonVariante) > 1) {
			$v_name_de = 'Ausführung: ';
			$v_name_de = '';
			foreach ($nameAddonVariante as $key_v_addon => $value_v_addon) {
				if (!empty($value_v_addon['nameAddonValue'][0]) && $value_v_addon['nameAddonValue'][0] != 'Bulk') {
					$v_name_de .= $value_v_addon['nameAddonText'][0].': '.$value_v_addon['nameAddonValue'][0].' - ';
				}
			}
			$v_name_de = substr($v_name_de, 0, -3);
		}

		$images = $crawlerProd->filter('.gallery--slider__inner .image-gallery__image')->each(function (Crawler $node, $i) {
			return 'https://www.wentronic.com'.trim($node->attr('src'));
		});

		$images = array_unique($images);
		$images = array_filter($images);

		if (is_array($images) && sizeof($images) > $images_max) {
			$images_max = sizeof($images);
		}

		$articleData = $crawlerProd->filter('.technical--accordion .item--content')->filter('.item--children.grid')->each(function (Crawler $node, $i) {
			return $node->filter('div.col')->each(function ($td, $i) {
        			return trim($td->text());
    			});
		});

		$articleDataFormated = [];

		if (is_array($articleData) && sizeof($articleData) > 0) {
			foreach ($articleData as $key_data => $value_data) {
				$articleDataFormated[$value_data[0]] = $value_data[1];
			}
		}

		$gewicht = '';
		$doItG = true;
		if (isset($articleDataFormated['Gewicht'])) {
					$gewicht = preg_replace('/,/','.', preg_replace('/[^0-9]/', '', $articleDataFormated['Gewicht']));
					$doItG = false;

		} elseif (isset($articleDataFormated['Gewicht (ohne Batterien/Akku) (g):'][1])) {
					$gewicht = preg_replace('/,/','.', preg_replace('/[^0-9]/', '', $articleDataFormated['Gewicht (ohne Batterien/Akku) (g):'][1]));
					//$doItG = false;
		} else {
			
		}

		if ($doItG && isset($csvData[$articleID])) {
			$gewicht = preg_replace('/,/','.',trim($csvData[$articleID]['Nettogewicht']))*1000;
		}

		if ($gewicht == '') {
			echo "<pre>No Gewicht<br>";
			print_r($articleDataFormated);
			print_r($akkuUrl);
			echo "</pre>";
			//die();
		}

		$price = $crawlerProd->filter('.product-configurator__price .js-volume-price__price.volume-price__price')->each(function (Crawler $node, $i) {
			return preg_replace('/,/', '.', preg_replace('/[^0-9,]/', '', trim(strip_tags($node->text()))));
		});

		if (isset($price[0])) {
			$price = $price[0];
		}

		if (!isset($price[0]) && isset($csvData[$articleID])) {
			$price = preg_replace('/,/','.',trim($csvData[$articleID]['Preis_EUR_1']));
		}

		$priceEK = $price;

		$priceUVP = $crawlerProd->filter('.product-configurator__price .price__uvp')->each(function (Crawler $node, $i) {
			return preg_replace('/,/', '.', preg_replace('/[^0-9,]/', '', trim(strip_tags($node->text()))));
		});

		$never_out_of_stock = 1;
				
		if (isset($priceUVP[0])) {
			$priceUVP = $priceUVP[0];
		} else {
			if (!isset($priceUVP[0]) && isset($csvData[$articleID])) {
				$priceUVP = preg_replace('/,/','.',trim($csvData[$articleID]['UVP']));
			} else {
				$priceUVP = ($price*1.19)*2;
				if ($priceUVP>100) {
					$priceUVP = round_to($priceUVP,1,0.1);
				}elseif ($priceUVP>10) {
					$priceUVP = round_to($priceUVP,0.5,0.01);
				}else{
					$priceUVP = round_to($priceUVP,0.1,0.01);
				}
			}
		}

		$modPrice = $priceUVP;

		if (!isset($price[0]) || is_array($priceEK)) {
			$priceEK = round($modPrice / 2, 4);
			$price = $priceEK;
		}

		if (!isset($price) || empty($price) || !isset($modPrice) || empty($modPrice)) {
			echo "<pre>no price<br>";
			print_r($articleDataFormated);
			echo "</pre>";


			return 'No Price '.$akkuUrl;
		}

		$p_country = '';
		if (isset($csvData[$articleID]['p_country']) && !empty($csvData[$articleID]['p_country'])) {
			$p_country = trim($csvData[$articleID]['p_country']);
		}

		$v_customs_tariff_number = '';
		if (isset($csvData[$articleID]['v_customs_tariff_number']) && !empty($csvData[$articleID]['v_customs_tariff_number'])) {
			$v_customs_tariff_number = trim($csvData[$articleID]['v_customs_tariff_number']);
		}

		$v_customs_tariff_text = '';
		if (isset($csvData[$articleID]['v_customs_tariff_text']) && !empty($csvData[$articleID]['v_customs_tariff_text'])) {
			$v_customs_tariff_text = trim($csvData[$articleID]['v_customs_tariff_text']);
		}

		$manufacturer = $crawlerProd->filter('.product-detail .product-detail__supplier img')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->attr('alt')));
		});

		if (isset($manufacturer[0])) {
			$manufacturer = $manufacturer[0];
			if (!preg_match('/'.$manufacturer.'/i',$name)) {
				$name = $manufacturer.' '.$name;
			}
		} else {
			$manufacturer = 'AccuCell';	
		}

		$downloads = $crawlerProd->filter('.product-downloads a.download--item')->each(function (Crawler $node, $i) {
			$akkuReturn = 'https://www.wentronic.com'.trim(strip_tags($node->attr('href')));
			if (preg_match('/\.pdf/i', $node->attr('href')) && !empty($akkuReturn)) {

				return $akkuReturn;
			}
		});

		$downloads = array_unique($downloads);
		$downloads = array_filter($downloads);

		if (is_array($downloads) && sizeof($downloads) > $media_max) {
			$media_max = sizeof($downloads);
		}

		$beschreibung = '';
	
		$beschreibung = $crawlerProd->filter('section.product-detail .product-detail__info, section.product-detail .product-detail__accordions')->each(function (Crawler $node, $i) {	
			//$html = $node->parents()->html();
			//$crawlerDec = new Crawler($html);
			$crawlerDec = $node;

			
			$crawlerDec->filter('script')->each(function (Crawler $crawler) {
				foreach ($crawler as $node) {
					$node->parentNode->removeChild($node);
				}
			});			

			$crawlerDec->filter('#zoomzcontainer,#DetailHersteller,h1,#DetailMoreInfos,.ClearBoth,#DetailFastpageAllArticles,#DetailAttributes,.accordion__title.details--title')->each(function (Crawler $crawler) {
				foreach ($crawler as $node) {
					$node->parentNode->removeChild($node);
				}
			});

			$crawlerDec->filter('#downloads')->each(function (Crawler $crawler) {
				//hier die downloads auslesen!!!
				foreach ($crawler as $node) {
					$node->parentNode->parentNode->removeChild($node->parentNode);
				}
			});

			$crawlerDec->filter('.download--accordion')->each(function (Crawler $crawler) {
				//hier die downloads auslesen!!!
				foreach ($crawler as $node) {
					$node->parentNode->parentNode->removeChild($node->parentNode);
				}
			});
			$crawlerDec->filter('.product-downloads')->each(function (Crawler $crawler) {
				//hier die downloads auslesen!!!
				foreach ($crawler as $node) {
					$node->parentNode->removeChild($node);
				}
			});

			$crawlerDec->filter('.properties.awords')->each(function (Crawler $crawler) {
				//hier die awards auslesen!!!
				foreach ($crawler as $node) {
					$node->parentNode->parentNode->removeChild($node->parentNode);
				}
			});

			// remove all a nodes
			$crawlerDec->filter('a')->each(function (Crawler $crawler) {
    			foreach ($crawler as $node) {
    				if (preg_match('/wentronik/i', $node->getAttribute('href')) || preg_match('/^#$/i', $node->getAttribute('href'))) {
    					$newText = new DOMtext($node->textContent);
    					
    					$node->parentNode->replaceChild($newText, $node);

    					//$node->parentNode->removeChild($node);
    				}
    			}
			});

			$html = $crawlerDec->html();
			$html = preg_replace('/Artikel Details/', '', $html);
			
			$html = preg_replace('/<!--(.*)-->/', '', $html);

			//$html = preg_replace('/<li>(.*)\n?<\/li>/', '<li class="noUL" style="list-style-type: none;"><span style="color:#2ecc71;font-size:150%;">✓</span> $1</li>', $html);
			$html = preg_replace('/<li>/', '<li class="noUL" style="list-style-type: none;"><span style="color:#2ecc71;font-size:150%;">✓</span> ', $html);
			
			$html = preg_replace('/[\n]{1,}/', '', $html);
			$html = preg_replace('/[\t]{1,}/', '', $html);

			$html = preg_replace('/item--title/', 'article--properties--head', $html);
			$html = preg_replace('/col col--sm-6 item--name/', 'article--property--name', $html);
			$html = preg_replace('/col col--sm-6 item--name/', 'article--property--value', $html);
			
			$html = preg_replace('/<custom-accordion class="custom-element custom-accordion" data-qa="component custom-accordion">/', '', $html);
			$html = preg_replace('/<\/custom-accordion>/', '', $html);

			$html = preg_replace('/<i class="fal fa-chevron-down accordion__icon toggler-accordion__icon"><\/i>/', '', $html);

			$html = preg_replace('/<toggler-click.*>.*<\/toggler-click>/', '', $html);
			$html = preg_replace('/<toggler-click.*>/', '', $html);
			

			$html = str_ireplace('<body>', '', $html);
			$html = str_ireplace('</body>', '', $html);

			

			return $html;
		});

		$realBeschreib = '';
		if (isset($beschreibung[0])) {
			foreach ($beschreibung as $key_prod => $value_prod) {
				$realBeschreib .= $value_prod;
			}
		}
		$beschreibung = $realBeschreib;

		$p_item_number = 'WTD-'.$articleID;

		$kategorie = $crawlerProd->filter('.breadcrumb a')->each(function (Crawler $node, $i) {
			if (!preg_match('/last/', $node->attr('class')) && !preg_match('/startseite/i',trim(strip_tags($node->text()))) && !preg_match('/zur Übersicht/i',trim(strip_tags($node->text())))) {
				return trim(strip_tags($node->text()));
			}
		});

		$kategorie = array_filter($kategorie);

		$kategorieString = $p_group_path;

		if (is_array($kategorie) && sizeof($kategorie) > 0) {
			foreach ($kategorie as $key_kategorie => $value_kategorie) {
				if (!empty($value_kategorie)) {
					$kategorieString .= '##||##'.$value_kategorie;
				}
			}
		}

		$kategorie = $kategorieString;

		if ($p_group_pathGiven != '') {
			$kategorie = $p_group_pathGiven;
		}

		$v_manufacturers_item_number = $p_item_number;


		return ['name' => $name, 'link' => $href, 'images' => $images, 'media' => $downloads, 'priceVK' => $modPrice, 'priceEK' => $price, 'mpn' => $articleID, 'manufacturer' => $manufacturer, 'p_item_number' => $p_item_number, 'beschreibung' => $beschreibung, 'kategorie' => $kategorie, 'v_manufacturers_item_number' => $v_manufacturers_item_number, 'v_name_de' => $v_name_de, 'weight' => $gewicht, 'p_country' => $p_country, 'v_customs_tariff_number' => $v_customs_tariff_number, 'v_customs_tariff_text' => $v_customs_tariff_text, 'ean' => $ean, $never_out_of_stock];

	}
}

function readCSV($file) {
	$handle = fopen($file, 'r');
	$return = [];
	while ( ($data = fgetcsv($handle, 0, $this->delimiter, $this->enclosure) ) !== FALSE ) {
		$return[] = $data;
	}
	fclose($handle);

	return $return;
}

function writeCsv($filename, $data) {
	$csvFile = $filename;
	$delimiter = ';';
	$out = fopen($csvFile, 'w');
	foreach ($data as $key => $value) {
		fputcsv($out, $value, $delimiter);
	}
	fclose($out);
}


function csv_to_array($filename='', $delimiter=';', $enclosure='"') {
	if(!file_exists($filename) || !is_readable($filename))
		return FALSE;

	$header = NULL;
	$data = array();
	if (($handle = fopen($filename, 'r')) !== FALSE)
	{
		while (($row = fgetcsv($handle, 0, $delimiter, $enclosure)) !== FALSE)
		{
			if(!$header)
				$header = $row;
			else
				$data[] = array_combine($header, $row);
		}
		fclose($handle);
	}
	return $data;
}