"use client";

import { useState } from "react";
import type { WarehouseDTO, ProductDTO } from "@/lib/schemas";
import ProductCard from "./ProductCard";

type Props = {
  products: ProductDTO[];
  warehouses: WarehouseDTO[];
};

export default function ProductsClient({ products, warehouses }: Props) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  return (
    <section className="flex-1 bg-allo-bg" id="services">
      {/* Warehouse filter tabs — sticky below navbar */}
      <div className="sticky top-16 z-40 bg-white border-b border-allo-border shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <FilterTab
            label="All Cities"
            active={selectedWarehouseId === null}
            onClick={() => setSelectedWarehouseId(null)}
          />
          {warehouses.map((wh) => (
            <FilterTab
              key={wh.id}
              label={wh.city}
              active={selectedWarehouseId === wh.id}
              onClick={() => setSelectedWarehouseId(wh.id)}
            />
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-[1200px] mx-auto px-6 py-10 sm:py-14">
        {products.length === 0 ? (
          <p className="text-center text-allo-text-muted py-20 text-[15px]">
            No services available right now. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selectedWarehouseId={selectedWarehouseId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-150 min-h-[36px] ${
        active
          ? "bg-allo-text text-white"
          : "bg-allo-bg-alt text-allo-text-muted hover:bg-allo-border"
      }`}
    >
      {label}
    </button>
  );
}
