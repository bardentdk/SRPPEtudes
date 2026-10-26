"use client";

import { createAuthClient } from "better-auth/react";

/** Client de connexion de l'espace admin (même origine que le site). */
export const authClient = createAuthClient();
