<div align="center">
<img width="1200" height="475" alt="Google AI Studio banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Intelligent Notes

An AI-focused notes application created with Google AI Studio and powered by a React/Vite development stack.

[Open the project in Google AI Studio](https://ai.studio/apps/275931a8-a237-429f-b2da-52e5f913fbbd)

## Run locally

**Prerequisites:** Node.js and npm.

1. Clone the repository and enter its directory.
   ```bash
   git clone https://github.com/pkrRepo00/Intelligent_Notes.git
   cd Intelligent_Notes
   ```
2. Install dependencies.
   ```bash
   npm install
   ```
3. Create a local `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```
4. Start the development server.
   ```bash
   npm run dev
   ```
5. Open the local URL printed by Vite.

## Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |

## Configuration and security

- Keep your API key out of source control. The repository's `.gitignore` excludes `.env*` files while allowing `.env.example`.
- Before deploying publicly, verify that the API key is not exposed in client-side JavaScript. Use a server-side API endpoint for production secrets.

## Contributing

For issues, include steps to reproduce and relevant browser or terminal errors. Keep pull requests focused and update these instructions when setup changes.

## License

See the repository's [LICENSE](LICENSE) file.
