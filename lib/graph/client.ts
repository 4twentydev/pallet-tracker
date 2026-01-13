import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import 'isomorphic-fetch';

/**
 * Microsoft Graph API Client Configuration
 * Handles authentication and API client initialization
 */

let graphClient: Client | null = null;

/**
 * Creates and returns an authenticated Microsoft Graph API client
 * Uses Azure AD app credentials (client ID, secret, tenant ID)
 * Implements singleton pattern for efficiency
 */
export function getGraphClient(): Client {
  if (graphClient) {
    return graphClient;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Missing Microsoft Graph API credentials in environment variables');
  }

  // Create credential using client secret
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  // Create authentication provider with required scopes
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  // Initialize Graph client
  graphClient = Client.initWithMiddleware({
    authProvider,
  });

  return graphClient;
}

/**
 * Resets the Graph client instance
 * Useful for testing or credential refresh
 */
export function resetGraphClient(): void {
  graphClient = null;
}
