import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
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
  produktbeschreibung_html: string;
  mediamarktname_v1: string;
  mediamarktname_v2: string;
  seo_beschreibung: string;
  kurzbeschreibung: string;
}

interface BulkDescriptionTableProps {
  products: BulkProduct[];
  onUpdateProduct: (id: number, field: keyof BulkProduct, value: string) => void;
  onPreviewHtml?: (htmlContent: string) => void;
}

export function BulkDescriptionTable({ products, onUpdateProduct, onPreviewHtml }: BulkDescriptionTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedProducts = products.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

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
                Produktbeschreibung Text
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide min-w-[500px]">
                Produktbeschreibung HTML
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
                    className="text-xs resize-none min-h-[100px] font-sans"
                    data-testid={`input-beschreibung-${product.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={product.produktbeschreibung_html}
                      onChange={(e) => onUpdateProduct(product.id, 'produktbeschreibung_html', e.target.value)}
                      className="text-xs resize-none min-h-[100px] font-mono flex-1"
                      data-testid={`input-beschreibung-html-${product.id}`}
                    />
                    {onPreviewHtml && product.produktbeschreibung_html && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPreviewHtml(product.produktbeschreibung_html)}
                        title="HTML Vorschau anzeigen"
                        className="mt-1 flex-shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
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
          Zeige <span className="font-medium text-foreground">{startIndex + 1}-{Math.min(endIndex, products.length)}</span> von <span className="font-medium text-foreground">{products.length}</span> Produkten
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Zurück
          </Button>
          <div className="text-sm text-muted-foreground px-4">
            Seite <span className="font-medium text-foreground">{currentPage}</span> von <span className="font-medium text-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
          >
            Weiter
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="w-32"></div>
      </div>
    </Card>
  );
}
