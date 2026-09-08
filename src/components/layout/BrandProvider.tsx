"use client";

import { createContext, useContext, type ReactNode } from "react";
import { brand as defaultBrand, type ResolvedBrand } from "@/lib/brand";

const BrandContext = createContext<ResolvedBrand>(defaultBrand);

export function BrandProvider({ value, children }: { value: ResolvedBrand; children: ReactNode }) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): ResolvedBrand {
  return useContext(BrandContext);
}
