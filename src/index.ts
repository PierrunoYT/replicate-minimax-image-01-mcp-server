#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { writeFile } from "fs/promises";
import Replicate from "replicate";
import * as fs from 'fs';
import * as path from 'path';

// Initialize Replicate client
const replicate = new Replicate();

// Check for required environment variable
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN environment variable is required');
  console.error('Please set your Replicate API token: export REPLICATE_API_TOKEN=r8_your_token_here');
  process.exit(1);
}

// Define types for the new minimax/image-01 API
interface MinimaxImageFile {
  url(): string;
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
}

interface MinimaxImageInput {
  prompt: string;
  aspect_ratio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9";
  number_of_images?: number;
  prompt_optimizer?: boolean;
  subject_reference?: string;
}

// Utility function to generate safe filenames
function generateImageFilename(prompt: string, index: number): string {
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `minimax_image_01_${safePrompt}_${index}_${timestamp}.jpeg`;
}

// Utility function to ensure images directory exists
function ensureImagesDirectory(): string {
  const imagesDir = path.join(process.cwd(), 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

// Create MCP server instance
const server = new McpServer({
  name: "replicate-minimax-image-01-server",
  version: "2.0.0",
});

// Tool: Generate images synchronously
server.tool(
  "minimax_image_01_generate",
  {
    description: "Generate high-quality images using minimax/image-01 model via Replicate API",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text prompt for generation"
        },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"],
          description: "Image aspect ratio",
          default: "1:1"
        },
        number_of_images: {
          type: "integer",
          minimum: 1,
          maximum: 9,
          description: "Number of images to generate",
          default: 1
        },
        prompt_optimizer: {
          type: "boolean",
          description: "Use prompt optimizer",
          default: true
        },
        subject_reference: {
          type: "string",
          format: "uri",
          description: "An optional character reference image (human face) to use as the subject in the generated image(s)"
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    const {
      prompt,
      aspect_ratio = "1:1",
      number_of_images = 1,
      prompt_optimizer = true,
      subject_reference
    } = args;

    try {
      // Prepare input for the API
      const input: MinimaxImageInput = {
        prompt,
        aspect_ratio,
        number_of_images,
        prompt_optimizer
      };

      if (subject_reference) {
        input.subject_reference = subject_reference;
      }

      console.error(`Generating ${number_of_images} image(s) with prompt: "${prompt}"`);

      // Call the minimax/image-01 model
      const output = await replicate.run("minimax/image-01", { input }) as MinimaxImageFile[];

      if (!output || output.length === 0) {
        throw new Error("No images returned from the API");
      }

      // Ensure images directory exists
      const imagesDir = ensureImagesDirectory();

      // Process and save each image
      const savedImages = [];
      for (const [index, imageFile] of Object.entries(output)) {
        const imageIndex = parseInt(index) + 1;
        const filename = generateImageFilename(prompt, imageIndex);
        const filePath = path.join(imagesDir, filename);

        try {
          // Write the file to disk using the new API
          await writeFile(filePath, imageFile);
          
          savedImages.push({
            index: imageIndex,
            filename,
            localPath: filePath,
            url: imageFile.url()
          });

          console.error(`Saved image ${imageIndex}: ${filename}`);
        } catch (saveError) {
          console.error(`Failed to save image ${imageIndex}:`, saveError);
          savedImages.push({
            index: imageIndex,
            filename,
            localPath: null,
            url: imageFile.url()
          });
        }
      }

      // Format response
      const imageDetails = savedImages.map(img => {
        let details = `Image ${img.index}:`;
        if (img.localPath) {
          details += `\n  Local Path: ${img.localPath}`;
        }
        details += `\n  Original URL: ${img.url}`;
        details += `\n  Filename: ${img.filename}`;
        return details;
      }).join('\n\n');

      const responseText = `Successfully generated ${savedImages.length} image(s) using minimax/image-01:

Prompt: "${prompt}"
Aspect Ratio: ${aspect_ratio}
Number of Images: ${number_of_images}
Prompt Optimizer: ${prompt_optimizer}
${subject_reference ? `Subject Reference: ${subject_reference}` : ''}

Generated Images:
${imageDetails}

${savedImages.some(img => img.localPath) ? 'Images have been saved to the local \'images\' directory in JPEG format.' : 'Note: Local save failed, but original URLs are available.'}`;

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };

    } catch (error) {
      console.error('Error generating images:', error);
      
      const errorMessage = error instanceof Error 
        ? `Failed to generate images: ${error.message}`
        : 'Failed to generate images: Unknown error occurred';

      return {
        content: [{
          type: "text",
          text: errorMessage
        }],
        isError: true
      };
    }
  }
);

