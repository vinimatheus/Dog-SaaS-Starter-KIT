"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface AccessDeniedToastProps {
	show: boolean;
}

export function AccessDeniedToast({ show }: AccessDeniedToastProps) {
	useEffect(() => {
		if (show) {
			toast.error("Você não tem mais acesso a esta organização. Entre em contato com o dono para mais informações.");
		}
	}, [show]);

	return null;
} 