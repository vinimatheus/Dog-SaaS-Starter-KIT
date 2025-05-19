"use client";

import { Organization } from "@prisma/client";
import { createContext, useContext, ReactNode } from "react";

interface OrganizationContextType {
	organization: Organization | null;
	refetchOrganization?: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({
	children,
	organization,
	refetchOrganization
}: {
	children: ReactNode;
	organization: Organization | null;
	refetchOrganization?: () => Promise<void>;
}) {
	return (
		<OrganizationContext.Provider value={{ organization, refetchOrganization }}>
			{children}
		</OrganizationContext.Provider>
	);
}

export function useOrganization() {
	const context = useContext(OrganizationContext);
	if (context === undefined) {
		throw new Error("useOrganization must be used within an OrganizationProvider");
	}
	return context;
} 