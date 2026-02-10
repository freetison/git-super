/**
 * Azure OpenAI Provider with Azure AD Authentication
 * Uses Microsoft Identity Platform (MSAL) for OAuth
 */

import { BaseOAuthProvider } from './base-oauth-provider.mjs';
import { TokenManager } from '../auth/token-manager.mjs';

export class AzureOpenAIProvider extends BaseOAuthProvider {
  constructor(config) {
    // Azure AD configuration
    const tenantId = config.azureTenantId || 'common';
    const clientId = config.azureClientId;
    
    if (!clientId) {
      throw new Error(
        'Azure Client ID is required. Set AZURE_CLIENT_ID or configure in .gitsuperrc'
      );
    }

    // Create token manager for Azure AD
    const tokenManager = new TokenManager('azure-openai', {
      clientId,
      scopes: ['https://cognitiveservices.azure.com/.default'],
      tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    });

    super(config, tokenManager);
    
    this.tenantId = tenantId;
    this.resourceEndpoint = config.azureResourceEndpoint;
    this.deploymentName = config.azureDeploymentName || config.aiModel;
    
    if (!this.resourceEndpoint) {
      throw new Error(
        'Azure OpenAI endpoint is required. Set AZURE_OPENAI_ENDPOINT or configure in .gitsuperrc\n' +
        'Example: https://your-resource.openai.azure.com'
      );
    }
  }

  /**
   * Initiate Azure AD device code flow
   */
  async initiateAuth() {
    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/devicecode`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.tokenManager.clientId,
          scope: this.tokenManager.scopes.join(' '),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Azure AD device code request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: data.verification_url, // Note: Azure uses verification_url
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      message: data.message,
    };
  }

  /**
   * Poll for Azure AD token
   */
  async completeAuth(deviceCode, interval) {
    const pollInterval = interval * 1000;
    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const response = await fetch(
          `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
              client_id: this.tokenManager.clientId,
              device_code: deviceCode,
            }),
          }
        );

        const data = await response.json();

        if (data.error) {
          if (data.error === 'authorization_pending') {
            continue;
          } else if (data.error === 'slow_down') {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else if (data.error === 'expired_token') {
            throw new Error('Device code expired. Please try again.');
          } else if (data.error === 'access_denied') {
            throw new Error('User denied authorization.');
          } else {
            throw new Error(`Azure AD error: ${data.error} - ${data.error_description || ''}`);
          }
        }

        // Success
        const tokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          scope: data.scope,
        };

        await this.tokenManager.storeTokens(tokens);
        return;
      } catch (error) {
        if (error.message.includes('error:') || 
            error.message.includes('expired') || 
            error.message.includes('denied')) {
          throw error;
        }
        console.warn(`Polling attempt ${attempt + 1} failed: ${error.message}`);
      }
    }

    throw new Error('Azure AD authorization timeout. Please try again.');
  }

  /**
   * Generate commit message using Azure OpenAI
   */
  async generate(prompt) {
    const isAuthenticated = await this.isAuthenticated();
    
    if (!isAuthenticated) {
      throw new Error(
        'Azure AD authentication required. ' +
        'Please authenticate with: git super auth login --provider azure-openai'
      );
    }

    // Build Azure OpenAI endpoint
    const apiVersion = '2024-02-01';
    const endpoint = `${this.resourceEndpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${apiVersion}`;

    const response = await this.authenticatedFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Get provider display name
   */
  getName() {
    return 'azure-openai';
  }
}
