"use client";

import { Button } from "@/components/ui/button";
import type { ButtonHTMLAttributes } from "react";

export function BackButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="outline"
      onClick={() => window.history.back()}
      {...props}
    >
      Voltar
    </Button>
  );
} 