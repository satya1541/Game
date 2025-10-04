import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface AWSCredentials {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
}

class SecretsService {
  private secretsClient: SecretsManagerClient;
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    // Initialize the Secrets Manager client with the aws/secretsmanager encryption key
    this.secretsClient = new SecretsManagerClient({
      region: 'ap-south-2', // Same region as your S3 bucket
      // Will use default AWS credentials from environment or IAM role
    });
  }

  /**
   * Get AWS credentials from AWS Secrets Manager
   */
  async getAWSCredentials(): Promise<AWSCredentials> {
    const secretName = 'game/aws/credentials'; // Using the actual secret name provided
    return await this.getSecret<AWSCredentials>(secretName);
  }

  /**
   * Generic method to retrieve any secret from AWS Secrets Manager with caching
   */
  private async getSecret<T>(secretName: string): Promise<T> {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: 'AWSCURRENT', // Get the current version
      });

      const response = await this.secretsClient.send(command);
      
      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} is empty or not found`);
      }

      const secretValue = JSON.parse(response.SecretString);
      
      // Cache the result
      this.cache.set(secretName, {
        value: secretValue,
        timestamp: Date.now(),
      });

      return secretValue;
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}:`, error);
      throw new Error(`Failed to retrieve secret ${secretName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the cache for a specific secret or all secrets
   */
  clearCache(secretName?: string) {
    if (secretName) {
      this.cache.delete(secretName);
    } else {
      this.cache.clear();
    }
  }
}

// Export singleton instance
export const secretsService = new SecretsService();