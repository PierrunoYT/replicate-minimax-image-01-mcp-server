#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Replicate from "replicate";
import { writeFile } from "fs/promises";
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Check for required environment variable
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
let replicateConfigured = false;
let replicate: Replicate;

if (!REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN environment variable is required');
  console.error('Please set your Replicate API token: export REPLICATE_API_TOKEN=r8_your_token_here');
  // Server continues running, no process.exit()
} else {
  // Configure Replicate client
  replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
  });
  replicateConfigured = true;
}

// Define types based on minimax/image-01 API documentation
interface MinimaxImageResult {
  url?: string;
  urls?: string[];
}

interface MinimaxImageInput {
  prompt: string;
  aspect_ratio?: string;
  number_of_images?: number;
  prompt_optimizer?: boolean;
  subject_reference?: string;
}

// Download image function
async function downloadImage(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      // Create images directory if it doesn't exist
      const imagesDir = path.join(process.cwd(), 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      const filePath = path.join(imagesDir, filename);
      const file = fs.createWriteStream(filePath);
      
      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Generate safe filename for images
function generateImageFilename(prompt: string, index: number): string {
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `minimax_image_01_${safePrompt}_${index}_${timestamp}.webp`;
}

// Create MCP server
const server = new McpServer({
  name: "replicate-minimax-image-01-server",
  version: "2.0.0",
});

// Tool: Generate images with minimax/image-01
server.tool(
  "minimax_image_01_generate",
  {
    description: "Generate high-quality images using minimax/image-01 - Advanced image generation model with superior quality and detail via Replicate",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text prompt for image generation"
        },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:2"],
          description: "Aspect ratio of the generated image",
          default: "1:1"
        },
        number_of_images: {
          type: "integer",
          minimum: 1,
          maximum: 9,
          description: "Number of images to generate (1-9)",
          default: 1
        },
        prompt_optimizer: {
          type: "boolean",
          description: "Whether to optimize the prompt for better results",
          default: true
        },
        subject_reference: {
          type: "string",
          description: "Optional URI string for subject reference"
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    // Check if Replicate client is configured
    if (!replicateConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: REPLICATE_API_TOKEN environment variable is not set. Please configure your Replicate API token."
        }],
        isError: true
      };
    }

    const {
      prompt,
      aspect_ratio = "1:1",
      number_of_images = 1,
      prompt_optimizer = true,
      subject_reference
    } = args;
    
    try {
      // Prepare input for Replicate API
      const input: MinimaxImageInput = {
        prompt,
        aspect_ratio,
        number_of_images,
        prompt_optimizer
      };

      // Add optional subject reference if provided
      if (subject_reference) {
        input.subject_reference = subject_reference;
      }

      console.error(`Generating image with minimax/image-01 - prompt: "${prompt}"`);

      // Call Replicate minimax/image-01 API
      const output = await replicate.run("minimax/image-01", { input }) as MinimaxImageResult;

      // Handle both single URL and array of URLs
      const imageUrls: string[] = [];
      if (output.url) {
        imageUrls.push(output.url);
      }
      if (output.urls && Array.isArray(output.urls)) {
        imageUrls.push(...output.urls);
      }

      if (imageUrls.length === 0) {
        throw new Error("No image URLs returned from the API");
      }

      // Download images locally
      console.error("Downloading images locally...");
      const downloadedImages = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        const filename = generateImageFilename(prompt, i + 1);
        
        try {
          const localPath = await downloadImage(imageUrl, filename);
          downloadedImages.push({
            url: imageUrl,
            localPath,
            index: i + 1,
            filename
          });
          console.error(`Downloaded: ${filename}`);
        } catch (downloadError) {
          console.error(`Failed to download image ${i + 1}:`, downloadError);
          // Still add the image info without local path
          downloadedImages.push({
            url: imageUrl,
            localPath: null,
            index: i + 1,
            filename
          });
        }
      }

      // Format response with download information
      const imageDetails = downloadedImages.map(img => {
        let details = `Image ${img.index}:`;
        if (img.localPath) {
          details += `\n  Local Path: ${img.localPath}`;
        }
        details += `\n  Original URL: ${img.url}`;
        details += `\n  Filename: ${img.filename}`;
        return details;
      }).join('\n\n');

      const responseText = `Successfully generated ${downloadedImages.length} image(s) using minimax/image-01:

Prompt: "${prompt}"
Aspect Ratio: ${aspect_ratio}
Number of Images: ${number_of_images}
Prompt Optimizer: ${prompt_optimizer}
${subject_reference ? `Subject Reference: ${subject_reference}` : ''}

Generated Images:
${imageDetails}

${downloadedImages.some(img => img.localPath) ? 'Images have been downloaded to the local \'images\' directory.' : 'Note: Local download failed, but original URLs are available.'}`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error generating image:', error);
      
      let errorMessage = "Failed to generate image with minimax/image-01.";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Generate images with prediction tracking
