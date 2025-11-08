<?php
set_time_limit(0);
require 'vendor/autoload.php';

use Symfony\Component\DomCrawler\Crawler;

$username = 'pixiAKU'; // Your pixi database
$password = 'jQYHhSvncHgmew_AKU'; // Your API password
$uri = 'https://api.pixi.eu/soap/pixiAKU/'; // Enpoint of your API
$location = 'https://api.pixi.eu/soap/pixiAKU/'; // if your uri is differend from the endpoint location should be added and uri corrected

$options = new Pixi\API\Soap\Options($username, $password, $uri, $location);
$options->allowSelfSigned(); // if the certificate is self signed

$soapClient = new \Pixi\API\Soap\Client(null, $options->getOptions());


 $username = 'c1w2db1';
 $password = 'dU2MQflUIdE';
 $databasename = 'c1w2db1';
 $host = 'akkushop1.timmeserver.de';

$connectionString = 'mysql:host=' . $host . ';dbname=' . $databasename.';charset=utf8';
$pdo = new \PDO($connectionString , $username, $password);

/*
// output all files and directories except for '.' and '..'
foreach (new DirectoryIterator('cache') as $fileInfo) {
    if($fileInfo->isDot()) continue;
    $cacheFile = 'cache/'.$fileInfo->getFilename();
    $fileContent = file_get_contents($cacheFile);
    if (stripos($fileContent, 'batterieprofis') === false) {
    	continue;
    }
    $crawlerCache = new Crawler($fileContent);
    //check alive
    $alive = $crawlerCache->filter('span[title="AkkuShop"]')->each(function (Crawler $node, $i) {
    	return trim(strip_tags($node->text()));
    });
    if (!isset($alive[0])) {
    	echo "<pre>LOGGED OUT";
    	echo "</pre>";
    	unlink($cacheFile);
    }
}
*/


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

$csvData = [];
/*$csvContent = csv_to_array('syncCSV/vhbw.csv', ';', '"');
if (is_array($csvContent) && sizeof($csvContent) > 0) {
	foreach ($csvContent as $key => $value) {
		$csvData[trim($value['A.Nr.'])] = $value;
	}
}*/

$pixiSupplier = '7111';
$p_group_path = 'INTERN##||##Import##||##MEDIACOM';
//$p_group_pathGiven = 'Akkus##||##Akku für Haushalt und Garten##||##Zahnbürsten';
$p_group_pathGiven = 'Kabel, TV, Musik und Zubehör##||##Haustechnik';
$p_group_pathGiven = 'INTERN##||##Import##||##MEDIACOM##||##Telefon';
$p_group_pathGiven = '';



$mappedCatsArray = [
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Akkus##||##Baby C' => 'AkkuShop##||##Akkus##||##Akku nach Größe##||##Baby C LR14',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Akkus##||##Block E' => 'AkkuShop##||##Akkus##||##Akku nach Größe##||##9 Volt  6F22',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Akkus##||##Micro AAA' => 'AkkuShop##||##Akkus##||##Akku nach Größe##||##Micro AAA LR03',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Akkus##||##Mignon AA' => 'AkkuShop##||##Akkus##||##Akku nach Größe##||##Mignon AA LR06',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Akkus##||##Mono D' => 'AkkuShop##||##Akkus##||##Akku nach Größe##||##Mono D LR20',

	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Zubehör##||##Powerbanks' => 'AkkuShop##||##Akkus##||##Powerbank Akku extern',

	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Batterien##||##Mignon AA' => 'AkkuShop##||##Batterien##||##Standard Batterien##||##Mignon AA LR06',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Batterien##||##Micro AAA' => 'AkkuShop##||##Batterien##||##Standard Batterien##||##Micro AAA LR03',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Batterien##||##Baby C' => 'AkkuShop##||##Batterien##||##Standard Batterien##||##Baby C LR14',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Batterien##||##Block E' => 'AkkuShop##||##Batterien##||##Standard Batterien##||##9 Volt 6F22 6LR61',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Batterien##||##Mono D' => 'AkkuShop##||##Batterien##||##Standard Batterien##||##Mono D LR20',

	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Zubehör##||##Ladegeräte' => 'AkkuShop##||##Ladegeräte##||##für Akkus (einzeln)##||##Universal-Ladegeräte',
	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Zubehör##||##Ladeadapter' => 'AkkuShop##||##Ladegeräte##||##für USB-C',

	'INTERN##||##Import##||##MEDIACOM##||##Energy##||##Knopfzellen##||##Elektronik' => 'AkkuShop##||##Batterien##||##Knopfzellen Batterien##||##LR Knopfzellen',
	
];



