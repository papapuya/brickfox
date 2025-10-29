import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BulkProduct {
  id: number;
  artikelnummer: string;
  produktname: string;
  produktbeschreibung: string;
  mediamarktname_v1: string;
  mediamarktname_v2: string;
  seo_beschreibung: string;
  kurzbeschreibung: string;
}

interface BulkDescriptionTableProps {
  products: BulkProduct[];
  onUpdateProduct: (id: number, field: keyof BulkProduct, value: string) => void;
}

export function BulkDescriptionTable({ products, onUpdateProduct }: BulkDescriptionTableProps) {
  const [displayLimit, setDisplayLimit] = useState(50);

  const displayedProducts = products.slice(0, displayLimit);
  const hasMore = products.length > displayLimit;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" data-testid="table-products">
          <thead className="sticky top-0 z-10 bg-primary text-primary-foreground">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[140px]">
                Artikelnummer
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[200px]">
                Produktname
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[400px]">
                Produktbeschreibung
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[300px]">
                MediaMarkt Titel V1
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[250px]">
                MediaMarkt Titel V2
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[300px]">
                SEO Beschreibung
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[350px]">
                Kurzbeschreibung
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedProducts.map((product, index) => (
              <tr
                key={product.id}
                className={`
                  border-b border-border transition-colors hover-elevate
                  ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                `}
                data-testid={`row-product-${product.id}`}
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-mono text-foreground" data-testid={`text-sku-${product.id}`}>
                    {product.artikelnummer || '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm text-foreground line-clamp-3">
                          {product.produktname || '-'}
                        </p>
                      </TooltipTrigger>
                      {product.produktname && product.produktname.length > 50 && (
                        <TooltipContent className="max-w-md">
                          <p className="text-xs">{product.produktname}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.produktbeschreibung}
                    onChange={(e) => onUpdateProduct(product.id, 'produktbeschreibung', e.target.value)}
                    className="text-xs resize-none min-h-[100px] font-mono"
                    data-testid={`input-beschreibung-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.mediamarktname_v1}
                    onChange={(e) => onUpdateProduct(product.id, 'mediamarktname_v1', e.target.value)}
                    className="text-sm resize-none min-h-[80px] font-sans font-medium"
                    data-testid={`input-marktplatz-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.mediamarktname_v2}
                    onChange={(e) => onUpdateProduct(product.id, 'mediamarktname_v2', e.target.value)}
                    className="text-sm resize-none min-h-[80px] font-sans font-medium"
                    data-testid={`input-marktplatz-v2-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.seo_beschreibung}
                    onChange={(e) => onUpdateProduct(product.id, 'seo_beschreibung', e.target.value)}
                    className="text-sm resize-none min-h-[80px] font-sans"
                    data-testid={`input-seo-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.kurzbeschreibung}
                    onChange={(e) => onUpdateProduct(product.id, 'kurzbeschreibung', e.target.value)}
                    className="text-sm resize-none min-h-[80px] font-sans"
                    data-testid={`input-kurz-${product.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Zeige <span className="font-medium text-foreground">{Math.min(displayLimit, products.length)}</span> von <span className="font-medium text-foreground">{products.length}</span> Produkten
        </div>
        <div className="text-sm text-muted-foreground">
          Seite <span className="font-medium text-foreground">{Math.ceil(displayLimit / 50)}</span> von <span className="font-medium text-foreground">{Math.ceil(products.length / 50)}</span>
        </div>
        {hasMore && (
          <button
            onClick={() => setDisplayLimit(prev => prev + 50)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Weitere {Math.min(50, products.length - displayLimit)} Produkte laden
          </button>
        )}
      </div>
    </Card>
  );
}