server.tool(
  "minimax_image_01_generate_async",
  {
    description: "Generate images using minimax/image-01 with prediction tracking for monitoring progress",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text prompt for image generation"
        },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:2"],
          description: "Aspect ratio of the generated image",
          default: "1:1"
        },
        number_of_images: {
          type: "integer",
          minimum: 1,
          maximum: 9,
          description: "Number of images to generate (1-9)",
          default: 1
        },
        prompt_optimizer: {
          type: "boolean",
          description: "Whether to optimize the prompt for better results",
          default: true
        },
        subject_reference: {
          type: "string",
          description: "Optional URI string for subject reference"
        },
        webhook: {
          type: "string",
          description: "Webhook URL to receive updates when the prediction completes"
        },
        webhook_events_filter: {
          type: "array",
          items: {
            type: "string",
            enum: ["start", "output", "logs", "completed"]
          },
          description: "Events to send to the webhook",
          default: ["completed"]
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    // Check if Replicate client is configured
    if (!replicateConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: REPLICATE_API_TOKEN environment variable is not set. Please configure your Replicate API token."
        }],
        isError: true
      };
    }

    const {
      prompt,
      aspect_ratio = "1:1",
      number_of_images = 1,
      prompt_optimizer = true,
      subject_reference,
      webhook,
      webhook_events_filter = ["completed"]
    } = args;
    
    try {
      // Prepare input for Replicate API
      const input: MinimaxImageInput = {
        prompt,
        aspect_ratio,
        number_of_images,
        prompt_optimizer
      };

      // Add optional subject reference if provided
      if (subject_reference) {
        input.subject_reference = subject_reference;
      }

      console.error(`Creating prediction for minimax/image-01 - prompt: "${prompt}"`);

      // Create prediction with optional webhook
      const predictionOptions: any = {
        model: "minimax/image-01",
        input
      };

      if (webhook) {
        predictionOptions.webhook = webhook;
        predictionOptions.webhook_events_filter = webhook_events_filter;
      }

      const prediction = await replicate.predictions.create(predictionOptions);

      const responseText = `Prediction created successfully for minimax/image-01:

Prediction ID: ${prediction.id}
Status: ${prediction.status}
Model: minimax/image-01
Prompt: "${prompt}"
Aspect Ratio: ${aspect_ratio}
Number of Images: ${number_of_images}
Prompt Optimizer: ${prompt_optimizer}
${subject_reference ? `Subject Reference: ${subject_reference}` : ''}
${webhook ? `Webhook: ${webhook}` : 'No webhook configured'}

Use the prediction ID with the 'minimax_image_01_get_prediction' tool to check status and get results.`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error creating prediction:', error);
      
      let errorMessage = "Failed to create prediction for minimax/image-01.";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Get prediction status and results
server.tool(
  "minimax_image_01_get_prediction",
  {
    description: "Get the status and results of a prediction created with minimax_image_01_generate_async",
    inputSchema: {
      type: "object",
      properties: {
        prediction_id: {
          type: "string",
          description: "The prediction ID returned from minimax_image_01_generate_async"
        }
      },
      required: ["prediction_id"]
    }
  },
  async (args: any) => {
    // Check if Replicate client is configured
    if (!replicateConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: REPLICATE_API_TOKEN environment variable is not set. Please configure your Replicate API token."
        }],
        isError: true
      };
    }

    const { prediction_id } = args;
    
    try {
      console.error(`Getting prediction status for: ${prediction_id}`);

      const prediction = await replicate.predictions.get(prediction_id);

      let responseText = `Prediction Status for ${prediction_id}:

Status: ${prediction.status}
Model: ${prediction.model}
Created: ${prediction.created_at}
${prediction.started_at ? `Started: ${prediction.started_at}` : ''}
${prediction.completed_at ? `Completed: ${prediction.completed_at}` : ''}`;

      if (prediction.input) {
        const input = prediction.input as MinimaxImageInput;
        responseText += `\n\nInput Parameters:`;
        responseText += `\nPrompt: "${input.prompt}"`;
        if (input.aspect_ratio) responseText += `\nAspect Ratio: ${input.aspect_ratio}`;
        if (input.number_of_images) responseText += `\nNumber of Images: ${input.number_of_images}`;
        if (input.prompt_optimizer !== undefined) responseText += `\nPrompt Optimizer: ${input.prompt_optimizer}`;
        if (input.subject_reference) responseText += `\nSubject Reference: ${input.subject_reference}`;
      }

      if (prediction.error) {
        responseText += `\n\nError: ${prediction.error}`;
      }

      if (prediction.logs) {
        responseText += `\n\nLogs:\n${prediction.logs}`;
      }

      if (prediction.output && prediction.status === 'succeeded') {
        const output = prediction.output as MinimaxImageResult;
        const imageUrls: string[] = [];
        
        if (output.url) {
          imageUrls.push(output.url);
        }
        if (output.urls && Array.isArray(output.urls)) {
          imageUrls.push(...output.urls);
        }

        if (imageUrls.length > 0) {
          responseText += `\n\nGenerated Images:`;
          
          // Download images locally
          const downloadedImages = [];
          for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            const input = prediction.input as MinimaxImageInput;
            const filename = generateImageFilename(input?.prompt || 'image', i + 1);
            
            try {
              const localPath = await downloadImage(imageUrl, filename);
              downloadedImages.push({
                url: imageUrl,
                localPath,
                index: i + 1,
                filename
              });
              console.error(`Downloaded: ${filename}`);
            } catch (downloadError) {
              console.error(`Failed to download image ${i + 1}:`, downloadError);
              downloadedImages.push({
                url: imageUrl,
                localPath: null,
                index: i + 1,
                filename
              });
            }
          }

          downloadedImages.forEach(img => {
            responseText += `\n\nImage ${img.index}:`;
            if (img.localPath) {
              responseText += `\n  Local Path: ${img.localPath}`;
            }
            responseText += `\n  Original URL: ${img.url}`;
            responseText += `\n  Filename: ${img.filename}`;
          });

          if (downloadedImages.some(img => img.localPath)) {
            responseText += `\n\nImages have been downloaded to the local 'images' directory.`;
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error getting prediction:', error);
      
      let errorMessage = "Failed to get prediction status.";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Cancel a prediction
server.tool(
  "minimax_image_01_cancel_prediction",
  {
    description: "Cancel a running prediction to prevent unnecessary work and reduce costs",
    inputSchema: {
      type: "object",
      properties: {
        prediction_id: {
          type: "string",
          description: "The prediction ID to cancel"
        }
      },
      required: ["prediction_id"]
    }
  },
  async (args: any) => {
    // Check if Replicate client is configured
    if (!replicateConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: REPLICATE_API_TOKEN environment variable is not set. Please configure your Replicate API token."
        }],
        isError: true
      };
    }

    const { prediction_id } = args;
    
    try {
      console.error(`Cancelling prediction: ${prediction_id}`);

      const prediction = await replicate.predictions.cancel(prediction_id);

      const responseText = `Prediction ${prediction_id} has been cancelled.

Status: ${prediction.status}
Model: ${prediction.model}
Created: ${prediction.created_at}
${prediction.started_at ? `Started: ${prediction.started_at}` : ''}
${prediction.completed_at ? `Completed: ${prediction.completed_at}` : ''}

The prediction has been stopped and will not consume additional resources.`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error cancelling prediction:', error);
      
      let errorMessage = "Failed to cancel prediction.";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});