/*
$allSupplier = modCachPixiCall64('pixiGetSuppliers', array());
echo "<pre>";
print_r($allSupplier);
echo "</pre>";
die();
*/

$allItemssupplierItemNrSuppl = [];
//$allItemssupplier = $soapClient->pixiItemSearch(array('SupplNr' => $pixiSupplier, 'ShowOnlyItemsForExactSupplier' => '1'))->getResultSet();
$allItemssupplier = modCachPixiCall64('pixiItemSearch', array('RowCount' => '999999', 'SupplNr' => $pixiSupplier, 'ShowOnlyItemsForExactSupplier' => '1'));
if (is_array($allItemssupplier) && sizeof($allItemssupplier) > 0) {
	foreach ($allItemssupplier as $key => $value) {
		if (isset($value['ItemNrSuppl'])) {
			$allItemssupplierItemNrSuppl[trim($value['ItemNrSuppl'])] = $value;
		}
	}
}


$url_to_check = 'https://www.mediacom-it.de/energy/';

$cookieSet = 'sh5b6bsv6fgkf1641bt0hh4eqn';

// Create a stream
$opts = array(
	"ssl"=>array(
        "verify_peer"=>false,
        "verify_peer_name"=>false,
    ),
  'http'=>array(
    'method'=>"GET",
    'header'=>"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n".
    		  "Accept-language: de,en-US;q=0.7,en;q=0.3\r\n" .
              "Cookie: timezone=Europe/Berlin; cookie-preference=1; session-=".$cookieSet.";"."\r\n" .
              "User-Agent: Mozilla/5.0 (Windows NT 10.0; rv:62.0) Gecko/20100101 Firefox/62.0"."\r\n"
  )
);

$context = stream_context_create($opts);

$pageStart = 1;
$pagesMax = 27;
//$pagesMax = 2582;
if (isset($_GET['page'])) {
	$pageStart = (int)$_GET['page'];
	$pagesMax = (int)$_GET['page']+100;
}

$pages = [];

for ($i = $pageStart; $i <= $pagesMax; $i++) {
	$glue = '?';
	if (preg_match('/\?/', $url_to_check)) {
		$glue = '&';
	}

	$pages[] = $url_to_check.$glue.'p='.$i;
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
	'p_description[de]' => 'p_description[de]'
];


$arrayGot = [];

//kranakkus
$arrayGot = array_merge($arrayGot, array());


$allProducts = [];
$beschreibungArray = [];

