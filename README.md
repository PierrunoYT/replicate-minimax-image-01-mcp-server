# Replicate Minimax Image-01 MCP Server

A Model Context Protocol (MCP) server that provides access to the minimax/image-01 image generation model via Replicate. This server allows you to generate high-quality images using advanced AI technology through the Replicate platform.

## Features

- **High-Quality Image Generation**: Generate stunning images using the minimax/image-01 model
- **Multiple Generation Methods**: Support for synchronous and asynchronous generation with prediction tracking
- **Flexible Aspect Ratios**: Support for 8 different aspect ratios including square, landscape, and portrait
- **Multiple Image Generation**: Generate 1-9 images per request
- **Prompt Optimization**: Built-in prompt optimization for better results
- **Subject Reference Support**: Optional subject reference for consistent character generation
- **Local Image Download**: Automatically downloads generated images to local storage in WebP format
- **Prediction Management**: Create, track, and cancel predictions
- **Webhook Support**: Optional webhook notifications for completed requests

## Installation

### Option 1: Universal npx Installation (Recommended)

No local installation required! Use npx to run the server directly:

```bash
npx -y https://github.com/PierrunoYT/replicate-minimax-image-01-mcp-server.git
```

### Option 2: Local Installation

1. Clone this repository:
```bash
git clone https://github.com/PierrunoYT/replicate-minimax-image-01-mcp-server.git
cd replicate-minimax-image-01-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables

Set your Replicate API token as an environment variable:

```bash
export REPLICATE_API_TOKEN="r8_NBY**********************************"
```

You can get your API token from [Replicate](https://replicate.com/).

### MCP Client Configuration

#### Universal npx Configuration (Recommended)

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "replicate-minimax-image-01": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/PierrunoYT/replicate-minimax-image-01-mcp-server.git"
      ],
      "env": {
        "REPLICATE_API_TOKEN": "r8_NBY**********************************"
      }
    }
  }
}
```

#### Local Installation Configuration

For local installations, use:

```json
{
  "mcpServers": {
    "replicate-minimax-image-01": {
      "command": "node",
      "args": ["/path/to/replicate-minimax-image-01-mcp-server/build/index.js"],
      "env": {
        "REPLICATE_API_TOKEN": "r8_NBY**********************************"
      }
    }
  }
}
```

## Available Tools

### 1. `minimax_image_01_generate`

Generate images using the standard synchronous method.

**Parameters:**
- `prompt` (required): Text prompt for image generation
- `aspect_ratio` (optional): Aspect ratio of the generated image (default: "1:1")
  - Options: "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:2"
- `number_of_images` (optional): Number of images to generate, 1-9 (default: 1)
- `prompt_optimizer` (optional): Whether to optimize the prompt for better results (default: true)
- `subject_reference` (optional): URI string for subject reference

**Example:**
```json
{
  "prompt": "a wildlife photography photo of a red panda using a laptop in a snowy forest",
  "aspect_ratio": "16:9",
  "number_of_images": 3,
  "prompt_optimizer": true
}
```

### 2. `minimax_image_01_generate_async`

Generate images using asynchronous method with prediction tracking.

**Parameters:** Same as `minimax_image_01_generate` plus:
- `webhook` (optional): URL for webhook notifications
- `webhook_events_filter` (optional): Events to send to webhook (default: ["completed"])

**Returns:** A prediction ID for tracking the job

### 3. `minimax_image_01_get_prediction`

Get the status and results of a prediction created with `minimax_image_01_generate_async`.

**Parameters:**
- `prediction_id` (required): The prediction ID from async generation

### 4. `minimax_image_01_cancel_prediction`

Cancel a running prediction to prevent unnecessary work and reduce costs.

**Parameters:**
- `prediction_id` (required): The prediction ID to cancel

## Aspect Ratios

The minimax/image-01 model supports the following aspect ratios:

- `1:1` - Square (default)
- `16:9` - Widescreen landscape
- `9:16` - Vertical/portrait
- `4:3` - Standard landscape
- `3:4` - Standard portrait
- `3:2` - Classic photo landscape
- `2:3` - Classic photo portrait
- `1:2` - Tall portrait

## Multiple Image Generation

You can generate between 1 and 9 images in a single request by setting the `number_of_images` parameter. Each image will be saved with a unique filename and index.

## Prompt Optimization

The model includes built-in prompt optimization that can enhance your prompts for better results. This is enabled by default but can be disabled by setting `prompt_optimizer` to `false`.

## Subject Reference

For consistent character generation across multiple images, you can provide a `subject_reference` URI that the model will use as a reference for maintaining character consistency.

## Output

Generated images are automatically downloaded to a local `images/` directory with descriptive filenames in WebP format. The response includes:

- Local file paths
- Original URLs
- Image filenames
- Generation parameters used
- Prediction IDs for tracking

## Error Handling

The server provides detailed error messages for:
- Missing API tokens
- Invalid parameters
- Network issues
- API rate limits
- Generation failures

## Development

### Running in Development Mode

```bash
npm run dev
```

### Testing the Server

```bash
npm test
```

### Getting the Installation Path

```bash
npm run get-path
```

## API Reference

This server implements the minimax/image-01 API via Replicate. For detailed API documentation, visit:
- [Replicate Minimax Image-01](https://replicate.com/minimax/image-01)
- [Replicate API Documentation](https://replicate.com/docs)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/PierrunoYT/replicate-minimax-image-01-mcp-server/issues)
- Check the [Replicate documentation](https://replicate.com/docs)

## Changelog

### v2.0.0
- **BREAKING CHANGE**: Complete migration from recraft-ai/recraft-v3 to minimax/image-01
- Updated all tool names from `recraft_v3_*` to `minimax_image_01_*`
- New parameter schema supporting minimax/image-01 features:
  - 8 aspect ratio options (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 1:2)
  - Multiple image generation (1-9 images per request)
  - Built-in prompt optimization
  - Subject reference support for character consistency
- Updated filename generation with minimax_image_01 prefix
- Comprehensive documentation updates
- Maintained all existing architectural patterns and error handling

### v1.0.0
- Initial release with recraft-ai/recraft-v3 integration
- Support for synchronous and asynchronous generation
- Prediction tracking and management
- Multiple size and aspect ratio options
- Comprehensive style control options
- Local image download functionality in WebP format
- Comprehensive error handling