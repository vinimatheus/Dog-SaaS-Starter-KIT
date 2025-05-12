"use client";

import { Organization } from "@prisma/client";
import { createContext, useContext, ReactNode } from "react";

interface OrganizationContextType {
	organization: Organization | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({
	children,
	organization,
}: {
	children: ReactNode;
	organization: Organization | null;
}) {
	return (
		<OrganizationContext.Provider value={{ organization }}>
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