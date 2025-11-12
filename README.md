# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/e9d8c41a-9324-4037-b04f-6143d0ee0955

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e9d8c41a-9324-4037-b04f-6143d0ee0955) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e9d8c41a-9324-4037-b04f-6143d0ee0955) and click on Share -> Publish.

## Deploying to a Subpath

This project supports deployment under a subpath (e.g., `/standard-app/`) without manual file edits.

### Build with Base Path

You can set the base path in two ways:

**Option 1: Environment Variable**
```sh
VITE_APP_BASE=/standard-app/ npm run build
```

**Option 2: CLI Flag**
```sh
npm run build -- --base=/standard-app/
```

Both methods will produce a `dist` folder that works correctly when deployed under `/standard-app/` in Nginx or any web server.

### Nginx Configuration Example

```nginx
location /standard-app/ {
    alias /path/to/dist/;
    try_files $uri $uri/ /standard-app/index.html;
}
```

### Development with Base Path

For local development with a base path:
```sh
VITE_APP_BASE=/standard-app/ npm run dev
```

The base path defaults to `/` if not specified, so the app works normally at the root path.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