// Tool: Generate images asynchronously with prediction tracking
server.tool(
  "minimax_image_01_generate_async",
  {
    description: "Generate images using minimax/image-01 with prediction tracking for monitoring progress",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text prompt for generation"
        },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"],
          description: "Image aspect ratio",
          default: "1:1"
        },
        number_of_images: {
          type: "integer",
          minimum: 1,
          maximum: 9,
          description: "Number of images to generate",
          default: 1
        },
        prompt_optimizer: {
          type: "boolean",
          description: "Use prompt optimizer",
          default: true
        },
        subject_reference: {
          type: "string",
          format: "uri",
          description: "An optional character reference image (human face) to use as the subject in the generated image(s)"
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
      // Prepare input for the API
      const input: MinimaxImageInput = {
        prompt,
        aspect_ratio,
        number_of_images,
        prompt_optimizer
      };

      if (subject_reference) {
        input.subject_reference = subject_reference;
      }

      console.error(`Creating async prediction for prompt: "${prompt}"`);

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

      const responseText = `Async prediction created successfully:

Prediction ID: ${prediction.id}
Status: ${prediction.status}
Model: minimax/image-01
Prompt: "${prompt}"
Aspect Ratio: ${aspect_ratio}
Number of Images: ${number_of_images}
Prompt Optimizer: ${prompt_optimizer}
${subject_reference ? `Subject Reference: ${subject_reference}` : ''}
${webhook ? `Webhook: ${webhook}` : 'No webhook configured'}

Use 'minimax_image_01_get_prediction' with the prediction ID to check status and retrieve results.`;

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };

    } catch (error) {
      console.error('Error creating prediction:', error);
      
      const errorMessage = error instanceof Error 
        ? `Failed to create prediction: ${error.message}`
        : 'Failed to create prediction: Unknown error occurred';

      return {
        content: [{
          type: "text",
          text: errorMessage
        }],
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
    const { prediction_id } = args;

    try {
      console.error(`Fetching prediction status for: ${prediction_id}`);

      const prediction = await replicate.predictions.get(prediction_id);

      let responseText = `Prediction Status for ${prediction_id}:

Status: ${prediction.status}
Model: ${prediction.model}
Created: ${prediction.created_at}
${prediction.started_at ? `Started: ${prediction.started_at}` : ''}
${prediction.completed_at ? `Completed: ${prediction.completed_at}` : ''}`;

      // Add input parameters if available
      if (prediction.input) {
        const input = prediction.input as MinimaxImageInput;
        responseText += `\n\nInput Parameters:`;
        responseText += `\nPrompt: "${input.prompt}"`;
        if (input.aspect_ratio) responseText += `\nAspect Ratio: ${input.aspect_ratio}`;
        if (input.number_of_images) responseText += `\nNumber of Images: ${input.number_of_images}`;
        if (input.prompt_optimizer !== undefined) responseText += `\nPrompt Optimizer: ${input.prompt_optimizer}`;
        if (input.subject_reference) responseText += `\nSubject Reference: ${input.subject_reference}`;
      }

      // Add error information if present
      if (prediction.error) {
        responseText += `\n\nError: ${prediction.error}`;
      }

      // Add logs if available
      if (prediction.logs) {
        responseText += `\n\nLogs:\n${prediction.logs}`;
      }

      // Process output if prediction succeeded
      if (prediction.output && prediction.status === 'succeeded') {
        const output = prediction.output as MinimaxImageFile[];

        if (output && output.length > 0) {
          responseText += `\n\nGenerated Images:`;
          
          // Ensure images directory exists
          const imagesDir = ensureImagesDirectory();

          // Save images locally
          const savedImages = [];
          for (const [index, imageFile] of Object.entries(output)) {
            const imageIndex = parseInt(index) + 1;
            const input = prediction.input as MinimaxImageInput;
            const filename = generateImageFilename(input?.prompt || 'prediction', imageIndex);
            const filePath = path.join(imagesDir, filename);
            
            try {
              await writeFile(filePath, imageFile);
              savedImages.push({
                index: imageIndex,
                filename,
                localPath: filePath,
                url: imageFile.url()
              });
              console.error(`Saved prediction image ${imageIndex}: ${filename}`);
            } catch (saveError) {
              console.error(`Failed to save prediction image ${imageIndex}:`, saveError);
              savedImages.push({
                index: imageIndex,
                filename,
                localPath: null,
                url: imageFile.url()
              });
            }
          }

          // Add image details to response
          savedImages.forEach(img => {
            responseText += `\n\nImage ${img.index}:`;
            if (img.localPath) {
              responseText += `\n  Local Path: ${img.localPath}`;
            }
            responseText += `\n  Original URL: ${img.url}`;
            responseText += `\n  Filename: ${img.filename}`;
          });

          if (savedImages.some(img => img.localPath)) {
            responseText += `\n\nImages have been saved to the local 'images' directory in JPEG format.`;
          }
        }
      }

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };

    } catch (error) {
      console.error('Error fetching prediction:', error);
      
      const errorMessage = error instanceof Error 
        ? `Failed to get prediction status: ${error.message}`
        : 'Failed to get prediction status: Unknown error occurred';

      return {
        content: [{
          type: "text",
          text: errorMessage
        }],
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
        content: [{
          type: "text",
          text: responseText
        }]
      };

    } catch (error) {
      console.error('Error cancelling prediction:', error);
      
      const errorMessage = error instanceof Error 
        ? `Failed to cancel prediction: ${error.message}`
        : 'Failed to cancel prediction: Unknown error occurred';

      return {
        content: [{
          type: "text",
          text: errorMessage
        }],
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

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Minimax Image-01 MCP Server started successfully');
}

// Start the server
main().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});