import { useState } from "react";
import { Product } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductTableProps {
  products: Product[];
  onUpdateProduct: (id: number, field: keyof Product, value: string) => void;
}

export function ProductTable({ products, onUpdateProduct }: ProductTableProps) {
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
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[300px]">
                Produktbeschreibung
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[300px]">
                MediaMarkt Titel V1
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[300px]">
                MediaMarkt Titel V2
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[120px]">
                Spannung
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[130px]">
                Kapazität
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[140px]">
                Energiegehalt
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[120px]">
                Leistung
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[160px]">
                Verpackungseinheit
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[250px]">
                Lieferumfang
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
                    {product.sku || '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm text-foreground line-clamp-3">
                          {product.titel || '-'}
                        </p>
                      </TooltipTrigger>
                      {product.titel && product.titel.length > 50 && (
                        <TooltipContent className="max-w-md">
                          <p className="text-xs">{product.titel}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.produktbeschreibung}
                    onChange={(e) => onUpdateProduct(product.id, 'produktbeschreibung', e.target.value)}
                    className="text-xs resize-none min-h-[80px] font-sans"
                    data-testid={`input-beschreibung-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.titel_marktplatz}
                    onChange={(e) => onUpdateProduct(product.id, 'titel_marktplatz', e.target.value)}
                    className="text-sm resize-none min-h-[80px] font-sans font-medium"
                    data-testid={`input-marktplatz-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.titel_marktplatz_v2}
                    onChange={(e) => onUpdateProduct(product.id, 'titel_marktplatz_v2', e.target.value)}
                    className="text-sm resize-none min-h-[80px] font-sans font-medium"
                    data-testid={`input-marktplatz-v2-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={product.spannung}
                    onChange={(e) => onUpdateProduct(product.id, 'spannung', e.target.value)}
                    className="text-sm font-mono"
                    placeholder="-"
                    data-testid={`input-spannung-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={product.kapazitaet}
                    onChange={(e) => onUpdateProduct(product.id, 'kapazitaet', e.target.value)}
                    className="text-sm font-mono"
                    placeholder="-"
                    data-testid={`input-kapazitaet-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={product.energiegehalt}
                    onChange={(e) => onUpdateProduct(product.id, 'energiegehalt', e.target.value)}
                    className="text-sm font-mono"
                    placeholder="-"
                    data-testid={`input-energiegehalt-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={product.leistung}
                    onChange={(e) => onUpdateProduct(product.id, 'leistung', e.target.value)}
                    className="text-sm font-mono"
                    placeholder="-"
                    data-testid={`input-leistung-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={product.verpackungseinheit}
                    onChange={(e) => onUpdateProduct(product.id, 'verpackungseinheit', e.target.value)}
                    className="text-sm"
                    placeholder="-"
                    data-testid={`input-verpackungseinheit-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Textarea
                    value={product.lieferumfang}
                    onChange={(e) => onUpdateProduct(product.id, 'lieferumfang', e.target.value)}
                    className="text-xs resize-none min-h-[80px] font-sans"
                    data-testid={`input-lieferumfang-${product.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="p-6 text-center border-t border-border bg-muted/30">
          <p className="text-sm text-muted-foreground mb-4">
            Zeige {displayLimit} von {products.length} Produkten
          </p>
          <button
            onClick={() => setDisplayLimit(prev => prev + 50)}
            className="text-sm text-primary hover:underline font-medium"
            data-testid="button-load-more"
          >
            Weitere 50 Produkte laden
          </button>
        </div>
      )}

      {!hasMore && products.length > 50 && (
        <div className="p-4 text-center border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Alle {products.length} Produkte werden angezeigt
          </p>
        </div>
      )}
    </Card>
  );
}
