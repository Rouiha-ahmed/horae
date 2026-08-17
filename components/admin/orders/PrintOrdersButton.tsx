"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PrintOrdersButton() {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-xl bg-shop_btn_dark_green text-white"
    >
      <Printer className="h-4 w-4" />
      Imprimer
    </Button>
  );
}