foreach ($pages as $key_page => $value_page) {
	$crawler = new Crawler(getCached($value_page, false, $context));	

	/*print_r($crawler->html());
	die();*/

	$products = $crawler->filter('.cms-element-product-listing-wrapper .product-box a.product-image-link')->each(function (Crawler $node, $i) {
		global $images_max, $media_max, $allItemssupplierItemNrSuppl, $context, $soapClient, $p_group_path, $p_group_pathGiven, $pixiSupplier, $i_gesamt, $beschreibungArray, $value_page, $arrayGot, $csvData, $pdo, $mappedCatsArray;
		$href = trim(strip_tags($node->attr('href')));
		$i_gesamt++;

		if (!empty($href)) {
			$href = $href;
		} else {
			echo "<pre>".'Href empty '.$value_page;
			echo "</pre>";	
			return 'Href empty '. $value_page;
		}

		$akkuReturn = [];

		$crawlerProd = new Crawler(getCached($href, false, $context));

		$articleID = $crawlerProd->filter('.product-detail-ordernumber[itemprop="sku"]')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});

		if (isset($articleID[0])) {
			$articleID = $articleID[0];
		} else {
			echo "<pre>".'no articleID '.$href;
			echo "</pre>";	
			return 'no articleID '. $href;	
		}

		$HerstellerNr = 'MCIT-'.$articleID;
		$articleIDAll = $crawlerProd->filter('.product-detail-ordernumber')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});

		if (isset($articleIDAll[1])) {
			$HerstellerNr = $articleIDAll[1];
		} else {
			echo "<pre>".'no HerstellerNr '.$href;
			echo "</pre>";	
			return 'no articleID '. $href;	
		}

		/*
		//check alive
		$alive = $crawlerProd->filter('span[title="AkkuShop"]')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (!isset($alive[0])) {
			echo "<pre>LOGGED OUT";
			echo "</pre>";
			deleteCached($href);
			die();
		}
		*/

		$ean = $crawlerProd->filter('.product-detail-ordernumber-container > .product-detail-ordernumber')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (isset($ean[0])) {
			$ean = end($ean);
		}


		$htmlEAN = $crawlerProd->html();
		$eanMatches = [];
		preg_match('/"\d{13,13}"/i', $htmlEAN, $eanMatches);

		if (isset($eanMatches[0])) {
			$ean = trim($eanMatches[0], '"');
		}

		$weight = '';
		$htmlGewicht = $crawlerProd->html();
		$gewichtMatches = [];
		preg_match('/gewicht:.*/i', $htmlGewicht, $gewichtMatches);

		if (isset($gewichtMatches[0])) {
			$weight = trim(preg_replace('/g/i','', preg_replace('/gewicht: ([\d]{1,}).*/i','$1', preg_replace('/[\r\n]+/','',$gewichtMatches[0]))));
			echo "<pre>";
			print_r('Gewicht match '.$articleID. ' ' .$href. ' '. $weight);
			echo "</pre>";
			/*echo "<pre>";
			print_r($gewichtMatches);
			echo "</pre>";
			echo "<pre>";
			print_r($weight);
			echo "</pre>";*/
		}
				

		/*set old ean to pixi*/
		if (!empty($ean) && isset($_GET['fixEcoEAN'])) {
			$itemEanSet = false;
			$checkArtNr = $articleID;

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

		/*if (!empty($ean)) {
			//$allEan = $soapClient->pixiItemSearch(array('EANUPC' => $ean))->getResultSet();
			$allEan = modCachPixiCall64('pixiItemSearch', array('RowCount' => '999999', 'EANUPC' => $ean));
			if (isset($allEan[0]['ItemKey'])) {
				echo "<pre>".'In Pixi EAN '.$ean;
				echo "</pre>";
				//die();
				return 'In Pixi EAN '.$ean;
			}
		}*/

		/*
		if (!empty($articleID)) {
			$itemItemNrSuppl = modCachPixiCall64('pixiGetItemInfo', array('ItemNrSuppl' => $articleID));
			echo "<pre>";
			print_r($itemItemNrSuppl);
			echo "</pre>";
		}
		die();
		*/

		if (in_array($articleID, $arrayGot)) {
			echo "<pre>Alt artikel<br>";
			print_r($articleID);
			echo "</pre>";	
			return 'Alt Artikel '.$articleID;
		}

		$name = $crawlerProd->filter('.product-detail-name[itemprop="name"]')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (isset($name[0])) {
			$name = $name[0];
			$name = preg_replace('/[\r\n]{1,}/', "", $name);
			$name = preg_replace('/[\r]{1,}/', "", $name);
			$name = preg_replace('/[\n]{1,}/', "", $name);
			$name = preg_replace('/\s{2,}/', " ", $name);
			$name = preg_replace('/\s{2,}/', " ", $name);
			$name = trim($name);
		}

		$images = $crawlerProd->filter('.gallery-slider-image')->each(function (Crawler $node, $i) {
			if (trim(strip_tags(basename($node->attr('src')))) != '') {
				return trim(strip_tags($node->attr('src')));
			}
		});

		/*only one*/
		//if (file_exists('https://importimages.laptopakku.eu/MediaCom/'.$articleID.'.jpg')) {
			$images = ['https://importimages.laptopakku.eu/MediaCom/'.$articleID.'.jpg'];
		//}

		$images = array_unique($images);
		$images = array_filter($images);
		$images = array_values($images);

		if (is_array($images) && sizeof($images) > $images_max) {
			$images_max = sizeof($images);
		}

		$price = $crawlerProd->filter('meta[itemprop="price"]')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->attr('content')));
		});
		if (isset($price[0])) {
			$price = trim($price[0]);
		}

		$priceVK = $price;

		/*$priceVK = $crawlerProd->filter('.pd-offer .pd-oldprice')->each(function (Crawler $node, $i) {
			return preg_replace('/,/', '.', preg_replace('/[^0-9,]/', '', trim(strip_tags($node->text()))));
		});
		if (isset($priceVK[0])) {
			$priceVK = $priceVK[0]*1.19;
		}*/

		$downloads = $crawlerProd->filter('#DetailInfo a')->each(function (Crawler $node, $i) {
			$akkuReturn = trim(strip_tags($node->attr('href')));
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
		
		$beschreibung = $crawlerProd->filter('.product-detail-description-text')->each(function (Crawler $node, $i) {
			$crawlerDec = $node;

			$crawlerDec->filter('script')->each(function (Crawler $crawler) {
				foreach ($crawler as $node) {
					$node->parentNode->removeChild($node);
				}
			});

			$html = $crawlerDec->html();
			$html = preg_replace('/[\r\n]{1,}/', "\n", $html);
			$html = preg_replace('/[\t]{1,}/', "\t", $html);

			$html = preg_replace('/(<br>){1,}$/', '<br>', $html);
			$html = str_ireplace('<body>', '', $html);
			$html = str_ireplace('</body>', '', $html);

			return $html;
		});

		if (isset($beschreibung[0])) {
			$beschreibung = trim($beschreibung[0]);
		}

		if (!is_array($beschreibung)) {
			@$beschreibungArray[$articleID][] = $beschreibung;
		} else {
			$beschreibung = '';
		}
		

		$merkmale = '';
		
		$merkmale = $crawlerProd->filter('#product_tabs_additional_tabbsed_contents')->each(function (Crawler $node, $i) {
			$crawlerDec = $node;

			$crawlerDec->filter('script')->each(function (Crawler $crawler) {
				foreach ($crawler as $node) {
					$node->parentNode->removeChild($node);
				}
			});

			$crawlerDec->filter('th')->each(function (Crawler $crawler) {
				foreach ($crawler as $node) {
					if (preg_match('/Marke/i', $node->textContent)) {
						$node->parentNode->parentNode->removeChild($node->parentNode);
					}
				}
			});

			$html = $crawlerDec->html();
			$html = preg_replace('/[\r\n]{1,}/', "\n", $html);
			$html = preg_replace('/[\t]{1,}/', "\t", $html);

			$html = preg_replace('/(<br>){1,}$/', '<br>', $html);
			$html = str_ireplace('<body>', '', $html);
			$html = str_ireplace('</body>', '', $html);
			$html = trim($html);

			return $html;
		});

		if (isset($merkmale[0])) {
			$beschreibung .= $merkmale[0];
		}

		if ($beschreibung != '') {
			$beschreibung = preg_replace('/vhbw/i', 'AccuCell', $beschreibung);

			$beschreibung = str_ireplace(' vocab="https://schema.org/" typeof="Product"', '', $beschreibung);
			$beschreibung = str_ireplace(' property="description"', '', $beschreibung);
		}

		$p_item_number = $HerstellerNr;

		$manufacturer = $crawlerProd->filter('.product-detail-manufacturer img')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->attr('alt')));
		});

		if (isset($manufacturer[0]) && !preg_match('/vhbw/i', $manufacturer[0])) {
			$manufacturer = ucfirst(strtolower($manufacturer[0]));
			$name = $manufacturer.' '.$name;
		} else {
			$manufacturer = 'AccuCell';	
		}

		$kategorie = $crawlerProd->filter('.breadcrumb-item a')->each(function (Crawler $node, $i) {
			if ($node->attr('title') == 'Home') {
				return false;
			}
			return trim(strip_tags($node->text()));
		});

		$kategorie = array_filter($kategorie);

		$kategorieString = $p_group_path;

		if (is_array($kategorie) && sizeof($kategorie) > 0) {
			foreach ($kategorie as $key_kategorie => $value_kategorie) {
				$kategorieString .= '##||##'.$value_kategorie;
			}
		}

		$kategorie = $kategorieString;

		if ($p_group_pathGiven != '') {
			$kategorie = $p_group_pathGiven;
		}

		if (isset($mappedCatsArray[$kategorie])) {
			$kategorie = $mappedCatsArray[$kategorie];
		} else {
			echo "<pre>Not Mapped:<br>";
			print_r($kategorie);
			echo "<br>";
			print_r($articleID);
			echo "</pre>";

			$kategorie = 'INTERN##||##Import##||##MEDIACOM';
		}

		$modPrice = $priceVK;
		$price = $price;

		$never_out_of_stock = 1;

		if (isset($csvData[$articleID])) {
			$price = trim(preg_replace('/,/', '.', $csvData[$articleID]['E-Preis']));
			$weight = $csvData[$articleID]['Gewicht'];
			$menge = (int)$csvData[$articleID]['Menge'];
			if ($menge <= 0) {
				$never_out_of_stock = 0;
			}
		} elseif(sizeof($csvData) > 0) {
			echo "<pre>no csv DATA:<br>";
			print_r($articleID);
			echo "</pre>";

			return 'no csv DATA';
			//die();
		}

		$priceTemp = ($price*1.19)*2;
		if ($priceTemp>100) {
			$priceTemp = round_to($priceTemp,1,0.1);
		}elseif ($priceTemp>10) {
			$priceTemp = round_to($priceTemp,0.5,0.01);
		}else{
			$priceTemp = round_to($priceTemp,0.1,0.01);
		}
		if ($priceTemp > $priceVK) {
			$modPrice = $priceTemp;
		}

		$never_from_web = $crawlerProd->filter('.product-delivery-information .bg-warning, .product-delivery-information .bg-danger')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (isset($never_from_web[0])) {
			//$never_out_of_stock = 0;
		}

		$v_manufacturers_item_number = $HerstellerNr;

		/*echo "<pre>";
		print_r($name);
		echo "</pre>";
		die();*/
		$MinOrderQty = 1;
		$purchaseunit = $crawlerProd->filter('.product-detail-purchaseunit-information .product-detail-purchaseunit')->each(function (Crawler $node, $i) {
			return trim(strip_tags($node->text()));
		});
		if (isset($purchaseunit[0])) {
			$MinOrderQty = $purchaseunit[0];
		}
		
		if (!empty($ean)) {
			//$allEan = $soapClient->pixiItemSearch(array('EANUPC' => $ean))->getResultSet();
			$allEan = modCachPixiCall64('pixiItemSearch', array('RowCount' => '999999', 'EANUPC' => $ean));
			if (isset($allEan[0]['ItemKey']) && isset($_GET['writeDB'])) {
				foreach ($allEan as $key_ean => $value_ean) {
					$setArray = array(
							'ItemKey' => $value_ean['ItemKey'],
							'SupplNr' => $pixiSupplier,
							'EAN' => $ean,
							'ItemNrSuppl' => $articleID,
							'SupplPrice' => $price,
							'MinOrderQty' => $MinOrderQty
						);
					$result_supplier_set = $soapClient->pixiSetItemSupplier($setArray);
        	$result_supplier_set_set = $result_supplier_set->getResultset();
        	echo "<pre>ean set old<br>";
					print_r($result_supplier_set_set);
					echo "</pre>";
					/*echo '<pre>';
					print_r($setArray);
					echo '</pre>';
					echo '<pre>';
					print_r($value_ean);
					echo '</pre>';
					die();*/
				}
			}
			if (isset($allEan[0]['ItemKey'])) {
				echo "<pre>".'In Pixi EAN '.$ean.' | '.$articleID. ' '. $price;
				echo "</pre>";
				//die();
				return 'In Pixi EAN '.$ean;
			}
		}

		//pdo query
		$sql = "SELECT count(*) from s_articles_details where ordernumber = '".$p_item_number."'";
		$nRows = $pdo->query($sql)->fetchColumn();
		if ($nRows > 0) {
			echo "<pre>exists:<br>";
			print_r($p_item_number);
			echo "</pre>";
			//$p_item_number = 'MCIT-'.$p_item_number;

			return 'Exists '.$p_item_number;
		}

		$returnArray = ['name' => $name, 'link' => $href, 'images' => $images, 'media' => $downloads, 'priceVK' => $modPrice, 'priceEK' => $price, 'mpn' => $articleID, 'manufacturer' => $manufacturer, 'p_item_number' => $p_item_number, 'beschreibung' => $beschreibung, 'kategorie' => $kategorie, 'v_manufacturers_item_number' => $v_manufacturers_item_number, 'weight' => $weight, 'never_out_of_stock' => $never_out_of_stock, 'ean' => $ean];
		foreach ($returnArray as $key => $value) {
			if ($key == 'name' || $key == 'manufacturer' || $key == 'beschreibung') {
				$returnArray[$key] = preg_replace('/vhbw/i', 'AccuCell', $value);
			}
		}

		return $returnArray;

	});

	$allProducts = array_merge($allProducts, $products);

	/*echo "<pre>";
	print_r($allProducts);
	echo "</pre>";
	echo "<pre>";
	print_r($images_max);
	echo "</pre>";

	die();*/
}

$artikleDone = [];

for ($i = 1; $i <= $images_max; $i++) {
	$csvInhalt[0]['p_image['.$i.']'] = 'p_image['.$i.']';
}

for ($i = 1; $i <= $media_max; $i++) {
	$csvInhalt[0]['p_media['.$i.'][pdf]'] = 'p_media['.$i.'][pdf]';
	$csvInhalt[0]['p_media_name['.$i.']'] = 'p_media_name['.$i.']';
}

if (isset($_GET['showHTML'])) {
?>
<style type="text/css">
	.epaDesc th {
		vertical-align: top;
	}
	.epaDesc ul {
		list-style: none;
		list-style-type: none;
		margin: 0;
		padding: 0;
	}

	.epaDesc #product-attribute-specs-table .attribute-datasheet_compa_models ul li{
		float: left;
		border: 1px solid #ccc;
		margin: 5px;
		margin-right: 20px;
		padding: 5px;
	}
</style>
<?php
}

if (is_array($allProducts) && sizeof($allProducts) > 0) {
	foreach ($allProducts as $key => $value) {
		if (!is_array($value)) {
			continue;
		}
		if (isset($artikleDone[$value['mpn']])) {
			continue;
		}
		if (!isset($value['p_item_number'])) {
			continue;
		}

		/*if (isset($beschreibungArray[$value['mpn']])) {
			arsort($beschreibungArray[$value['mpn']]);
			
			$value['beschreibung'] = implode('', $beschreibungArray[$value['mpn']]);
			if (preg_match('/passend für /', $value['beschreibung'])) {
				$value['beschreibung'] = preg_replace('/passend für /', '', $value['beschreibung']);
				$value['beschreibung'] = '<h2>Passend für: </h2>'.$value['beschreibung'];
			}
			

			if (preg_match('/ersetzt /', $value['beschreibung'])) {
				$value['beschreibung'] = substr_replace($value['beschreibung'], '<h3>Ersetzt: </h3>', stripos($value['beschreibung'], 'ersetzt'), 0);
				$value['beschreibung'] = preg_replace('/ersetzt /', '', $value['beschreibung']);
			}

			if (strlen($value['beschreibung']) > 1024) {
				//$value['beschreibung'] = preg_replace('/<br>/', ',', $value['beschreibung']);
			}
		}*/

		if (isset($value['beschreibung']) && $value['beschreibung']!='') {
			$value['beschreibung'] = '<div class="epaDesc">'.$value['beschreibung'].'</div>';
		}

		if (isset($_GET['showHTML'])) {
			print_r('<h1>'.$value['name'].'</h1>');
			print_r('<h3>'.$value['p_item_number'].'</h3>');
			print_r('<h4>'.$value['priceEK'].' | '.$value['priceVK'].'</h4>');
			print_r('<h5>Gewicht: '.$value['weight'].'</h5>');
			echo '<div style="border: 1px solid #000000;">';
			print_r($value['beschreibung']);
			echo "</div>";
			for ($i = 1; $i <= $images_max; $i++) {
				if (isset($value['images'][$i-1])) {
					echo '<img src="'.$value['images'][$i-1].'" style="width: 25%;" />';
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
			'p_never_out_of_stock' => $value['never_out_of_stock'],
			'p_condition' => 'editDesc',
			'v_item_number' => $value['p_item_number'],
			'v_ean' => $value['ean'],
			'v_manufacturers_item_number' => $value['v_manufacturers_item_number'],
			'v_status' => '1',
			'v_classification' => 'X',
			'v_price[Eur]' => number_format($value['priceVK'],2 ,'.', ''),
			'v_delivery_time[de]' => '3-5 Tage',
			'v_supplier[Eur]' => $pixiSupplier,
			'v_supplier_item_number' => $value['mpn'],
			'v_purchase_price' => number_format($value['priceEK'],2 ,'.', ''),
			'v_never_out_of_stock[standard]' => $value['never_out_of_stock'],
			'v_weight' => $value['weight'],
			'p_description[de]' => $value['beschreibung'],
		];

		for ($i = 1; $i <= $images_max; $i++) {
			$csvInhalt[$key+1][] = isset($value['images'][$i-1])?$value['images'][$i-1]:'';
		}

		for ($i = 1; $i <= $media_max; $i++) {
			$media_file = isset($value['media'][$i-1])?$value['media'][$i-1]:'';
			$media_name = basename($media_file);
			$csvInhalt[$key+1]['p_media['.$i.'][pdf]'] = $media_file;
			$csvInhalt[$key+1]['p_media_name['.$i.']'] = $media_name;
		}

		$artikleDone[$value['mpn']] = $value['mpn'];
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


function deleteCached($filename) {
	$cachePath = getcwd().'/cache/';
    $cacheFile = md5($filename).'.txt';
    unlink($cachePath.$cacheFile);
    return;
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